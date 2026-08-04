const mongoose=require('mongoose');
const {Schema}=mongoose;

const teacherProfileSchema=new Schema({
    userId:{
        type:Schema.Types.ObjectId,
        ref:'user',
        required:true,
        unique:true
    },
    employeeId:{
        type:String,
        unique:true,
        sparse:true
    },
    subjects:[{
        type:Schema.Types.ObjectId,
        ref:'subject'
    }],
    classes:[{
        type:Schema.Types.ObjectId,
        ref:'class'
    }],
    qualifications:{
        type:String,
        default:''
    },
    bio:{
        type:String,
        maxlength:600,
        default:''
    },
    joinedAt:{
        type:Date,
        default:Date.now
    }
},{
    timestamps:true
});

const TeacherProfile=mongoose.model("teacherProfile",teacherProfileSchema);
module.exports=TeacherProfile;
