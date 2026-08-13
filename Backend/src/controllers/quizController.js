const Quiz=require('../models/quiz');
const QuizAttempt=require('../models/quizAttempt');
const StudentProfile=require('../models/studentProfile');
const Classroom=require('../models/classroom');
const notify=require('../utils/notify');
const {requireFields}=require('../utils/validate');
const {parsePaging,buildMeta,searchRegex}=require('../utils/pagination');
const {visibleClassIds,assertClassAccess,classIdForStudent,childIdsForParent}=require('../utils/scope');
const {QUIZ_GRACE_MS}=require('../config/appConfig');

const normalizeText=(value)=>String(value ?? '').trim().toUpperCase().replace(/\s+/g,' ');

const sameIdSet=(a,b)=>{
    const left=new Set(a.map(String));
    const right=new Set(b.map(String));
    return left.size===right.size && [...left].every((id)=>right.has(id));
};

const stripAnswers=(question)=>({
    _id:question._id,
    text:question.text,
    imageUrl:question.imageUrl,
    type:question.type,
    marks:question.marks,
    negativeMarks:question.negativeMarks,
    options:question.options.map((option)=>({_id:option._id,text:option.text}))
});

const isOwner=(user,quiz)=>user.role==='admin' || String(quiz.createdBy)===String(user._id);

const deadlineFor=(quiz,attempt)=>{
    const byTimer=new Date(attempt.startedAt).getTime()+quiz.timeLimit*60*1000;
    const byWindow=new Date(quiz.endTime).getTime();
    return new Date(Math.min(byTimer,byWindow));
};

const gradeOne=(quiz,question,submitted)=>{
    const answer={
        questionId:question._id,
        selectedOptions:[],
        textResponse:null,
        isCorrect:false,
        marksAwarded:0
    };

    let attempted=false;

    if(question.type==='single' || question.type==='multiple'){
        const validIds=question.options.map((o)=>String(o._id));
        const picked=(Array.isArray(submitted)?submitted:[submitted])
            .filter(Boolean)
            .map(String)
            .filter((id)=>validIds.includes(id));

        if(question.type==='single' && picked.length>1){
            picked.length=1;
        }

        attempted=picked.length>0;
        answer.selectedOptions=picked;

        if(attempted){
            const correctIds=question.options.filter((o)=>o.isCorrect).map((o)=>String(o._id));
            answer.isCorrect=sameIdSet(picked,correctIds);
        }
    }
    else{
        const text=submitted===undefined || submitted===null?'':String(submitted);
        attempted=text.trim()!=='';
        answer.textResponse=attempted?text:null;

        if(attempted){
            answer.isCorrect=question.type==='integer'
                ?Number(text)===Number(question.correctAnswer)
                :normalizeText(text)===normalizeText(question.correctAnswer);
        }
    }

    if(answer.isCorrect){
        answer.marksAwarded=question.marks;
    }
    else if(attempted && quiz.negativeMarking){
        answer.marksAwarded=-Math.abs(question.negativeMarks);
    }

    return answer;
};

const gradeAttempt=(quiz,responses)=>{
    const answers=quiz.questions.map((question)=>gradeOne(quiz,question,responses?.[String(question._id)]));
    const score=answers.reduce((sum,a)=>sum+a.marksAwarded,0);
    return {answers,score};
};

