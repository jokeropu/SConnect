const mongoose=require('mongoose');
const {Schema}=mongoose;

const assignmentSchema=new Schema({
    title:{
        type:String,
        required:true,
        trim:true
    },
    description:{
        type:String,
        default:''
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
    teacherId:{
        type:Schema.Types.ObjectId,
        ref:'user',
        required:true
    },
    attachmentUrl:{
        type:String,
        default:null
    },
    attachmentPublicId:{
        type:String,
        default:null
    },
    maxMarks:{
        type:Number,
        default:100,
        min:1
    },
    startDate:{
        type:Date,
        default:Date.now
    },
    dueDate:{
        type:Date,
        required:true
    }
},{
    timestamps:true
});

assignmentSchema.index({classId:1,dueDate:-1});

assignmentSchema.post('findOneAndDelete',async function(assignment){
    if(assignment){
        await mongoose.model('submission').deleteMany({assignmentId:assignment._id});
    }
});

const Assignment=mongoose.model("assignment",assignmentSchema);
module.exports=Assignment;
