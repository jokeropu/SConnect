const mongoose=require('mongoose');
const {Schema}=mongoose;

const conversationSchema=new Schema({
    participants:[{
        type:Schema.Types.ObjectId,
        ref:'user',
        required:true
    }],
    lastMessage:{
        type:String,
        default:''
    },
    lastMessageAt:{
        type:Date,
        default:Date.now
    },
    unread:{
        type:Map,
        of:Number,
        default:{}
    }
},{
    timestamps:true
});

conversationSchema.index({participants:1,lastMessageAt:-1});

conversationSchema.post('findOneAndDelete',async function(conversation){
    if(conversation){
        await mongoose.model('message').deleteMany({conversationId:conversation._id});
    }
});

const Conversation=mongoose.model("conversation",conversationSchema);
module.exports=Conversation;
