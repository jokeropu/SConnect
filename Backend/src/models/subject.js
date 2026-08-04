const mongoose=require('mongoose');
const {Schema}=mongoose;

const subjectSchema=new Schema({
    name:{
        type:String,
        required:true,
        trim:true,
        unique:true
    },
    code:{
        type:String,
        required:true,
        unique:true,
        uppercase:true,
        trim:true
    },
    description:{
        type:String,
        default:''
    },
    teachers:[{
        type:Schema.Types.ObjectId,
        ref:'user'
    }],
    classes:[{
        type:Schema.Types.ObjectId,
        ref:'class'
    }]
},{
    timestamps:true
});

const Subject=mongoose.model("subject",subjectSchema);
module.exports=Subject;
