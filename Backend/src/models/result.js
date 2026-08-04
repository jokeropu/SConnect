const mongoose=require('mongoose');
const {Schema}=mongoose;

const resultSchema=new Schema({
    examId:{
        type:Schema.Types.ObjectId,
        ref:'exam',
        default:null
    },
    assignmentId:{
        type:Schema.Types.ObjectId,
        ref:'assignment',
        default:null
    },
    studentId:{
        type:Schema.Types.ObjectId,
        ref:'user',
        required:true
    },
    marksObtained:{
        type:Number,
        required:true,
        min:0
    },
    maxMarks:{
        type:Number,
        required:true,
        min:1
    },
    percentage:{
        type:Number,
        default:0
    },
    grade:{
        type:String,
        default:'F'
    },
    points:{
        type:Number,
        default:0
    },
    remarks:{
        type:String,
        default:''
    },
    enteredBy:{
        type:Schema.Types.ObjectId,
        ref:'user',
        required:true
    }
},{
    timestamps:true
});

resultSchema.index({studentId:1,examId:1});

const Result=mongoose.model("result",resultSchema);
module.exports=Result;
