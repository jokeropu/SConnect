const mongoose=require('mongoose');
const {Schema}=mongoose;

const materialSchema=new Schema({
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
        default:null
    },
    uploadedBy:{
        type:Schema.Types.ObjectId,
        ref:'user',
        required:true
    },
    fileUrl:{
        type:String,
        required:true
    },
    filePublicId:{
        type:String,
        default:null
    },
    fileType:{
        type:String,
        default:'raw'
    },
    downloads:{
        type:Number,
        default:0
    }
},{
    timestamps:true
});

materialSchema.index({subjectId:1,classId:1});

const Material=mongoose.model("material",materialSchema);
module.exports=Material;
