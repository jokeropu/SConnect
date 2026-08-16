const Classroom=require('../models/classroom');
const Subject=require('../models/subject');
const Lesson=require('../models/lesson');
const StudentProfile=require('../models/studentProfile');
const TeacherProfile=require('../models/teacherProfile');
const User=require('../models/user');
const notify=require('../utils/notify');
const {requireFields,pickFields}=require('../utils/validate');

const CLASS_FIELDS=['name','gradeLevel','section','capacity','academicYear','supervisorId','subjects'];
const SUBJECT_FIELDS=['name','code','description','teachers','classes'];
const {parsePaging,buildMeta,searchRegex}=require('../utils/pagination');
const {visibleClassIds,assertClassAccess,canManageClassRecord}=require('../utils/scope');

const listClasses=async(req,res)=>{
    try{
        const {page,limit,skip}=parsePaging(req.query);
        const {search,gradeLevel}=req.query;

        const query={};
        if(search) query.name=searchRegex(search);
        if(gradeLevel) query.gradeLevel=Number(gradeLevel);

        const allowed=await visibleClassIds(req.result);
        if(allowed!==null) query._id={$in:allowed};

        const [classes,total]=await Promise.all([
            Classroom.find(query).populate('supervisorId','firstName lastName email').populate('subjects','name code').sort({gradeLevel:1,section:1}).skip(skip).limit(limit),
            Classroom.countDocuments(query)
        ]);

        const withCounts=await Promise.all(classes.map(async(c)=>{
            const enrolled=await StudentProfile.countDocuments({classId:c._id});
            return {...c.toObject(),enrolled};
        }));

        res.status(200).json({data:withCounts,meta:buildMeta(page,limit,total)});
    }
    catch(err){
        res.status(500).json({error:err.message});
    }
};

const getClassById=async(req,res)=>{
    try{
        const classroom=await Classroom.findById(req.params.id).populate('supervisorId','firstName lastName email avatarUrl').populate('subjects','name code');
        if(!classroom){
            return res.status(404).json({error:"Class not found"});
        }

        await assertClassAccess(req.result,classroom._id);

        const profiles=await StudentProfile.find({classId:classroom._id}).populate('userId','firstName lastName email avatarUrl phone');
        const lessons=await Lesson.find({classId:classroom._id}).populate('subjectId','name code').populate('teacherId','firstName lastName');

        res.status(200).json({classroom,students:profiles,lessons});
    }
    catch(err){
        res.status(403).json({error:err.message});
    }
};

const createClass=async(req,res)=>{
    try{
        requireFields(req.body,['name','gradeLevel','capacity','academicYear']);
        const classroom=await Classroom.create(pickFields(req.body,CLASS_FIELDS));

        if(classroom.supervisorId){
            await TeacherProfile.findOneAndUpdate({userId:classroom.supervisorId},{$addToSet:{classes:classroom._id}},{upsert:true});
            await notify(classroom.supervisorId,'class_assigned','You supervise a new class',`You are now the supervisor of ${classroom.name}.`,'/classes');
        }

        res.status(201).json({classroom,message:"Class created successfully"});
    }
    catch(err){
        res.status(400).json({error:err.message});
    }
};

const updateClass=async(req,res)=>{
    try{
        const classroom=await Classroom.findByIdAndUpdate(req.params.id,{$set:pickFields(req.body,CLASS_FIELDS)},{new:true,runValidators:true});
        if(!classroom){
            return res.status(404).json({error:"Class not found"});
        }
        res.status(200).json({classroom,message:"Class updated successfully"});
    }
    catch(err){
        res.status(400).json({error:err.message});
    }
};

const deleteClass=async(req,res)=>{
    try{
        const enrolled=await StudentProfile.countDocuments({classId:req.params.id});
        if(enrolled>0){
            return res.status(400).json({error:`Cannot delete a class with ${enrolled} enrolled student(s)`});
        }

        const classroom=await Classroom.findByIdAndDelete(req.params.id);
        if(!classroom){
            return res.status(404).json({error:"Class not found"});
        }

        await Lesson.deleteMany({classId:req.params.id});
        res.status(200).json({message:"Class deleted successfully"});
    }
    catch(err){
        res.status(500).json({error:err.message});
    }
};

