const notFound=(req,res)=>{
    res.status(404).json({error:`Route not found: ${req.method} ${req.originalUrl}`});
};

const errorHandler=(err,req,res,next)=>{
    if(res.headersSent){
        return next(err);
    }

    if(err.name==='ValidationError'){
        const message=Object.values(err.errors).map((e)=>e.message).join(', ');
        return res.status(400).json({error:message});
    }
    if(err.code===11000){
        const field=Object.keys(err.keyValue || {})[0] || 'value';
        return res.status(409).json({error:`That ${field} is already in use`});
    }
    if(err.name==='CastError'){
        return res.status(400).json({error:`Invalid ${err.path}`});
    }

    console.error('Unhandled error:',err);
    res.status(err.status || 500).json({error:err.message || "Internal Server Error"});
};

module.exports={notFound,errorHandler};
