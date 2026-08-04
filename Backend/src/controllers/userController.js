const bcrypt=require('bcrypt');
const User=require('../models/user');
const TeacherProfile=require('../models/teacherProfile');
const StudentProfile=require('../models/studentProfile');
const ParentProfile=require('../models/parentProfile');
const Classroom=require('../models/classroom');
const cloudinary=require('../config/cloudinary');
const notify=require('../utils/notify');
const {validateRegistration,requireFields}=require('../utils/validate');
const {parsePaging,buildMeta,searchRegex}=require('../utils/pagination');
const {publicUser,createProfileFor}=require('./authController');
const {visibleStudentIds,classIdsForTeacher}=require('../utils/scope');

const listUsers=async(req,res)=>{
    try{
        const {page,limit,skip}=parsePaging(req.query);
        const {role,status,search,classId}=req.query;

        const query={};
        if(role) query.role=role;
        if(status) query.status=status;

        if(search){
            const rx=searchRegex(search);
            query.$or=[{firstName:rx},{lastName:rx},{email:rx},{phone:rx}];
        }

        if(classId){
            const profiles=await StudentProfile.find({classId}).select('userId');
            query._id={$in:profiles.map((p)=>p.userId)};
        }

        if(req.result.role!=='admin'){
            const allowed=await visibleStudentIds(req.result);
            if(allowed!==null){
                query._id=query._id?{$in:(query._id.$in || []).filter((id)=>allowed.includes(String(id)))}:{$in:allowed};
            }
        }

        const [users,total]=await Promise.all([
            User.find(query).select('-password').sort({createdAt:-1}).skip(skip).limit(limit),
            User.countDocuments(query)
        ]);

        res.status(200).json({data:users.map(publicUser),meta:buildMeta(page,limit,total)});
    }
    catch(err){
        res.status(500).json({error:err.message});
    }
};

const getUserById=async(req,res)=>{
    try{
        const user=await User.findById(req.params.id).select('-password');
        if(!user){
            return res.status(404).json({error:"User not found"});
        }

        let profile=null;

        if(user.role==='student'){
            profile=await StudentProfile.findOne({userId:user._id}).populate('classId','name gradeLevel section').populate('parentId','firstName lastName email phone');
        }
        else if(user.role==='teacher'){
            profile=await TeacherProfile.findOne({userId:user._id}).populate('subjects','name code').populate('classes','name gradeLevel section');
        }
        else if(user.role==='parent'){
            profile=await ParentProfile.findOne({userId:user._id}).populate('children','firstName lastName email avatarUrl');
        }

        res.status(200).json({user:publicUser(user),profile});
    }
    catch(err){
        res.status(500).json({error:err.message});
    }
};

const createUser=async(req,res)=>{
    try{
        requireFields(req.body,['firstName','email','password','role']);
        validateRegistration(req.body);

        const {firstName,lastName,email,password,role,phone,address,sex,bloodType,birthday,status}=req.body;

        if(!['admin','teacher','student','parent'].includes(role)){
            throw new Error("Invalid role");
        }

        const existing=await User.findOne({email:email.trim().toLowerCase()});
        if(existing){
            return res.status(409).json({error:"An account with that email already exists"});
        }

        const user=await User.create({
            firstName,
            lastName:lastName || '',
            email,
            password:await bcrypt.hash(password,10),
            role,
            status:status || 'approved',
            phone:phone || null,
            address:address || '',
            sex:sex || 'other',
            bloodType:bloodType || '',
            birthday:birthday || null
        });

        await createProfileFor(user);

        if(role==='student' && req.body.classId){
            await StudentProfile.findOneAndUpdate({userId:user._id},{$set:{classId:req.body.classId,rollNumber:req.body.rollNumber || null,parentId:req.body.parentId || null}});
        }
        if(role==='teacher' && Array.isArray(req.body.subjects)){
            await TeacherProfile.findOneAndUpdate({userId:user._id},{$set:{subjects:req.body.subjects,classes:req.body.classes || []}});
        }
        if(role==='parent' && Array.isArray(req.body.children)){
            await ParentProfile.findOneAndUpdate({userId:user._id},{$set:{children:req.body.children}});
            await StudentProfile.updateMany({userId:{$in:req.body.children}},{$set:{parentId:user._id}});
        }

        await notify(user._id,'account_approved','Welcome to SConnect',`Your ${role} account has been created by an administrator.`,'/');

        res.status(201).json({user:publicUser(user),message:"User created successfully"});
    }
    catch(err){
        res.status(400).json({error:err.message});
    }
};

