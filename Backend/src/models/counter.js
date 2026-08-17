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

// A fresh counter starts at 1, which collides if rows numbered by an earlier
// counter still exist. highestSoFar lets the caller say where the sequence has
// actually reached, and is consulted only the first time a key is used.
counterSchema.statics.next=async function(key,highestSoFar){
    const counter=await this.findOneAndUpdate(
        {_id:key},
        {$inc:{seq:1}},
        {new:true,upsert:true,setDefaultsOnInsert:true}
    );

    if(counter.seq===1 && typeof highestSoFar==='function'){
        const floor=await highestSoFar();
        if(floor>=1){
            const bumped=await this.findOneAndUpdate({_id:key},{$set:{seq:floor+1}},{new:true});
            return bumped.seq;
        }
    }

    return counter.seq;
};

const Counter=mongoose.model("counter",counterSchema);
module.exports=Counter;
