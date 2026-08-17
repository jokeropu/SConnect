const mongoose=require('mongoose');
const {Schema}=mongoose;

const counterSchema=new Schema({
    _id:{
        type:String
    },
    seq:{
        type:Number,
        default:0
    }
},{
    versionKey:false
});

counterSchema.statics.next=async function(key){
    const counter=await this.findOneAndUpdate(
        {_id:key},
        {$inc:{seq:1}},
        {new:true,upsert:true,setDefaultsOnInsert:true}
    );
    return counter.seq;
};

const Counter=mongoose.model("counter",counterSchema);
module.exports=Counter;
