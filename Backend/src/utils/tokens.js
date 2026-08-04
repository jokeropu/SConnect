const jwt=require('jsonwebtoken');
const crypto=require('crypto');
const redisClient=require('../config/redis');
const {ACCESS_TOKEN_TTL,REFRESH_TOKEN_TTL,REFRESH_TOKEN_MS,REDIS_PREFIX}=require('../config/appConfig');

const isProd=process.env.NODE_ENV==='production';

const sessionKey=(userId,familyId)=>`${REDIS_PREFIX}refresh:${userId}:${familyId}`;
const familySetKey=(userId)=>`${REDIS_PREFIX}families:${userId}`;

const refreshCookieOptions=(maxAge)=>({
    maxAge,
    httpOnly:true,
    secure:isProd,
    sameSite:isProd?'none':'lax',
    path:'/'
});

const signAccessToken=(user)=>{
    return jwt.sign(
        {_id:user._id,email:user.email,role:user.role,status:user.status},
        process.env.JWT_ACCESS_KEY,
        {expiresIn:ACCESS_TOKEN_TTL}
    );
};

const signRefreshToken=(user,familyId)=>{
    return jwt.sign(
        {_id:user._id,familyId},
        process.env.JWT_REFRESH_KEY,
        {expiresIn:REFRESH_TOKEN_TTL}
    );
};

const issueTokens=async(user,res)=>{
    const familyId=crypto.randomUUID();
    const accessToken=signAccessToken(user);
    const refreshToken=signRefreshToken(user,familyId);

    await redisClient.set(sessionKey(user._id,familyId),'valid',{PX:REFRESH_TOKEN_MS});
    await redisClient.sAdd(familySetKey(user._id),familyId);
    await redisClient.pExpire(familySetKey(user._id),REFRESH_TOKEN_MS);

    res.cookie('refreshToken',refreshToken,refreshCookieOptions(REFRESH_TOKEN_MS));
    return accessToken;
};

const rotateTokens=async(user,familyId,res)=>{
    await revokeFamily(user._id,familyId);
    return await issueTokens(user,res);
};

const revokeFamily=async(userId,familyId)=>{
    await redisClient.del(sessionKey(userId,familyId));
    await redisClient.sRem(familySetKey(userId),familyId);
};

const revokeAllForUser=async(userId)=>{
    const familyIds=await redisClient.sMembers(familySetKey(userId));
    if(familyIds.length>0){
        await redisClient.del(familyIds.map((familyId)=>sessionKey(userId,familyId)));
    }
    await redisClient.del(familySetKey(userId));
};

const clearRefreshCookie=(res)=>{
    res.cookie('refreshToken',null,{...refreshCookieOptions(0),expires:new Date(0)});
};

module.exports={signAccessToken,signRefreshToken,issueTokens,rotateTokens,revokeFamily,revokeAllForUser,clearRefreshCookie,refreshCookieOptions,sessionKey};
