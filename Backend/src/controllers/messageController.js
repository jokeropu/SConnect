const Conversation=require('../models/conversation');
const Message=require('../models/message');
const User=require('../models/user');
const notify=require('../utils/notify');
const {requireFields}=require('../utils/validate');
const {parsePaging,buildMeta}=require('../utils/pagination');
const {childIdsForParent,classIdsForTeacher,classIdForStudent}=require('../utils/scope');
const Lesson=require('../models/lesson');
const StudentProfile=require('../models/studentProfile');
const ParentProfile=require('../models/parentProfile');

const canMessage=async(user,targetId)=>{
    if(user.role==='admin') return true;

    const target=await User.findById(targetId).select('role');
    if(!target) return false;
    if(target.role==='admin') return true;

    if(user.role==='teacher'){
        const classIds=await classIdsForTeacher(user._id);
        if(target.role==='student'){
            const profile=await StudentProfile.findOne({userId:targetId}).select('classId');
            return classIds.includes(String(profile?.classId));
        }
        if(target.role==='parent'){
            const children=await childIdsForParent(targetId);
            const profiles=await StudentProfile.find({userId:{$in:children}}).select('classId');
            return profiles.some((p)=>classIds.includes(String(p.classId)));
        }
        return true;
    }

    if(user.role==='student'){
        if(target.role!=='teacher') return false;
        const classId=await classIdForStudent(user._id);
        const teaches=await Lesson.exists({classId,teacherId:targetId});
        return !!teaches;
    }

    if(user.role==='parent'){
        if(target.role!=='teacher') return false;
        const children=await childIdsForParent(user._id);
        const profiles=await StudentProfile.find({userId:{$in:children}}).select('classId');
        const teaches=await Lesson.exists({classId:{$in:profiles.map((p)=>p.classId)},teacherId:targetId});
        return !!teaches;
    }

    return false;
};

const listConversations=async(req,res)=>{
    try{
        const conversations=await Conversation.find({participants:req.result._id})
            .populate('participants','firstName lastName role avatarUrl')
            .sort({lastMessageAt:-1});

        const data=conversations.map((conversation)=>({
            _id:conversation._id,
            other:conversation.participants.find((p)=>String(p._id)!==String(req.result._id)) || null,
            lastMessage:conversation.lastMessage,
            lastMessageAt:conversation.lastMessageAt,
            unread:conversation.unread?.get(String(req.result._id)) || 0
        }));

        res.status(200).json({data});
    }
    catch(err){
        res.status(500).json({error:err.message});
    }
};

const startConversation=async(req,res)=>{
    try{
        requireFields(req.body,['userId']);
        const {userId}=req.body;

        if(String(userId)===String(req.result._id)){
            throw new Error("You cannot message yourself");
        }

        const allowed=await canMessage(req.result,userId);
        if(!allowed){
            return res.status(403).json({error:"You are not permitted to message this person"});
        }

        let conversation=await Conversation.findOne({participants:{$all:[req.result._id,userId],$size:2}});
        if(!conversation){
            conversation=await Conversation.create({participants:[req.result._id,userId]});
        }

        await conversation.populate('participants','firstName lastName role avatarUrl');
        res.status(200).json({conversation});
    }
    catch(err){
        res.status(400).json({error:err.message});
    }
};

const listMessages=async(req,res)=>{
    try{
        const {page,limit,skip}=parsePaging({...req.query,limit:req.query.limit || 50});
        const conversation=await Conversation.findById(req.params.id);

        if(!conversation){
            return res.status(404).json({error:"Conversation not found"});
        }
        if(!conversation.participants.some((p)=>String(p)===String(req.result._id))){
            return res.status(403).json({error:"You are not part of this conversation"});
        }

        const [messages,total]=await Promise.all([
            Message.find({conversationId:conversation._id}).populate('senderId','firstName lastName avatarUrl').sort({createdAt:-1}).skip(skip).limit(limit),
            Message.countDocuments({conversationId:conversation._id})
        ]);

        await Message.updateMany(
            {conversationId:conversation._id,readBy:{$ne:req.result._id}},
            {$addToSet:{readBy:req.result._id}}
        );
        conversation.unread.set(String(req.result._id),0);
        await conversation.save();

        res.status(200).json({data:messages.reverse(),meta:buildMeta(page,limit,total)});
    }
    catch(err){
        res.status(500).json({error:err.message});
    }
};

const sendMessage=async(req,res)=>{
    try{
        const conversation=await Conversation.findById(req.params.id);
        if(!conversation){
            return res.status(404).json({error:"Conversation not found"});
        }
        if(!conversation.participants.some((p)=>String(p)===String(req.result._id))){
            return res.status(403).json({error:"You are not part of this conversation"});
        }

        const text=(req.body.text || '').trim();
        if(!text && !req.file){
            throw new Error("Message cannot be empty");
        }

        const message=await Message.create({
            conversationId:conversation._id,
            senderId:req.result._id,
            text,
            attachmentUrl:req.file?req.file.path:null,
            readBy:[req.result._id]
        });

        const recipientId=conversation.participants.find((p)=>String(p)!==String(req.result._id));
        conversation.lastMessage=text.slice(0,140);
        conversation.lastMessageAt=new Date();
        conversation.unread.set(String(recipientId),(conversation.unread.get(String(recipientId)) || 0)+1);
        await conversation.save();

        await message.populate('senderId','firstName lastName avatarUrl');

        await notify(
            recipientId,
            'message_received',
            `New message from ${req.result.firstName}`,
            text.slice(0,120) || 'Sent an attachment',
            '/messages'
        );

        res.status(201).json({message});
    }
    catch(err){
        res.status(400).json({error:err.message});
    }
};

const contactClausesFor=async(user)=>{
    if(user.role==='teacher'){
        const classIds=await classIdsForTeacher(user._id);
        const profiles=await StudentProfile.find({classId:{$in:classIds}}).select('userId');
        const studentIds=profiles.map((p)=>p.userId);
        const parents=await ParentProfile.find({children:{$in:studentIds}}).select('userId');

        return [
            {role:{$in:['admin','teacher']}},
            {role:'student',_id:{$in:studentIds}},
            {role:'parent',_id:{$in:parents.map((p)=>p.userId)}}
        ];
    }

    if(user.role==='student'){
        const classId=await classIdForStudent(user._id);
        const teacherIds=classId?await Lesson.find({classId}).distinct('teacherId'):[];
        return [{role:'admin'},{role:'teacher',_id:{$in:teacherIds}}];
    }

    if(user.role==='parent'){
        const children=await childIdsForParent(user._id);
        const profiles=await StudentProfile.find({userId:{$in:children}}).select('classId');
        const classIds=profiles.map((p)=>p.classId).filter(Boolean);
        const teacherIds=await Lesson.find({classId:{$in:classIds}}).distinct('teacherId');
        return [{role:'admin'},{role:'teacher',_id:{$in:teacherIds}}];
    }

    return null;
};

const contactList=async(req,res)=>{
    try{
        const query={status:'approved',_id:{$ne:req.result._id}};

        if(req.result.role!=='admin'){
            const clauses=await contactClausesFor(req.result);
            if(!clauses){
                return res.status(200).json({data:[]});
            }
            query.$or=clauses;
        }

        const contacts=await User.find(query)
            .select('firstName lastName role avatarUrl email')
            .sort({firstName:1})
            .limit(300);

        res.status(200).json({data:contacts});
    }
    catch(err){
        res.status(500).json({error:err.message});
    }
};

module.exports={listConversations,startConversation,listMessages,sendMessage,contactList,canMessage};
