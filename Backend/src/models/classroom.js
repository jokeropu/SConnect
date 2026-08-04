const mongoose=require('mongoose');
const {Schema}=mongoose;

const classSchema=new Schema({
    name:{
        type:String,
        required:true,
        trim:true,
        unique:true
    },
    gradeLevel:{
        type:Number,
        required:true,
        min:1,
        max:12
    },
    section:{
        type:String,
        default:'A',
        uppercase:true,
        trim:true
    },
    capacity:{
        type:Number,
        required:true,
        min:1,
        max:200
    },
    academicYear:{
        type:String,
        required:true
    },
    supervisorId:{
        type:Schema.Types.ObjectId,
        ref:'user',
        default:null
    },
    subjects:[{
        type:Schema.Types.ObjectId,
        ref:'subject'
    }]
},{
    timestamps:true
});

classSchema.index({gradeLevel:1,section:1});

const Classroom=mongoose.model("class",classSchema);
module.exports=Classroom;
