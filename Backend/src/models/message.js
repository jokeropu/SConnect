const mongoose=require('mongoose');
const {Schema}=mongoose;

const messageSchema=new Schema({
    conversationId:{
        type:Schema.Types.ObjectId,
        ref:'conversation',
        required:true
    },
    senderId:{
        type:Schema.Types.ObjectId,
        ref:'user',
        required:true
    },
    text:{
        type:String,
        default:''
    },
    attachmentUrl:{
        type:String,
        default:null
    },
    readBy:[{
        type:Schema.Types.ObjectId,
        ref:'user'
    }]
},{
    timestamps:true
});

messageSchema.index({conversationId:1,createdAt:1});

const Message=mongoose.model("message",messageSchema);
module.exports=Message;