const listQuizzes=async(req,res)=>{
    try{
        const {page,limit,skip}=parsePaging(req.query);
        const {classId,subjectId,status,search}=req.query;
        const isStudent=req.result.role==='student';
        const isStaff=req.result.role==='admin' || req.result.role==='teacher';

        const query={};
        if(subjectId) query.subjectId=subjectId;
        if(search) query.title=searchRegex(search);
        if(status && isStaff) query.status=status;
        if(!isStaff) query.status={$in:['published','closed']};

        const allowed=await visibleClassIds(req.result);
        if(allowed===null){
            if(classId) query.classId=classId;
        }
        else{
            query.classId=classId && allowed.includes(String(classId))?classId:{$in:allowed};
        }

        const [quizzes,total]=await Promise.all([
            Quiz.find(query)
                .select('-questions.options.isCorrect -questions.correctAnswer')
                .populate('subjectId','name code')
                .populate('classId','name gradeLevel section')
                .populate('createdBy','firstName lastName')
                .sort({startTime:-1})
                .skip(skip)
                .limit(limit),
            Quiz.countDocuments(query)
        ]);

        const ids=quizzes.map((q)=>q._id);
        const attempts=isStudent
            ?await QuizAttempt.find({quizId:{$in:ids},studentId:req.result._id}).select('quizId status score totalMarks submittedAt')
            :[];
        const counts=!isStaff
            ?[]
            :await QuizAttempt.aggregate([
                {$match:{quizId:{$in:ids},status:'submitted'}},
                {$group:{_id:'$quizId',count:{$sum:1}}}
            ]);

        const data=quizzes.map((quiz)=>{
            const plain=quiz.toObject();
            plain.questionCount=plain.questions.length;
            delete plain.questions;
            plain.isOver=quiz.isOver();
            plain.isOpen=quiz.isOpen();

            if(isStudent){
                const mine=attempts.find((a)=>String(a.quizId)===String(quiz._id));
                plain.myAttempt=mine?{status:mine.status,score:mine.score,totalMarks:mine.totalMarks,submittedAt:mine.submittedAt}:null;
            }
            if(isStaff){
                plain.submissionCount=counts.find((c)=>String(c._id)===String(quiz._id))?.count || 0;
            }
            return plain;
        });

        res.status(200).json({data,meta:buildMeta(page,limit,total)});
    }
    catch(err){
        res.status(500).json({error:err.message});
    }
};

const createQuiz=async(req,res)=>{
    try{
        requireFields(req.body,['title','subjectId','classId','startTime','endTime','timeLimit','questions']);
        await assertClassAccess(req.result,req.body.classId);

        if(!Array.isArray(req.body.questions) || req.body.questions.length===0){
            throw new Error("A quiz needs at least one question");
        }
        if(new Date(req.body.endTime)<=new Date(req.body.startTime)){
            throw new Error("endTime must be after startTime");
        }

        const quiz=await Quiz.create({
            title:req.body.title,
            description:req.body.description || '',
            subjectId:req.body.subjectId,
            classId:req.body.classId,
            startTime:req.body.startTime,
            endTime:req.body.endTime,
            timeLimit:req.body.timeLimit,
            negativeMarking:!!req.body.negativeMarking,
            questions:req.body.questions,
            status:req.body.status==='published'?'published':'draft',
            createdBy:req.result._id
        });

        if(quiz.status==='published'){
            await announceQuiz(quiz);
        }

        res.status(201).json({quiz,message:"Quiz created successfully"});
    }
    catch(err){
        res.status(400).json({error:err.message});
    }
};

const announceQuiz=async(quiz)=>{
    const classroom=await Classroom.findById(quiz.classId).select('name');
    const profiles=await StudentProfile.find({classId:quiz.classId}).select('userId');

    await notify.notifyMany(
        profiles.map((p)=>p.userId),
        'quiz_published',
        'New quiz available',
        `${quiz.title} for ${classroom?.name || 'your class'} closes ${new Date(quiz.endTime).toLocaleString()}.`,
        '/list/quizzes'
    );
};

const getQuiz=async(req,res)=>{
    try{
        const quiz=await Quiz.findById(req.params.id)
            .populate('subjectId','name code')
            .populate('classId','name gradeLevel section')
            .populate('createdBy','firstName lastName');

        if(!quiz){
            return res.status(404).json({error:"Quiz not found"});
        }
        await assertClassAccess(req.result,quiz.classId._id || quiz.classId);

        const isStaff=req.result.role==='admin' || req.result.role==='teacher';
        const plain=quiz.toObject();
        plain.isOver=quiz.isOver();
        plain.isOpen=quiz.isOpen();

        if(!isStaff){
            if(quiz.status==='draft'){
                return res.status(403).json({error:"This quiz is not available yet"});
            }
            // The answer key stays hidden until the quiz closes for everyone.
            if(!quiz.isOver()){
                plain.questions=quiz.questions.map(stripAnswers);
            }
        }

        res.status(200).json({quiz:plain});
    }
    catch(err){
        res.status(400).json({error:err.message});
    }
};

