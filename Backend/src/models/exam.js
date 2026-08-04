const mongoose=require('mongoose');
const {Schema}=mongoose;

const examSchema=new Schema({
    title:{
        type:String,
        required:true,
        trim:true
    },
    subjectId:{
        type:Schema.Types.ObjectId,
        ref:'subject',
        required:true
    },
    classId:{
        type:Schema.Types.ObjectId,
        ref:'class',
        required:true
    },
    createdBy:{
        type:Schema.Types.ObjectId,
        ref:'user',
        required:true
    },
    term:{
        type:String,
        enum:['unit-1','unit-2','midterm','final','other'],
        default:'other'
    },
    startTime:{
        type:Date,
        required:true
    },
    endTime:{
        type:Date,
        required:true
    },
    maxMarks:{
        type:Number,
        required:true,
        min:1
    },
    passMarks:{
        type:Number,
        default:33
    },
    room:{
        type:String,
        default:''
    },
    resultsPublished:{
        type:Boolean,
        default:false
    }
},{
    timestamps:true
});

examSchema.index({classId:1,startTime:-1});

examSchema.post('findOneAndDelete',async function(exam){
    if(exam){
        await mongoose.model('result').deleteMany({examId:exam._id});
    }
});

const Exam=mongoose.model("exam",examSchema);
module.exports=Exam;