const enrollStudents=async(req,res)=>{
    try{
        const {id}=req.params;
        const {studentIds}=req.body;

        if(!Array.isArray(studentIds) || studentIds.length===0){
            throw new Error("No students provided");
        }

        const classroom=await Classroom.findById(id);
        if(!classroom){
            return res.status(404).json({error:"Class not found"});
        }

        const enrolled=await StudentProfile.countDocuments({classId:id});
        if(enrolled+studentIds.length>classroom.capacity){
            throw new Error(`Class capacity is ${classroom.capacity} and ${enrolled} seats are taken`);
        }

        await StudentProfile.updateMany({userId:{$in:studentIds}},{$set:{classId:id}},{upsert:false});
        await notify.notifyMany(studentIds,'class_assigned','You have been enrolled',`You are now enrolled in ${classroom.name}.`,'/');

        res.status(200).json({message:`Enrolled ${studentIds.length} student(s)`});
    }
    catch(err){
        res.status(400).json({error:err.message});
    }
};

const listSubjects=async(req,res)=>{
    try{
        const {page,limit,skip}=parsePaging(req.query);
        const query={};
        if(req.query.search) query.$or=[{name:searchRegex(req.query.search)},{code:searchRegex(req.query.search)}];

        const [subjects,total]=await Promise.all([
            Subject.find(query).populate('teachers','firstName lastName').sort({name:1}).skip(skip).limit(limit),
            Subject.countDocuments(query)
        ]);

        res.status(200).json({data:subjects,meta:buildMeta(page,limit,total)});
    }
    catch(err){
        res.status(500).json({error:err.message});
    }
};

const createSubject=async(req,res)=>{
    try{
        requireFields(req.body,['name','code']);
        const subject=await Subject.create(pickFields(req.body,SUBJECT_FIELDS));

        if(Array.isArray(req.body.teachers)){
            await TeacherProfile.updateMany({userId:{$in:req.body.teachers}},{$addToSet:{subjects:subject._id}});
        }

        res.status(201).json({subject,message:"Subject created successfully"});
    }
    catch(err){
        res.status(400).json({error:err.message});
    }
};

const updateSubject=async(req,res)=>{
    try{
        const subject=await Subject.findByIdAndUpdate(req.params.id,{$set:pickFields(req.body,SUBJECT_FIELDS)},{new:true,runValidators:true});
        if(!subject){
            return res.status(404).json({error:"Subject not found"});
        }
        res.status(200).json({subject,message:"Subject updated successfully"});
    }
    catch(err){
        res.status(400).json({error:err.message});
    }
};

const deleteSubject=async(req,res)=>{
    try{
        const lessonCount=await Lesson.countDocuments({subjectId:req.params.id});
        if(lessonCount>0){
            return res.status(400).json({error:`Cannot delete a subject used by ${lessonCount} lesson(s)`});
        }

        const subject=await Subject.findByIdAndDelete(req.params.id);
        if(!subject){
            return res.status(404).json({error:"Subject not found"});
        }
        res.status(200).json({message:"Subject deleted successfully"});
    }
    catch(err){
        res.status(500).json({error:err.message});
    }
};

const listLessons=async(req,res)=>{
    try{
        const {page,limit,skip}=parsePaging(req.query);
        const {classId,teacherId,subjectId,day}=req.query;

        const query={};
        if(classId) query.classId=classId;
        if(teacherId) query.teacherId=teacherId;
        if(subjectId) query.subjectId=subjectId;
        if(day) query.day=day;

        const allowed=await visibleClassIds(req.result);
        if(allowed!==null){
            query.classId=classId && allowed.includes(String(classId))?classId:{$in:allowed};
        }

        const [lessons,total]=await Promise.all([
            Lesson.find(query).populate('subjectId','name code').populate('classId','name gradeLevel section').populate('teacherId','firstName lastName').sort({day:1,startTime:1}).skip(skip).limit(limit),
            Lesson.countDocuments(query)
        ]);

        res.status(200).json({data:lessons,meta:buildMeta(page,limit,total)});
    }
    catch(err){
        res.status(500).json({error:err.message});
    }
};

