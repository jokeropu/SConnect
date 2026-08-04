const mongoose=require('mongoose');
const {Schema}=mongoose;
const {ATTENDANCE_STATUS}=require('../config/appConfig');

const attendanceSchema=new Schema({
    classId:{
        type:Schema.Types.ObjectId,
        ref:'class',
        required:true
    },
    lessonId:{
        type:Schema.Types.ObjectId,
        ref:'lesson',
        default:null
    },
    date:{
        type:String,
        required:true
    },
    takenBy:{
        type:Schema.Types.ObjectId,
        ref:'user',
        required:true
    },
    records:[{
        studentId:{
            type:Schema.Types.ObjectId,
            ref:'user',
            required:true
        },
        status:{
            type:String,
            enum:ATTENDANCE_STATUS,
            default:'present'
        },
        note:{
            type:String,
            default:''
        }
    }]
},{
    timestamps:true
});

attendanceSchema.index({classId:1,date:1,lessonId:1},{unique:true});
attendanceSchema.index({'records.studentId':1});

const Attendance=mongoose.model("attendance",attendanceSchema);
module.exports=Attendance;