const updateUser=async(req,res)=>{
    try{
        const {id}=req.params;
        const allowed=['firstName','lastName','phone','address','sex','bloodType','birthday','avatarUrl','status','role'];

        const updates={};
        for(const key of allowed){
            if(req.body[key]!==undefined) updates[key]=req.body[key];
        }

        const user=await User.findByIdAndUpdate(id,{$set:updates},{new:true,runValidators:true}).select('-password');
        if(!user){
            return res.status(404).json({error:"User not found"});
        }

        if(user.role==='student'){
            const profileUpdates={};
            if(req.body.classId!==undefined) profileUpdates.classId=req.body.classId || null;
            if(req.body.rollNumber!==undefined) profileUpdates.rollNumber=req.body.rollNumber;
            if(req.body.parentId!==undefined) profileUpdates.parentId=req.body.parentId || null;
            if(Object.keys(profileUpdates).length>0){
                await StudentProfile.findOneAndUpdate({userId:user._id},{$set:profileUpdates},{upsert:true});
            }
            if(req.body.parentId){
                await ParentProfile.findOneAndUpdate({userId:req.body.parentId},{$addToSet:{children:user._id}},{upsert:true});
            }
        }

        if(user.role==='teacher'){
            const profileUpdates={};
            if(req.body.subjects!==undefined) profileUpdates.subjects=req.body.subjects;
            if(req.body.classes!==undefined) profileUpdates.classes=req.body.classes;
            if(req.body.qualifications!==undefined) profileUpdates.qualifications=req.body.qualifications;
            if(req.body.bio!==undefined) profileUpdates.bio=req.body.bio;
            if(Object.keys(profileUpdates).length>0){
                await TeacherProfile.findOneAndUpdate({userId:user._id},{$set:profileUpdates},{upsert:true});
            }
        }

        if(user.role==='parent' && req.body.children!==undefined){
            await ParentProfile.findOneAndUpdate({userId:user._id},{$set:{children:req.body.children}},{upsert:true});
            await StudentProfile.updateMany({userId:{$in:req.body.children}},{$set:{parentId:user._id}});
        }

        res.status(200).json({user:publicUser(user),message:"User updated successfully"});
    }
    catch(err){
        res.status(400).json({error:err.message});
    }
};

const deleteUser=async(req,res)=>{
    try{
        const {id}=req.params;
        if(String(id)===String(req.result._id)){
            return res.status(400).json({error:"You cannot delete your own account"});
        }

        const user=await User.findById(id);
        if(!user){
            return res.status(404).json({error:"User not found"});
        }

        if(user.avatarPublicId){
            await cloudinary.uploader.destroy(user.avatarPublicId,{resource_type:'image'}).catch(()=>{});
        }

        await User.findByIdAndDelete(id);
        res.status(200).json({message:"User deleted successfully"});
    }
    catch(err){
        res.status(500).json({error:err.message});
    }
};

const setUserStatus=async(req,res)=>{
    try{
        const {id}=req.params;
        const {status}=req.body;

        if(!['pending','approved','suspended'].includes(status)){
            throw new Error("Invalid status");
        }

        const user=await User.findByIdAndUpdate(id,{$set:{status}},{new:true}).select('-password');
        if(!user){
            return res.status(404).json({error:"User not found"});
        }

        if(status==='approved'){
            await notify(user._id,'account_approved','Your account is approved','You can now sign in to SConnect.','/');
        }
        if(status==='suspended'){
            await notify(user._id,'account_suspended','Your account is suspended','Contact an administrator for details.');
        }

        res.status(200).json({user:publicUser(user),message:`User ${status}`});
    }
    catch(err){
        res.status(400).json({error:err.message});
    }
};