const timetable=async(req,res)=>{
    try{
        const {classId,teacherId}=req.query;
        const query={};

        if(classId){
            await assertClassAccess(req.result,classId);
            query.classId=classId;
        }
        else if(teacherId){
            query.teacherId=teacherId;
        }
        else if(req.result.role==='teacher'){
            query.teacherId=req.result._id;
        }
        else{
            const allowed=await visibleClassIds(req.result);
            query.classId={$in:allowed || []};
        }

        const lessons=await Lesson.find(query).populate('subjectId','name code').populate('classId','name').populate('teacherId','firstName lastName').sort({day:1,startTime:1});
        res.status(200).json({data:lessons});
    }
    catch(err){
        res.status(403).json({error:err.message});
    }
};

const createLesson=async(req,res)=>{
    try{
        requireFields(req.body,['name','subjectId','classId','teacherId','day','startTime','endTime']);

        try{
            await assertClassAccess(req.result,req.body.classId);
        }
        catch(accessErr){
            return res.status(403).json({error:accessErr.message});
        }

        const teacherId=req.result.role==='admin'?req.body.teacherId:req.result._id;

        const clash=await Lesson.findOne({
            classId:req.body.classId,
            day:req.body.day,
            startTime:{$lt:req.body.endTime},
            endTime:{$gt:req.body.startTime}
        });

        if(clash){
            throw new Error(`That slot clashes with "${clash.name}" on ${clash.day}`);
        }

        const lesson=await Lesson.create({
            name:req.body.name,
            subjectId:req.body.subjectId,
            classId:req.body.classId,
            teacherId,
            day:req.body.day,
            startTime:req.body.startTime,
            endTime:req.body.endTime,
            room:req.body.room || ''
        });
        await TeacherProfile.findOneAndUpdate({userId:lesson.teacherId},{$addToSet:{classes:lesson.classId,subjects:lesson.subjectId}},{upsert:true});

        res.status(201).json({lesson,message:"Lesson created successfully"});
    }
    catch(err){
        res.status(400).json({error:err.message});
    }
};

const updateLesson=async(req,res)=>{
    try{
        const lesson=await Lesson.findById(req.params.id);
        if(!lesson){
            return res.status(404).json({error:"Lesson not found"});
        }
        if(!await canManageClassRecord(req.result,lesson.classId,lesson.teacherId)){
            return res.status(403).json({error:"Only the teacher who takes this lesson, or the class head, can edit it"});
        }

        const allowed=['name','subjectId','day','startTime','endTime','room'];
        for(const key of allowed){
            if(req.body[key]!==undefined) lesson[key]=req.body[key];
        }

        const clash=await Lesson.findOne({
            _id:{$ne:lesson._id},
            classId:lesson.classId,
            day:lesson.day,
            startTime:{$lt:lesson.endTime},
            endTime:{$gt:lesson.startTime}
        });
        if(clash){
            throw new Error(`That slot clashes with "${clash.name}" on ${clash.day}`);
        }

        await lesson.save();
        res.status(200).json({lesson,message:"Lesson updated successfully"});
    }
    catch(err){
        res.status(400).json({error:err.message});
    }
};

const deleteLesson=async(req,res)=>{
    try{
        const lesson=await Lesson.findById(req.params.id);
        if(!lesson){
            return res.status(404).json({error:"Lesson not found"});
        }
        if(!await canManageClassRecord(req.result,lesson.classId,lesson.teacherId)){
            return res.status(403).json({error:"Only the teacher who takes this lesson, or the class head, can delete it"});
        }

        await Lesson.findByIdAndDelete(lesson._id);
        res.status(200).json({message:"Lesson deleted successfully"});
    }
    catch(err){
        res.status(500).json({error:err.message});
    }
};

module.exports={listClasses,getClassById,createClass,updateClass,deleteClass,enrollStudents,listSubjects,createSubject,updateSubject,deleteSubject,listLessons,timetable,createLesson,updateLesson,deleteLesson};
