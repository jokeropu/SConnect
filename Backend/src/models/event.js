const mongoose=require('mongoose');
const {Schema}=mongoose;

const eventSchema=new Schema({
    title:{
        type:String,
        required:true,
        trim:true
    },
    description:{
        type:String,
        default:''
    },
    audience:{
        type:String,
        enum:['all','class'],
        default:'all'
    },
    classId:{
        type:Schema.Types.ObjectId,
        ref:'class',
        default:null
    },
    category:{
        type:String,
        enum:['general','exam','holiday','meeting','sports','cultural'],
        default:'general'
    },
    startTime:{
        type:Date,
        required:true
    },
    endTime:{
        type:Date,
        required:true
    },
    createdBy:{
        type:Schema.Types.ObjectId,
        ref:'user',
        required:true
    }
},{
    timestamps:true
});

eventSchema.index({startTime:1});

const Event=mongoose.model("event",eventSchema);
module.exports=Event;
