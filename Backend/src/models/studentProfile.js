const mongoose=require('mongoose');
const {Schema}=mongoose;

const studentProfileSchema=new Schema({
    userId:{
        type:Schema.Types.ObjectId,
        ref:'user',
        required:true,
        unique:true
    },
    rollNumber:{
        type:String,
        unique:true,
        sparse:true
    },
    classId:{
        type:Schema.Types.ObjectId,
        ref:'class',
        default:null
    },
    parentId:{
        type:Schema.Types.ObjectId,
        ref:'user',
        default:null
    },
    admissionDate:{
        type:Date,
        default:Date.now
    },
    guardianPhone:{
        type:String,
        default:null
    }
},{
    timestamps:true
});

studentProfileSchema.index({classId:1});
studentProfileSchema.index({parentId:1});

const StudentProfile=mongoose.model("studentProfile",studentProfileSchema);
module.exports=StudentProfile;
