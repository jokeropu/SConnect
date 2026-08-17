const crypto=require('crypto');
const {OAuth2Client}=require('google-auth-library');
const bcrypt=require('bcrypt');
const jwt=require('jsonwebtoken');
const validator=require('validator');
const User=require('../models/user');
const StudentProfile=require('../models/studentProfile');
const TeacherProfile=require('../models/teacherProfile');
const ParentProfile=require('../models/parentProfile');
const {validateRegistration}=require('../utils/validate');
const verifyTurnstileToken=require('../utils/verifyTurnstile');
const sendEmail=require('../utils/sendEmail');
const notify=require('../utils/notify');
const {issueTokens,rotateTokens,revokeFamily,revokeAllForUser,clearRefreshCookie,sessionKey}=require('../utils/tokens');
const {RESET_TOKEN_MS}=require('../config/appConfig');
const redisClient=require('../config/redis');

const googleClient=new OAuth2Client(process.env.OAUTH_CLIENT_ID);

const publicUser=(user)=>({
    _id:user._id,
    memberId:user.memberId,
    firstName:user.firstName,
    lastName:user.lastName,
    email:user.email,
    role:user.role,
    status:user.status,
    phone:user.phone,
    address:user.address,
    avatarUrl:user.avatarUrl,
    sex:user.sex,
    birthday:user.birthday
});

const createProfileFor=async(user)=>{
    if(user.role==='teacher'){
        await TeacherProfile.create({userId:user._id});
    }
    if(user.role==='student'){
        await StudentProfile.create({userId:user._id});
    }
    if(user.role==='parent'){
        await ParentProfile.create({userId:user._id});
    }
};

const register=async(req,res)=>{
    try{
        const verification=await verifyTurnstileToken(req.body.turnstileToken,req.ip);
        if(!verification.success){
            return res.status(400).json({error:"Human verification failed"});
        }

        validateRegistration(req.body);
        const {firstName,lastName,email,password,phone}=req.body;

        const existing=await User.findOne({email:email.trim().toLowerCase()});
        if(existing){
            return res.status(409).json({error:"An account with that email already exists"});
        }

        const user=await User.create({
            firstName,
            lastName:lastName || '',
            email,
            phone:phone || null,
            password:await bcrypt.hash(password,10),
            role:'student',
            status:'pending'
        });

        await createProfileFor(user);

        res.status(201).json({
            user:publicUser(user),
            message:"Account created. An administrator must approve it before you can sign in."
        });
    }
    catch(err){
        res.status(400).json({error:err.message});
    }
};

const login=async(req,res)=>{
    try{
        const {email,password,turnstileToken}=req.body;

        const verification=await verifyTurnstileToken(turnstileToken,req.ip);
        if(!verification.success){
            throw new Error("Human verification failed");
        }
        if(!email || !password){
            throw new Error("Invalid credentials");
        }

        const user=await User.findOne({email:email.trim().toLowerCase()});
        if(!user){
            throw new Error("Invalid credentials");
        }

        const match=await bcrypt.compare(password,user.password);
        if(!match){
            throw new Error("Invalid credentials");
        }
        if(user.status==='pending'){
            return res.status(403).json({error:"Your account is still awaiting admin approval"});
        }
        if(user.status==='suspended'){
            return res.status(403).json({error:"Your account has been suspended. Contact an administrator."});
        }

        user.lastLoginAt=new Date();
        await user.save();

        const accessToken=await issueTokens(user,res);

        res.status(200).json({
            user:publicUser(user),
            accessToken,
            message:"Logged in successfully"
        });
    }
    catch(err){
        res.status(401).json({error:err.message});
    }
};

const refresh=async(req,res)=>{
    try{
        const {refreshToken}=req.cookies;
        if(!refreshToken){
            throw new Error("Refresh token is not present");
        }

        const payload=jwt.verify(refreshToken,process.env.JWT_REFRESH_KEY);
        const {_id,familyId}=payload;

        const stored=await redisClient.get(sessionKey(_id,familyId));
        if(!stored){
            await revokeAllForUser(_id);
            clearRefreshCookie(res);
            throw new Error("Refresh token has been revoked");
        }

        const user=await User.findById(_id);
        if(!user || user.status!=='approved'){
            throw new Error("Account is no longer active");
        }

        const accessToken=await rotateTokens(user,familyId,res);

        res.status(200).json({
            user:publicUser(user),
            accessToken
        });
    }
    catch(err){
        res.status(401).json({error:err.message});
    }
};

const logout=async(req,res)=>{
    try{
        const {refreshToken}=req.cookies;
        if(refreshToken){
            const payload=jwt.decode(refreshToken);
            if(payload?._id && payload?.familyId){
                await revokeFamily(payload._id,payload.familyId);
            }
        }
        clearRefreshCookie(res);
        res.status(200).json({message:"Logged out successfully"});
    }
    catch(err){
        res.status(500).json({error:err.message});
    }
};

