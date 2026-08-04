const mongoose=require('mongoose');
const {Schema}=mongoose;
const {DAYS}=require('../config/appConfig');

const lessonSchema=new Schema({
    name:{
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
    teacherId:{
        type:Schema.Types.ObjectId,
        ref:'user',
        required:true
    },
    day:{
        type:String,
        enum:DAYS,
        required:true
    },
    startTime:{
        type:String,
        required:true
    },
    endTime:{
        type:String,
        required:true
    },
    room:{
        type:String,
        default:''
    }
},{
    timestamps:true
});

lessonSchema.index({classId:1,day:1});
lessonSchema.index({teacherId:1});

const Lesson=mongoose.model("lesson",lessonSchema);
module.exports=Lesson;
