const Announcement=require('../models/announcement');
const Event=require('../models/event');
const StudentProfile=require('../models/studentProfile');
const notify=require('../utils/notify');
const {requireFields}=require('../utils/validate');
const {parsePaging,buildMeta,searchRegex}=require('../utils/pagination');
const {visibleClassIds,assertClassAccess}=require('../utils/scope');

const listAnnouncements=async(req,res)=>{
    try{
        const {page,limit,skip}=parsePaging(req.query);
        const {search,scope}=req.query;

        const allowed=await visibleClassIds(req.result);
        const query=allowed===null?{}:{$or:[{scope:'global'},{classId:{$in:allowed}}]};

        if(scope) query.scope=scope;
        if(search) query.title=searchRegex(search);

        const [announcements,total]=await Promise.all([
            Announcement.find(query).populate('authorId','firstName lastName role avatarUrl').populate('classId','name').sort({pinned:-1,createdAt:-1}).skip(skip).limit(limit),
            Announcement.countDocuments(query)
        ]);

        res.status(200).json({data:announcements,meta:buildMeta(page,limit,total)});
    }
    catch(err){
        res.status(500).json({error:err.message});
    }
};

const createAnnouncement=async(req,res)=>{
    try{
        requireFields(req.body,['title','body']);
        const scope=req.body.scope || 'global';

        if(scope==='global' && req.result.role!=='admin'){
            return res.status(403).json({error:"Only an administrator can post a school-wide announcement"});
        }
        if(scope==='class'){
            requireFields(req.body,['classId']);
            await assertClassAccess(req.result,req.body.classId);
        }

        const announcement=await Announcement.create({
            title:req.body.title,
            body:req.body.body,
            scope,
            classId:scope==='class'?req.body.classId:null,
            pinned:!!req.body.pinned,
            urgent:!!req.body.urgent,
            authorId:req.result._id
        });

        const recipients=scope==='class'
            ? (await StudentProfile.find({classId:announcement.classId}).select('userId parentId'))
            : [];

        if(scope==='class'){
            await notify.notifyMany(
                [...recipients.map((r)=>r.userId),...recipients.map((r)=>r.parentId).filter(Boolean)],
                'announcement_posted',
                announcement.urgent?'Urgent announcement':'New announcement',
                announcement.title,
                '/announcements'
            );
        }

        res.status(201).json({announcement,message:"Announcement posted"});
    }
    catch(err){
        res.status(400).json({error:err.message});
    }
};

const updateAnnouncement=async(req,res)=>{
    try{
        const announcement=await Announcement.findById(req.params.id);
        if(!announcement){
            return res.status(404).json({error:"Announcement not found"});
        }
        if(req.result.role!=='admin' && String(announcement.authorId)!==String(req.result._id)){
            return res.status(403).json({error:"Only the author can edit this announcement"});
        }

        const allowed=['title','body','pinned','urgent'];
        for(const key of allowed){
            if(req.body[key]!==undefined) announcement[key]=req.body[key];
        }

        await announcement.save();
        res.status(200).json({announcement,message:"Announcement updated"});
    }
    catch(err){
        res.status(400).json({error:err.message});
    }
};

const deleteAnnouncement=async(req,res)=>{
    try{
        const announcement=await Announcement.findById(req.params.id);
        if(!announcement){
            return res.status(404).json({error:"Announcement not found"});
        }
        if(req.result.role!=='admin' && String(announcement.authorId)!==String(req.result._id)){
            return res.status(403).json({error:"Only the author can delete this announcement"});
        }

        await Announcement.findByIdAndDelete(req.params.id);
        res.status(200).json({message:"Announcement deleted"});
    }
    catch(err){
        res.status(500).json({error:err.message});
    }
};

const listEvents=async(req,res)=>{
    try{
        const {page,limit,skip}=parsePaging(req.query);
        const {from,to,category}=req.query;

        const allowed=await visibleClassIds(req.result);
        const query=allowed===null?{}:{$or:[{audience:'all'},{classId:{$in:allowed}}]};

        if(category) query.category=category;
        if(from || to){
            query.startTime={};
            if(from) query.startTime.$gte=new Date(from);
            if(to) query.startTime.$lte=new Date(to);
        }

        const [events,total]=await Promise.all([
            Event.find(query).populate('classId','name').populate('createdBy','firstName lastName').sort({startTime:1}).skip(skip).limit(limit),
            Event.countDocuments(query)
        ]);

        res.status(200).json({data:events,meta:buildMeta(page,limit,total)});
    }
    catch(err){
        res.status(500).json({error:err.message});
    }
};

const createEvent=async(req,res)=>{
    try{
        requireFields(req.body,['title','startTime','endTime']);
        const audience=req.body.audience || 'all';

        if(audience==='all' && req.result.role!=='admin'){
            return res.status(403).json({error:"Only an administrator can create a school-wide event"});
        }
        if(audience==='class'){
            requireFields(req.body,['classId']);
            await assertClassAccess(req.result,req.body.classId);
        }
        if(new Date(req.body.endTime)<=new Date(req.body.startTime)){
            throw new Error("endTime must be after startTime");
        }

        const event=await Event.create({
            ...req.body,
            audience,
            classId:audience==='class'?req.body.classId:null,
            createdBy:req.result._id
        });

        res.status(201).json({event,message:"Event created"});
    }
    catch(err){
        res.status(400).json({error:err.message});
    }
};

const updateEvent=async(req,res)=>{
    try{
        const event=await Event.findById(req.params.id);
        if(!event){
            return res.status(404).json({error:"Event not found"});
        }
        if(req.result.role!=='admin' && String(event.createdBy)!==String(req.result._id)){
            return res.status(403).json({error:"Only the person who created this event can edit it"});
        }

        const allowed=['title','description','category','startTime','endTime'];
        for(const key of allowed){
            if(req.body[key]!==undefined) event[key]=req.body[key];
        }

        if(new Date(event.endTime)<=new Date(event.startTime)){
            throw new Error("endTime must be after startTime");
        }

        await event.save();
        res.status(200).json({event,message:"Event updated"});
    }
    catch(err){
        res.status(400).json({error:err.message});
    }
};

const deleteEvent=async(req,res)=>{
    try{
        const event=await Event.findById(req.params.id);
        if(!event){
            return res.status(404).json({error:"Event not found"});
        }
        if(req.result.role!=='admin' && String(event.createdBy)!==String(req.result._id)){
            return res.status(403).json({error:"Only the person who created this event can delete it"});
        }

        await Event.findByIdAndDelete(event._id);
        res.status(200).json({message:"Event deleted"});
    }
    catch(err){
        res.status(500).json({error:err.message});
    }
};

module.exports={listAnnouncements,createAnnouncement,updateAnnouncement,deleteAnnouncement,listEvents,createEvent,updateEvent,deleteEvent};
