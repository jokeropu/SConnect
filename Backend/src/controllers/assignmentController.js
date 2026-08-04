const Assignment=require('../models/assignment');
const Submission=require('../models/submission');
const StudentProfile=require('../models/studentProfile');
const Classroom=require('../models/classroom');
const cloudinary=require('../config/cloudinary');
const notify=require('../utils/notify');
const {requireFields}=require('../utils/validate');
const {parsePaging,buildMeta,searchRegex}=require('../utils/pagination');
const {visibleClassIds,assertClassAccess,classIdForStudent,childIdsForParent}=require('../utils/scope');
const {scoreBreakdown}=require('../utils/gradeUtility');

const listAssignments=async(req,res)=>{
    try{
        const {page,limit,skip}=parsePaging(req.query);
        const {classId,subjectId,search,upcoming}=req.query;

        const query={};
        if(subjectId) query.subjectId=subjectId;
        if(search) query.title=searchRegex(search);
        if(upcoming==='true') query.dueDate={$gte:new Date()};

        const allowed=await visibleClassIds(req.result);
        if(allowed===null){
            if(classId) query.classId=classId;
        }
        else{
            query.classId=classId && allowed.includes(String(classId))?classId:{$in:allowed};
        }

        const [assignments,total]=await Promise.all([
            Assignment.find(query).populate('subjectId','name code').populate('classId','name').populate('teacherId','firstName lastName').sort({dueDate:-1}).skip(skip).limit(limit),
            Assignment.countDocuments(query)
        ]);

        let mySubmissions=[];
        if(req.result.role==='student'){
            mySubmissions=await Submission.find({studentId:req.result._id,assignmentId:{$in:assignments.map((a)=>a._id)}});
        }

        const data=assignments.map((a)=>{
            const mine=mySubmissions.find((s)=>String(s.assignmentId)===String(a._id));
            return {...a.toObject(),mySubmission:mine || null};
        });

        res.status(200).json({data,meta:buildMeta(page,limit,total)});
    }
    catch(err){
        res.status(500).json({error:err.message});
    }
};

const getAssignmentById=async(req,res)=>{
    try{
        const assignment=await Assignment.findById(req.params.id).populate('subjectId','name code').populate('classId','name').populate('teacherId','firstName lastName');
        if(!assignment){
            return res.status(404).json({error:"Assignment not found"});
        }

        await assertClassAccess(req.result,assignment.classId._id);

        let submissions=[];
        if(req.result.role==='admin' || req.result.role==='teacher'){
            submissions=await Submission.find({assignmentId:assignment._id}).populate('studentId','firstName lastName email avatarUrl').sort({submittedAt:1});
        }
        else if(req.result.role==='student'){
            submissions=await Submission.find({assignmentId:assignment._id,studentId:req.result._id});
        }
        else if(req.result.role==='parent'){
            const children=await childIdsForParent(req.result._id);
            submissions=await Submission.find({assignmentId:assignment._id,studentId:{$in:children}}).populate('studentId','firstName lastName');
        }

        res.status(200).json({assignment,submissions});
    }
    catch(err){
        res.status(403).json({error:err.message});
    }
};

const createAssignment=async(req,res)=>{
    try{
        requireFields(req.body,['title','subjectId','classId','dueDate']);
        await assertClassAccess(req.result,req.body.classId);

        const assignment=await Assignment.create({
            ...req.body,
            teacherId:req.result.role==='admin' && req.body.teacherId?req.body.teacherId:req.result._id,
            attachmentUrl:req.file?req.file.path:req.body.attachmentUrl || null,
            attachmentPublicId:req.file?req.file.filename:null
        });

        const classroom=await Classroom.findById(assignment.classId).select('name');
        const profiles=await StudentProfile.find({classId:assignment.classId}).select('userId parentId');

        await notify.notifyMany(
            profiles.map((p)=>p.userId),
            'assignment_created',
            'New assignment posted',
            `${assignment.title} for ${classroom?.name || 'your class'} is due ${new Date(assignment.dueDate).toLocaleDateString()}.`,
            `/assignments/${assignment._id}`
        );

        await notify.notifyMany(
            profiles.map((p)=>p.parentId).filter(Boolean),
            'assignment_created',
            'New assignment for your child',
            `${assignment.title} is due ${new Date(assignment.dueDate).toLocaleDateString()}.`,
            `/assignments/${assignment._id}`
        );

        res.status(201).json({assignment,message:"Assignment created successfully"});
    }
    catch(err){
        res.status(400).json({error:err.message});
    }
};