const updateQuiz=async(req,res)=>{
    try{
        const quiz=await Quiz.findById(req.params.id);
        if(!quiz){
            return res.status(404).json({error:"Quiz not found"});
        }
        if(!isOwner(req.result,quiz)){
            return res.status(403).json({error:"Only the teacher who created this quiz can edit it"});
        }

        const {title,description,startTime,endTime,timeLimit,negativeMarking,questions}=req.body;

        if(questions!==undefined){
            const attemptCount=await QuizAttempt.countDocuments({quizId:quiz._id});
            if(quiz.status!=='draft' || attemptCount>0){
                throw new Error("Questions can only be edited while the quiz is a draft with no attempts");
            }
            if(!Array.isArray(questions) || questions.length===0){
                throw new Error("A quiz needs at least one question");
            }
            quiz.questions=questions;
        }

        if(title!==undefined) quiz.title=title;
        if(description!==undefined) quiz.description=description;
        if(startTime!==undefined) quiz.startTime=startTime;
        if(endTime!==undefined) quiz.endTime=endTime;
        if(timeLimit!==undefined) quiz.timeLimit=timeLimit;
        if(negativeMarking!==undefined) quiz.negativeMarking=!!negativeMarking;

        if(new Date(quiz.endTime)<=new Date(quiz.startTime)){
            throw new Error("endTime must be after startTime");
        }

        await quiz.save();
        res.status(200).json({quiz,message:"Quiz updated successfully"});
    }
    catch(err){
        res.status(400).json({error:err.message});
    }
};

const deleteQuiz=async(req,res)=>{
    try{
        const quiz=await Quiz.findById(req.params.id);
        if(!quiz){
            return res.status(404).json({error:"Quiz not found"});
        }
        if(!isOwner(req.result,quiz)){
            return res.status(403).json({error:"Only the teacher who created this quiz can delete it"});
        }

        await Quiz.findOneAndDelete({_id:quiz._id});
        res.status(200).json({message:"Quiz deleted successfully"});
    }
    catch(err){
        res.status(500).json({error:err.message});
    }
};

const setQuizStatus=async(req,res)=>{
    try{
        const {status}=req.body;
        if(!['draft','published','closed'].includes(status)){
            throw new Error("status must be draft, published or closed");
        }

        const quiz=await Quiz.findById(req.params.id);
        if(!quiz){
            return res.status(404).json({error:"Quiz not found"});
        }
        if(!isOwner(req.result,quiz)){
            return res.status(403).json({error:"Only the teacher who created this quiz can change its status"});
        }

        if(status==='draft' && quiz.status!=='draft'){
            const attemptCount=await QuizAttempt.countDocuments({quizId:quiz._id});
            if(attemptCount>0){
                throw new Error("This quiz already has attempts and cannot go back to draft");
            }
        }
        if(status==='published' && quiz.questions.length===0){
            throw new Error("Add at least one question before publishing");
        }

        const wasPublished=quiz.status==='published';
        quiz.status=status;
        await quiz.save();

        if(status==='closed'){
            const stale=await QuizAttempt.find({quizId:quiz._id,status:'in-progress'});
            for(const attempt of stale){
                const {answers,score}=gradeAttempt(quiz,{});
                attempt.answers=answers;
                attempt.score=score;
                attempt.totalMarks=quiz.totalMarks;
                attempt.status='submitted';
                attempt.autoSubmitted=true;
                attempt.submittedAt=new Date();
                attempt.timeTakenMs=Date.now()-new Date(attempt.startedAt).getTime();
                await attempt.save();
            }

            const profiles=await StudentProfile.find({classId:quiz.classId}).select('userId');
            await notify.notifyMany(
                profiles.map((p)=>p.userId),
                'quiz_closed',
                'Quiz results available',
                `${quiz.title} is closed. You can now review the questions and answers.`,
                `/quizzes/${quiz._id}/review`
            );
        }
        else if(status==='published' && !wasPublished){
            await announceQuiz(quiz);
        }

        res.status(200).json({quiz,message:`Quiz is now ${status}`});
    }
    catch(err){
        res.status(400).json({error:err.message});
    }
};

