const rateLimit=require('express-rate-limit');

const authLimiter=rateLimit({
    windowMs:15*60*1000,
    limit:20,
    standardHeaders:'draft-7',
    legacyHeaders:false,
    message:{error:"Too many attempts. Please try again in a few minutes."}
});

const apiLimiter=rateLimit({
    windowMs:60*1000,
    limit:200,
    standardHeaders:'draft-7',
    legacyHeaders:false,
    message:{error:"Too many requests. Please slow down."}
});

module.exports={authLimiter,apiLimiter};
