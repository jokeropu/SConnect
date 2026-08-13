const Exam=require('../models/exam');
const Result=require('../models/result');
const StudentProfile=require('../models/studentProfile');
const Classroom=require('../models/classroom');
const notify=require('../utils/notify');
const {requireFields}=require('../utils/validate');
const {parsePaging,buildMeta,searchRegex}=require('../utils/pagination');
const {visibleClassIds,assertClassAccess,childIdsForParent,visibleStudentIds}=require('../utils/scope');
const {scoreBreakdown,buildReportCard}=require('../utils/gradeUtility');

const listExams=async(req,res)=>{
    try{
        const {page,limit,skip}=parsePaging(req.query);
        const {classId,subjectId,term,search}=req.query;

        const query={};
        if(subjectId) query.subjectId=subjectId;
        if(term) query.term=term;
        if(search) query.title=searchRegex(search);

        const allowed=await visibleClassIds(req.result);
        if(allowed===null){
            if(classId) query.classId=classId;
        }
        else{
            query.classId=classId && allowed.includes(String(classId))?classId:{$in:allowed};
        }

        const [exams,total]=await Promise.all([
            Exam.find(query).populate('subjectId','name code').populate('classId','name gradeLevel section').sort({startTime:-1}).skip(skip).limit(limit),
            Exam.countDocuments(query)
        ]);

        res.status(200).json({data:exams,meta:buildMeta(page,limit,total)});
    }
    catch(err){
        res.status(500).json({error:err.message});
    }
};

const createExam=async(req,res)=>{
    try{
        requireFields(req.body,['title','subjectId','classId','startTime','endTime','maxMarks']);
        await assertClassAccess(req.result,req.body.classId);

        if(new Date(req.body.endTime)<=new Date(req.body.startTime)){
            throw new Error("endTime must be after startTime");
        }

        const exam=await Exam.create({...req.body,createdBy:req.result._id});
        const classroom=await Classroom.findById(exam.classId).select('name');
        const profiles=await StudentProfile.find({classId:exam.classId}).select('userId parentId');

        await notify.notifyMany(
            [...profiles.map((p)=>p.userId),...profiles.map((p)=>p.parentId).filter(Boolean)],
            'exam_scheduled',
            'Exam scheduled',
            `${exam.title} for ${classroom?.name || 'your class'} on ${new Date(exam.startTime).toLocaleString()}.`,
            '/exams'
        );

        res.status(201).json({exam,message:"Exam created successfully"});
    }
    catch(err){
        res.status(400).json({error:err.message});
    }
};

const updateExam=async(req,res)=>{
    try{
        const exam=await Exam.findById(req.params.id);
        if(!exam){
            return res.status(404).json({error:"Exam not found"});
        }
        if(req.result.role!=='admin' && String(exam.createdBy)!==String(req.result._id)){
            return res.status(403).json({error:"Only the teacher who created this exam can edit it"});
        }

        const allowed=['title','subjectId','term','startTime','endTime','maxMarks','passMarks','room'];
        for(const key of allowed){
            if(req.body[key]!==undefined) exam[key]=req.body[key];
        }

        if(new Date(exam.endTime)<=new Date(exam.startTime)){
            throw new Error("endTime must be after startTime");
        }

        await exam.save();
        res.status(200).json({exam,message:"Exam updated successfully"});
    }
    catch(err){
        res.status(400).json({error:err.message});
    }
};

const deleteExam=async(req,res)=>{
    try{
        const exam=await Exam.findById(req.params.id);
        if(!exam){
            return res.status(404).json({error:"Exam not found"});
        }
        if(req.result.role!=='admin' && String(exam.createdBy)!==String(req.result._id)){
            return res.status(403).json({error:"Only the teacher who created this exam can delete it"});
        }

        await Exam.findByIdAndDelete(exam._id);
        res.status(200).json({message:"Exam deleted successfully"});
    }
    catch(err){
        res.status(500).json({error:err.message});
    }
};

const enterResults=async(req,res)=>{
    try{
        const {id}=req.params;
        const {entries}=req.body;

        const exam=await Exam.findById(id);
        if(!exam){
            return res.status(404).json({error:"Exam not found"});
        }
        await assertClassAccess(req.result,exam.classId);

        if(!Array.isArray(entries) || entries.length===0){
            throw new Error("No result entries provided");
        }

        const saved=[];
        for(const entry of entries){
            if(entry.marksObtained<0 || entry.marksObtained>exam.maxMarks){
                throw new Error(`Marks for one student are outside 0 - ${exam.maxMarks}`);
            }

            const {percentage,grade,points}=scoreBreakdown(entry.marksObtained,exam.maxMarks);
            const result=await Result.findOneAndUpdate(
                {examId:exam._id,studentId:entry.studentId},
                {$set:{
                    marksObtained:entry.marksObtained,
                    maxMarks:exam.maxMarks,
                    percentage,
                    grade,
                    points,
                    remarks:entry.remarks || '',
                    enteredBy:req.result._id
                }},
                {new:true,upsert:true,setDefaultsOnInsert:true}
            );
            saved.push(result);
        }

        res.status(201).json({data:saved,message:`Saved ${saved.length} result(s)`});
    }
    catch(err){
        res.status(400).json({error:err.message});
    }
};