const startAttempt=async(req,res)=>{
    try{
        const quiz=await Quiz.findById(req.params.id);
        if(!quiz){
            return res.status(404).json({error:"Quiz not found"});
        }

        const classId=await classIdForStudent(req.result._id);
        if(!classId || String(classId)!==String(quiz.classId)){
            return res.status(403).json({error:"This quiz is not for your class"});
        }

        if(quiz.status==='draft'){
            throw new Error("This quiz is not open yet");
        }
        if(!quiz.isOpen()){
            throw new Error(quiz.isOver()?"This quiz has closed":"This quiz has not started yet");
        }

        let attempt=await QuizAttempt.findOne({quizId:quiz._id,studentId:req.result._id});

        if(attempt?.status==='submitted'){
            throw new Error("You have already submitted this quiz");
        }
        if(!attempt){
            attempt=await QuizAttempt.create({
                quizId:quiz._id,
                studentId:req.result._id,
                totalMarks:quiz.totalMarks,
                startedAt:new Date()
            });
        }

        const deadline=deadlineFor(quiz,attempt);
        if(deadline.getTime()<=Date.now()){
            throw new Error("Your time for this quiz has run out");
        }

        res.status(200).json({
            attemptId:attempt._id,
            startedAt:attempt.startedAt,
            deadline,
            serverTime:new Date(),
            quiz:{
                _id:quiz._id,
                title:quiz.title,
                description:quiz.description,
                timeLimit:quiz.timeLimit,
                totalMarks:quiz.totalMarks,
                negativeMarking:quiz.negativeMarking,
                questions:quiz.questions.map(stripAnswers)
            }
        });
    }
    catch(err){
        res.status(400).json({error:err.message});
    }
};

const submitQuiz=async(req,res)=>{
    try{
        const quiz=await Quiz.findById(req.params.id);
        if(!quiz){
            return res.status(404).json({error:"Quiz not found"});
        }

        const attempt=await QuizAttempt.findOne({quizId:quiz._id,studentId:req.result._id});
        if(!attempt){
            throw new Error("Start the quiz before submitting");
        }
        if(attempt.status==='submitted'){
            throw new Error("You have already submitted this quiz");
        }

        const now=Date.now();
        const deadline=deadlineFor(quiz,attempt).getTime();
        const {answers,score}=gradeAttempt(quiz,req.body.responses || {});

        attempt.answers=answers;
        attempt.score=score;
        attempt.totalMarks=quiz.totalMarks;
        attempt.status='submitted';
        attempt.submittedAt=new Date();
        attempt.timeTakenMs=now-new Date(attempt.startedAt).getTime();
        attempt.autoSubmitted=now>deadline+QUIZ_GRACE_MS;
        await attempt.save();

        res.status(200).json({
            message:"Quiz submitted",
            score:attempt.score,
            totalMarks:attempt.totalMarks,
            autoSubmitted:attempt.autoSubmitted,
            reviewAvailable:quiz.isOver()
        });
    }
    catch(err){
        res.status(400).json({error:err.message});
    }
};

const myAttempts=async(req,res)=>{
    try{
        const {page,limit,skip}=parsePaging(req.query);
        const query={studentId:req.result._id,status:'submitted'};

        const [attempts,total]=await Promise.all([
            QuizAttempt.find(query)
                .populate({path:'quizId',select:'title status endTime totalMarks subjectId',populate:{path:'subjectId',select:'name code'}})
                .sort({submittedAt:-1})
                .skip(skip)
                .limit(limit),
            QuizAttempt.countDocuments(query)
        ]);

        res.status(200).json({data:attempts,meta:buildMeta(page,limit,total)});
    }
    catch(err){
        res.status(500).json({error:err.message});
    }
};