const updateOwnProfile=async(req,res)=>{
    try{
        const allowed=['firstName','lastName','phone','address','sex','bloodType','birthday'];
        const updates={};
        for(const key of allowed){
            if(req.body[key]!==undefined) updates[key]=req.body[key];
        }

        const user=await User.findByIdAndUpdate(req.result._id,{$set:updates},{new:true,runValidators:true}).select('-password');
        res.status(200).json({user:publicUser(user),message:"Profile updated"});
    }
    catch(err){
        res.status(400).json({error:err.message});
    }
};

const updateAvatar=async(req,res)=>{
    try{
        if(!req.file){
            return res.status(400).json({error:"No image uploaded"});
        }

        const user=await User.findById(req.result._id);
        if(user.avatarPublicId){
            await cloudinary.uploader.destroy(user.avatarPublicId,{resource_type:'image'}).catch(()=>{});
        }

        user.avatarUrl=req.file.path;
        user.avatarPublicId=req.file.filename;
        await user.save();

        res.status(200).json({user:publicUser(user),message:"Avatar updated"});
    }
    catch(err){
        res.status(400).json({error:err.message});
    }
};

const listPending=async(req,res)=>{
    try{
        const users=await User.find({status:'pending'}).select('-password').sort({createdAt:-1});
        res.status(200).json({data:users.map(publicUser)});
    }
    catch(err){
        res.status(500).json({error:err.message});
    }
};

const bulkImport=async(req,res)=>{
    try{
        const {rows,role}=req.body;
        if(!Array.isArray(rows) || rows.length===0){
            throw new Error("No rows provided");
        }
        if(!['teacher','student','parent'].includes(role)){
            throw new Error("Bulk import supports teacher, student and parent only");
        }

        const created=[];
        const failed=[];

        for(const row of rows){
            try{
                const email=String(row.email || '').trim().toLowerCase();
                const existing=await User.findOne({email});
                if(existing){
                    failed.push({email,reason:"Already exists"});
                    continue;
                }

                const password=row.password || `${role}@${Math.random().toString(36).slice(2,8)}A1!`;
                const user=await User.create({
                    firstName:row.firstName,
                    lastName:row.lastName || '',
                    email,
                    password:await bcrypt.hash(password,10),
                    role,
                    status:'approved',
                    phone:row.phone || null,
                    address:row.address || ''
                });

                await createProfileFor(user);
                created.push({email:user.email,password});
            }
            catch(rowErr){
                failed.push({email:row.email,reason:rowErr.message});
            }
        }

        res.status(201).json({created,failed,message:`Imported ${created.length} of ${rows.length}`});
    }
    catch(err){
        res.status(400).json({error:err.message});
    }
};

const linkParentChild=async(req,res)=>{
    try{
        const {parentId,studentId}=req.body;
        requireFields(req.body,['parentId','studentId']);

        await ParentProfile.findOneAndUpdate({userId:parentId},{$addToSet:{children:studentId}},{upsert:true});
        await StudentProfile.findOneAndUpdate({userId:studentId},{$set:{parentId}},{upsert:true});

        res.status(200).json({message:"Parent linked to student"});
    }
    catch(err){
        res.status(400).json({error:err.message});
    }
};

const teacherDirectory=async(req,res)=>{
    try{
        const classIds=req.result.role==='teacher'?await classIdsForTeacher(req.result._id):null;
        const query={role:'teacher',status:'approved'};

        const teachers=await User.find(query).select('firstName lastName email avatarUrl phone').sort({firstName:1});
        const classes=classIds?await Classroom.find({_id:{$in:classIds}}).select('name'):[];

        res.status(200).json({data:teachers,classes});
    }
    catch(err){
        res.status(500).json({error:err.message});
    }
};

module.exports={listUsers,getUserById,createUser,updateUser,deleteUser,setUserStatus,updateOwnProfile,updateAvatar,listPending,bulkImport,linkParentChild,teacherDirectory};