const publishResults=async(req,res)=>{
    try{
        const exam=await Exam.findById(req.params.id);
        if(!exam){
            return res.status(404).json({error:"Exam not found"});
        }
        if(req.result.role!=='admin' && String(exam.createdBy)!==String(req.result._id)){
            return res.status(403).json({error:"Only the teacher who created this exam can publish its results"});
        }
        if(exam.resultsPublished){
            return res.status(400).json({error:"Results are already published"});
        }

        exam.resultsPublished=true;
        await exam.save();

        const results=await Result.find({examId:exam._id});
        const profiles=await StudentProfile.find({userId:{$in:results.map((r)=>r.studentId)}}).select('userId parentId');

        for(const result of results){
            await notify(result.studentId,'result_published','Exam result published',`${exam.title}: ${result.marksObtained}/${result.maxMarks} (${result.percentage}%, grade ${result.grade}).`,'/results');
            const profile=profiles.find((p)=>String(p.userId)===String(result.studentId));
            if(profile?.parentId){
                await notify(profile.parentId,'result_published','Your child has a new result',`${exam.title}: ${result.marksObtained}/${result.maxMarks} (grade ${result.grade}).`,'/results');
            }
        }

        res.status(200).json({message:`Published ${results.length} result(s)`});
    }
    catch(err){
        res.status(400).json({error:err.message});
    }
};

const listResults=async(req,res)=>{
    try{
        const {page,limit,skip}=parsePaging(req.query);
        const {examId,studentId}=req.query;

        const query={};
        if(examId) query.examId=examId;

        const allowedStudents=await visibleStudentIds(req.result);
        if(allowedStudents===null){
            if(studentId) query.studentId=studentId;
        }
        else{
            query.studentId=studentId && allowedStudents.includes(String(studentId))?studentId:{$in:allowedStudents};
        }

        if(req.result.role==='student' || req.result.role==='parent'){
            const publishedExams=await Exam.find({resultsPublished:true}).distinct('_id');
            query.$or=[{examId:{$in:publishedExams}},{examId:null}];
        }

        const [results,total]=await Promise.all([
            Result.find(query).populate({path:'examId',select:'title term startTime subjectId',populate:{path:'subjectId',select:'name code'}}).populate('studentId','firstName lastName email').sort({createdAt:-1}).skip(skip).limit(limit),
            Result.countDocuments(query)
        ]);

        res.status(200).json({data:results,meta:buildMeta(page,limit,total)});
    }
    catch(err){
        res.status(500).json({error:err.message});
    }
};

const reportCard=async(req,res)=>{
    try{
        const studentId=req.params.studentId || req.result._id;

        if(req.result.role==='parent'){
            const children=await childIdsForParent(req.result._id);
            if(!children.includes(String(studentId))){
                return res.status(403).json({error:"That is not your child"});
            }
        }
        if(req.result.role==='student' && String(studentId)!==String(req.result._id)){
            return res.status(403).json({error:"You can only view your own report card"});
        }

        const publishedExams=await Exam.find({resultsPublished:true}).distinct('_id');
        const results=await Result.find({studentId,examId:{$in:publishedExams}}).populate({
            path:'examId',
            select:'title term maxMarks subjectId',
            populate:{path:'subjectId',select:'name code'}
        });

        const summary=buildReportCard(results);
        const bySubject={};

        for(const result of results){
            const subject=result.examId?.subjectId;
            const key=subject?String(subject._id):'other';
            if(!bySubject[key]){
                bySubject[key]={subject:subject?{name:subject.name,code:subject.code}:{name:'Other',code:'—'},results:[],obtained:0,max:0};
            }
            bySubject[key].results.push(result);
            bySubject[key].obtained+=result.marksObtained;
            bySubject[key].max+=result.maxMarks;
        }

        const subjects=Object.values(bySubject).map((entry)=>{
            const {percentage,grade}=scoreBreakdown(entry.obtained,entry.max);
            return {...entry,percentage,grade};
        });

        res.status(200).json({studentId,summary,subjects});
    }
    catch(err){
        res.status(500).json({error:err.message});
    }
};

module.exports={listExams,createExam,updateExam,deleteExam,enterResults,publishResults,listResults,reportCard};