const reviewQuiz=async(req,res)=>{
    try{
        const quiz=await Quiz.findById(req.params.id)
            .populate('subjectId','name code')
            .populate('classId','name gradeLevel section');

        if(!quiz){
            return res.status(404).json({error:"Quiz not found"});
        }
        await assertClassAccess(req.result,quiz.classId._id || quiz.classId);

        if(!quiz.isOver()){
            return res.status(403).json({error:"Answers unlock once the quiz is over"});
        }

        let studentId=req.query.studentId;
        if(req.result.role==='student'){
            studentId=req.result._id;
        }
        else if(req.result.role==='parent'){
            const children=await childIdsForParent(req.result._id);
            if(!studentId){
                studentId=children[0];
            }
            else if(!children.includes(String(studentId))){
                return res.status(403).json({error:"That is not your child"});
            }
        }

        const attempt=studentId
            ?await QuizAttempt.findOne({quizId:quiz._id,studentId}).populate('studentId','firstName lastName')
            :null;

        res.status(200).json({
            quiz:quiz.toObject(),
            attempt:attempt?attempt.toObject():null
        });
    }
    catch(err){
        res.status(400).json({error:err.message});
    }
};

const quizResults=async(req,res)=>{
    try{
        const quiz=await Quiz.findById(req.params.id)
            .populate('subjectId','name code')
            .populate('classId','name gradeLevel section');

        if(!quiz){
            return res.status(404).json({error:"Quiz not found"});
        }
        await assertClassAccess(req.result,quiz.classId._id || quiz.classId);

        const attempts=await QuizAttempt.find({quizId:quiz._id,status:'submitted'})
            .populate('studentId','firstName lastName email avatarUrl')
            .sort({score:-1,timeTakenMs:1});

        const roster=await StudentProfile.find({classId:quiz.classId._id || quiz.classId}).select('userId');
        const attempted=new Set(attempts.map((a)=>String(a.studentId?._id)));

        const questionStats=quiz.questions.map((question)=>{
            const responses=attempts
                .map((a)=>a.answers.find((ans)=>String(ans.questionId)===String(question._id)))
                .filter((ans)=>ans && (ans.selectedOptions.length>0 || ans.textResponse));

            const correct=responses.filter((ans)=>ans.isCorrect).length;
            const optionCounts=question.options.map((option)=>({
                _id:option._id,
                text:option.text,
                isCorrect:option.isCorrect,
                count:responses.filter((ans)=>ans.selectedOptions.some((id)=>String(id)===String(option._id))).length
            }));

            return {
                _id:question._id,
                text:question.text,
                type:question.type,
                marks:question.marks,
                correctAnswer:question.correctAnswer,
                answered:responses.length,
                correct,
                accuracy:responses.length>0?Math.round((correct/responses.length)*100):0,
                optionCounts
            };
        });

        const scores=attempts.map((a)=>a.score);
        const summary={
            totalStudents:roster.length,
            submitted:attempts.length,
            notAttempted:roster.filter((p)=>!attempted.has(String(p.userId))).length,
            averageScore:scores.length>0?Number((scores.reduce((s,v)=>s+v,0)/scores.length).toFixed(2)):0,
            highestScore:scores.length>0?Math.max(...scores):0,
            lowestScore:scores.length>0?Math.min(...scores):0,
            totalMarks:quiz.totalMarks
        };

        res.status(200).json({quiz:quiz.toObject(),summary,attempts,questionStats});
    }
    catch(err){
        res.status(400).json({error:err.message});
    }
};

module.exports={listQuizzes,createQuiz,getQuiz,updateQuiz,deleteQuiz,setQuizStatus,startAttempt,submitQuiz,myAttempts,reviewQuiz,quizResults};
