const jwt=require('jsonwebtoken');
const User=require('../models/user');

const authenticate=async(req,res,next)=>{
    try{
        const header=req.headers.authorization || '';
        if(!header.startsWith('Bearer ')){
            throw new Error("Access token is not present");
        }

        const token=header.slice(7);
        const payload=jwt.verify(token,process.env.JWT_ACCESS_KEY);

        const {_id}=payload;
        if(!_id){
            throw new Error("Id is missing");
        }

        const result=await User.findById(_id).select('-password');
        if(!result){
            throw new Error("User not found");
        }
        if(result.status==='suspended'){
            throw new Error("Account is suspended");
        }
        if(result.status==='pending'){
            throw new Error("Account is awaiting admin approval");
        }

        req.result=result;
        next();
    }
    catch(err){
        res.status(401).json({error:err.message});
    }
};

module.exports=authenticate;
