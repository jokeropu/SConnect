const mongoose=require('mongoose');
const {Schema}=mongoose;

const submissionSchema=new Schema({
    assignmentId:{
        type:Schema.Types.ObjectId,
        ref:'assignment',
        required:true
    },
    studentId:{
        type:Schema.Types.ObjectId,
        ref:'user',
        required:true
    },
    textAnswer:{
        type:String,
        default:''
    },
    fileUrl:{
        type:String,
        default:null
    },
    filePublicId:{
        type:String,
        default:null
    },
    status:{
        type:String,
        enum:['submitted','late','graded'],
        default:'submitted'
    },
    marksObtained:{
        type:Number,
        default:null
    },
    feedback:{
        type:String,
        default:''
    },
    gradedBy:{
        type:Schema.Types.ObjectId,
        ref:'user',
        default:null
    },
    gradedAt:{
        type:Date,
        default:null
    },
    submittedAt:{
        type:Date,
        default:Date.now
    }
},{
    timestamps:true
});

submissionSchema.index({assignmentId:1,studentId:1},{unique:true});

const Submission=mongoose.model("submission",submissionSchema);
module.exports=Submission;
