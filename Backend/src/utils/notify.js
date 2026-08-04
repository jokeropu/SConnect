const Notification=require('../models/notification');

let io=null;

const registerIo=(server)=>{
    io=server;
};

const notify=async(userId,type,title,message,link=null)=>{
    try{
        const created=await Notification.create({userId,type,title,message,link});
        if(io){
            io.to(`user:${userId}`).emit('notification',created);
        }
        return created;
    }
    catch(err){
        console.error(`Failed to create notification (${type}) for user ${userId}:`,err.message);
        return null;
    }
};

const notifyMany=async(userIds,type,title,message,link=null)=>{
    const unique=[...new Set(userIds.map((id)=>String(id)))];
    for(const userId of unique){
        await notify(userId,type,title,message,link);
    }
};

module.exports=notify;
module.exports.notifyMany=notifyMany;
module.exports.registerIo=registerIo;
