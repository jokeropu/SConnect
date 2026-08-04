const jwt=require('jsonwebtoken');
const {Server}=require('socket.io');
const Conversation=require('../models/conversation');
const Message=require('../models/message');
const {registerIo}=require('../utils/notify');

const attachSockets=(httpServer,allowedOrigins)=>{
    const io=new Server(httpServer,{
        cors:{
            origin:allowedOrigins,
            credentials:true
        }
    });

    io.use((socket,next)=>{
        try{
            const token=socket.handshake.auth?.token;
            if(!token){
                return next(new Error("Access token is not present"));
            }
            const payload=jwt.verify(token,process.env.JWT_ACCESS_KEY);
            socket.userId=payload._id;
            socket.role=payload.role;
            next();
        }
        catch(err){
            next(new Error("Socket authentication failed"));
        }
    });

    io.on('connection',(socket)=>{
        socket.join(`user:${socket.userId}`);

        socket.on('conversation:join',async(conversationId)=>{
            const conversation=await Conversation.findById(conversationId).select('participants');
            if(conversation?.participants.some((p)=>String(p)===String(socket.userId))){
                socket.join(`conversation:${conversationId}`);
            }
        });

        socket.on('conversation:leave',(conversationId)=>{
            socket.leave(`conversation:${conversationId}`);
        });

        socket.on('message:send',async({conversationId,text},ack)=>{
            try{
                const conversation=await Conversation.findById(conversationId);
                if(!conversation || !conversation.participants.some((p)=>String(p)===String(socket.userId))){
                    throw new Error("You are not part of this conversation");
                }

                const trimmed=(text || '').trim();
                if(!trimmed){
                    throw new Error("Message cannot be empty");
                }

                const message=await Message.create({
                    conversationId,
                    senderId:socket.userId,
                    text:trimmed,
                    readBy:[socket.userId]
                });
                await message.populate('senderId','firstName lastName avatarUrl');

                const recipientId=conversation.participants.find((p)=>String(p)!==String(socket.userId));
                conversation.lastMessage=trimmed.slice(0,140);
                conversation.lastMessageAt=new Date();
                conversation.unread.set(String(recipientId),(conversation.unread.get(String(recipientId)) || 0)+1);
                await conversation.save();

                io.to(`conversation:${conversationId}`).emit('message:new',message);
                io.to(`user:${recipientId}`).emit('conversation:bump',{conversationId,lastMessage:conversation.lastMessage});

                if(ack) ack({ok:true,message});
            }
            catch(err){
                if(ack) ack({ok:false,error:err.message});
            }
        });

        socket.on('typing',({conversationId,typing})=>{
            socket.to(`conversation:${conversationId}`).emit('typing',{userId:socket.userId,typing});
        });
    });

    registerIo(io);
    return io;
};

module.exports=attachSockets;