const updateAssignment=async(req,res)=>{
    try{
        const assignment=await Assignment.findById(req.params.id);
        if(!assignment){
            return res.status(404).json({error:"Assignment not found"});
        }
        if(req.result.role!=='admin' && String(assignment.teacherId)!==String(req.result._id)){
            return res.status(403).json({error:"Only the assigning teacher can edit this"});
        }

        const allowed=['title','description','dueDate','startDate','maxMarks','subjectId'];
        for(const key of allowed){
            if(req.body[key]!==undefined) assignment[key]=req.body[key];
        }
        if(req.file){
            if(assignment.attachmentPublicId){
                await cloudinary.uploader.destroy(assignment.attachmentPublicId,{resource_type:'raw'}).catch(()=>{});
            }
            assignment.attachmentUrl=req.file.path;
            assignment.attachmentPublicId=req.file.filename;
        }

        await assignment.save();
        res.status(200).json({assignment,message:"Assignment updated successfully"});
    }
    catch(err){
        res.status(400).json({error:err.message});
    }
};

const deleteAssignment=async(req,res)=>{
    try{
        const assignment=await Assignment.findById(req.params.id);
        if(!assignment){
            return res.status(404).json({error:"Assignment not found"});
        }
        if(req.result.role!=='admin' && String(assignment.teacherId)!==String(req.result._id)){
            return res.status(403).json({error:"Only the assigning teacher can delete this"});
        }

        await Assignment.findByIdAndDelete(req.params.id);
        res.status(200).json({message:"Assignment deleted successfully"});
    }
    catch(err){
        res.status(500).json({error:err.message});
    }
};

const submitAssignment=async(req,res)=>{
    try{
        const assignment=await Assignment.findById(req.params.id);
        if(!assignment){
            return res.status(404).json({error:"Assignment not found"});
        }

        const classId=await classIdForStudent(req.result._id);
        if(String(classId)!==String(assignment.classId)){
            return res.status(403).json({error:"This assignment is not for your class"});
        }

        const now=new Date();
        const status=now>assignment.dueDate?'late':'submitted';

        const existing=await Submission.findOne({assignmentId:assignment._id,studentId:req.result._id});
        if(existing && existing.status==='graded'){
            return res.status(400).json({error:"This submission has already been graded"});
        }

        const payload={
            textAnswer:req.body.textAnswer || '',
            status,
            submittedAt:now
        };
        if(req.file){
            payload.fileUrl=req.file.path;
            payload.filePublicId=req.file.filename;
        }

        const submission=await Submission.findOneAndUpdate(
            {assignmentId:assignment._id,studentId:req.result._id},
            {$set:payload},
            {new:true,upsert:true,setDefaultsOnInsert:true}
        );

        res.status(201).json({submission,message:status==='late'?"Submitted after the due date":"Submitted successfully"});
    }
    catch(err){
        res.status(400).json({error:err.message});
    }
};

const gradeSubmission=async(req,res)=>{
    try{
        const {marksObtained,feedback}=req.body;
        const submission=await Submission.findById(req.params.id).populate('assignmentId');
        if(!submission){
            return res.status(404).json({error:"Submission not found"});
        }

        const maxMarks=submission.assignmentId?.maxMarks || 100;
        if(marksObtained===undefined || marksObtained<0 || marksObtained>maxMarks){
            throw new Error(`Marks must be between 0 and ${maxMarks}`);
        }

        submission.marksObtained=marksObtained;
        submission.feedback=feedback || '';
        submission.status='graded';
        submission.gradedBy=req.result._id;
        submission.gradedAt=new Date();
        await submission.save();

        const {percentage,grade}=scoreBreakdown(marksObtained,maxMarks);

        await notify(
            submission.studentId,
            'assignment_graded',
            'Your assignment has been graded',
            `${submission.assignmentId?.title || 'Assignment'}: ${marksObtained}/${maxMarks} (${percentage}%, grade ${grade}).`,
            `/assignments/${submission.assignmentId?._id}`
        );

        res.status(200).json({submission,message:"Submission graded"});
    }
    catch(err){
        res.status(400).json({error:err.message});
    }
};

const mySubmissions=async(req,res)=>{
    try{
        const studentId=req.query.studentId || req.result._id;

        if(req.result.role==='parent'){
            const children=await childIdsForParent(req.result._id);
            if(!children.includes(String(studentId))){
                return res.status(403).json({error:"That is not your child"});
            }
        }

        const submissions=await Submission.find({studentId}).populate({
            path:'assignmentId',
            select:'title dueDate maxMarks subjectId',
            populate:{path:'subjectId',select:'name code'}
        }).sort({submittedAt:-1});

        res.status(200).json({data:submissions});
    }
    catch(err){
        res.status(500).json({error:err.message});
    }
};

module.exports={listAssignments,getAssignmentById,createAssignment,updateAssignment,deleteAssignment,submitAssignment,gradeSubmission,mySubmissions};
