const authorize=(...roles)=>{
    return (req,res,next)=>{
        if(!req.result){
            return res.status(401).json({error:"Not authenticated"});
        }
        if(!roles.includes(req.result.role)){
            return res.status(403).json({error:"You do not have permission to perform this action"});
        }
        next();
    };
};

module.exports=authorize;
