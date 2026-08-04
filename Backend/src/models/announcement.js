const mongoose=require('mongoose');
const {Schema}=mongoose;

const announcementSchema=new Schema({
    title:{
        type:String,
        required:true,
        trim:true
    },
    body:{
        type:String,
        required:true
    },
    scope:{
        type:String,
        enum:['global','class'],
        default:'global'
    },
    classId:{
        type:Schema.Types.ObjectId,
        ref:'class',
        default:null
    },
    authorId:{
        type:Schema.Types.ObjectId,
        ref:'user',
        required:true
    },
    pinned:{
        type:Boolean,
        default:false
    },
    urgent:{
        type:Boolean,
        default:false
    }
},{
    timestamps:true
});

announcementSchema.index({scope:1,classId:1,createdAt:-1});

const Announcement=mongoose.model("announcement",announcementSchema);
module.exports=Announcement;
