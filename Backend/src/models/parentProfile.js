const mongoose=require('mongoose');
const {Schema}=mongoose;

const parentProfileSchema=new Schema({
    userId:{
        type:Schema.Types.ObjectId,
        ref:'user',
        required:true,
        unique:true
    },
    children:[{
        type:Schema.Types.ObjectId,
        ref:'user'
    }],
    occupation:{
        type:String,
        default:''
    }
},{
    timestamps:true
});

const ParentProfile=mongoose.model("parentProfile",parentProfileSchema);
module.exports=ParentProfile;