const me=async(req,res)=>{
    try{
        res.status(200).json({user:publicUser(req.result)});
    }
    catch(err){
        res.status(500).json({error:err.message});
    }
};

const googleAuth=async(req,res)=>{
    try{
        if(!process.env.OAUTH_CLIENT_ID){
            return res.status(503).json({error:"Google sign-in is not configured on this server"});
        }

        const {credential}=req.body;
        if(!credential){
            throw new Error("Missing Google credential");
        }

        const ticket=await googleClient.verifyIdToken({
            idToken:credential,
            audience:process.env.OAUTH_CLIENT_ID
        });
        const payload=ticket.getPayload();

        if(!payload.email_verified){
            throw new Error("That Google account has no verified email");
        }

        const email=payload.email.trim().toLowerCase();
        let user=await User.findOne({email});
        let created=false;

        if(user){
            if(!user.googleId){
                user.googleId=payload.sub;
                await user.save();
            }
        }
        else{
            const randomPassword=await bcrypt.hash(crypto.randomBytes(32).toString('hex'),10);

            let firstName=payload.given_name || payload.name || 'Student';
            if(firstName.length<2) firstName='Student';

            user=await User.create({
                firstName,
                lastName:payload.family_name || '',
                email,
                password:randomPassword,
                googleId:payload.sub,
                avatarUrl:payload.picture || null,
                role:'student',
                status:'pending'
            });

            await createProfileFor(user);
            created=true;
        }

        if(user.status==='pending'){
            return res.status(403).json({
                error:created
                    ?"Account created. An administrator must approve it before you can sign in."
                    :"Your account is still awaiting admin approval"
            });
        }
        if(user.status==='suspended'){
            return res.status(403).json({error:"Your account has been suspended. Contact an administrator."});
        }

        user.lastLoginAt=new Date();
        await user.save();

        const accessToken=await issueTokens(user,res);

        res.status(200).json({
            user:publicUser(user),
            accessToken,
            message:"Signed in with Google"
        });
    }
    catch(err){
        res.status(401).json({error:"Google authentication failed: "+err.message});
    }
};

const forgotPassword=async(req,res)=>{
    try{
        const {email}=req.body;
        if(!email){
            throw new Error("Email is required");
        }

        const user=await User.findOne({email:email.trim().toLowerCase()});

        if(user){
            const rawToken=crypto.randomBytes(32).toString('hex');
            const hashedToken=crypto.createHash('sha256').update(rawToken).digest('hex');

            user.resetPasswordToken=hashedToken;
            user.resetPasswordExpires=Date.now()+RESET_TOKEN_MS;
            await user.save();

            const clientUrl=(process.env.CLIENT_URL || 'http://localhost:5174').split(',')[0].trim();
            const resetLink=`${clientUrl}/reset-password/${rawToken}`;

            await sendEmail({
                to:user.email,
                subject:"Reset your SConnect password",
                html:`<p>You requested a password reset. This link expires in 30 minutes.</p><p><a href="${resetLink}">${resetLink}</a></p><p>If you didn't request this, you can safely ignore this email.</p>`
            });
        }

        res.status(200).json({message:"If that email is registered, a reset link has been sent."});
    }
    catch(err){
        res.status(400).json({error:err.message});
    }
};

const resetPassword=async(req,res)=>{
    try{
        const {token}=req.params;
        const {password}=req.body;

        if(!validator.isStrongPassword(password || '')){
            throw new Error("Password must be at least 8 characters with uppercase, lowercase, number and symbol");
        }

        const hashedToken=crypto.createHash('sha256').update(token).digest('hex');

        const user=await User.findOne({
            resetPasswordToken:hashedToken,
            resetPasswordExpires:{$gt:Date.now()}
        });

        if(!user){
            throw new Error("Reset link is invalid or has expired");
        }

        user.password=await bcrypt.hash(password,10);
        user.resetPasswordToken=null;
        user.resetPasswordExpires=null;
        await user.save();

        await revokeAllForUser(user._id);
        await notify(user._id,'password_reset','Password reset successful','Your password was changed. If this was not you, contact an administrator immediately.');

        res.status(200).json({message:"Password has been reset successfully"});
    }
    catch(err){
        res.status(400).json({error:err.message});
    }
};

const changePassword=async(req,res)=>{
    try{
        const {currentPassword,newPassword}=req.body;
        const user=await User.findById(req.result._id);

        const match=await bcrypt.compare(currentPassword || '',user.password);
        if(!match){
            throw new Error("Current password is incorrect");
        }
        if(!validator.isStrongPassword(newPassword || '')){
            throw new Error("New password is too weak");
        }

        user.password=await bcrypt.hash(newPassword,10);
        await user.save();

        await revokeAllForUser(user._id);
        clearRefreshCookie(res);

        res.status(200).json({message:"Password changed. Please sign in again."});
    }
    catch(err){
        res.status(400).json({error:err.message});
    }
};

module.exports={register,login,googleAuth,refresh,logout,me,forgotPassword,resetPassword,changePassword,publicUser,createProfileFor};
