const Notification=require('../models/notification');
const {parsePaging,buildMeta}=require('../utils/pagination');

const listNotifications=async(req,res)=>{
    try{
        const {page,limit,skip}=parsePaging({...req.query,limit:req.query.limit || 20});
        const query={userId:req.result._id};
        if(req.query.unread==='true') query.read=false;

        const [notifications,total,unreadCount]=await Promise.all([
            Notification.find(query).sort({createdAt:-1}).skip(skip).limit(limit),
            Notification.countDocuments(query),
            Notification.countDocuments({userId:req.result._id,read:false})
        ]);

        res.status(200).json({data:notifications,unreadCount,meta:buildMeta(page,limit,total)});
    }
    catch(err){
        res.status(500).json({error:err.message});
    }
};

const markRead=async(req,res)=>{
    try{
        const notification=await Notification.findOneAndUpdate(
            {_id:req.params.id,userId:req.result._id},
            {$set:{read:true}},
            {new:true}
        );

        if(!notification){
            return res.status(404).json({error:"Notification not found"});
        }
        res.status(200).json({notification});
    }
    catch(err){
        res.status(500).json({error:err.message});
    }
};

const markAllRead=async(req,res)=>{
    try{
        await Notification.updateMany({userId:req.result._id,read:false},{$set:{read:true}});
        res.status(200).json({message:"All notifications marked as read"});
    }
    catch(err){
        res.status(500).json({error:err.message});
    }
};

const clearAll=async(req,res)=>{
    try{
        await Notification.deleteMany({userId:req.result._id});
        res.status(200).json({message:"Notifications cleared"});
    }
    catch(err){
        res.status(500).json({error:err.message});
    }
};

module.exports={listNotifications,markRead,markAllRead,clearAll};
