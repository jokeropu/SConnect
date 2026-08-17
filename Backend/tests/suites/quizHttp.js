const mongoose=require('mongoose');
const {connect,disconnect,BASE}=require('../helpers');
const jwt=require('jsonwebtoken');

const M='../../src/';
const Quiz=require('../../src/models/quiz');
const QuizAttempt=require('../../src/models/quizAttempt');
const Lesson=require('../../src/models/lesson');
const User=require('../../src/models/user');
const Classroom=require('../../src/models/classroom');
const Subject=require('../../src/models/subject');
const StudentProfile=require('../../src/models/studentProfile');
const Notification=require('../../src/models/notification');
const Result=require('../../src/models/result');
const TeacherProfile=require('../../src/models/teacherProfile');
const ParentProfile=require('../../src/models/parentProfile');

const made={};
let failures=0;

const check=(label,actual,expected)=>{
    const ok=JSON.stringify(actual)===JSON.stringify(expected);
    if(!ok) failures++;
    console.log(`${ok?'PASS':'FAIL'}  ${label}${ok?'':`  (got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)})`}`);
};

const token=(user)=>jwt.sign({_id:user._id,role:user.role},process.env.JWT_ACCESS_KEY,{expiresIn:'15m'});

const hit=async(method,path,user,body)=>{
    const res=await fetch(BASE+path,{
        method,
        headers:{'Content-Type':'application/json',Authorization:'Bearer '+token(user)},
        body:body?JSON.stringify(body):undefined
    });
    let json=null;
    try{ json=await res.json(); }catch{}
    return {code:res.status,json};
};

(async()=>{
    await connect();
    const tag='ZZHTTP-'+Date.now();

    try{
        made.subject=await Subject.create({name:tag+'-sub',code:'C'+String(Date.now()).slice(-9)});
        made.klass=await Classroom.create({name:tag+'-class',gradeLevel:9,capacity:30,academicYear:'2026-27'});
        made.teacher=await User.create({firstName:'Teach',lastName:'Http',email:tag+'t@x.io',password:'x'.repeat(12),role:'teacher',status:'approved'});
        made.student=await User.create({firstName:'Stud',lastName:'Http',email:tag+'s@x.io',password:'x'.repeat(12),role:'student',status:'approved'});
        made.parent=await User.create({firstName:'Paren',lastName:'Http',email:tag+'p@x.io',password:'x'.repeat(12),role:'parent',status:'approved'});
        made.tp=await TeacherProfile.create({userId:made.teacher._id,classes:[made.klass._id]});
        made.lesson=await Lesson.create({name:tag+' lesson',subjectId:made.subject._id,classId:made.klass._id,teacherId:made.teacher._id,day:'monday',startTime:'09:00',endTime:'09:45'});
        made.sp=await StudentProfile.create({userId:made.student._id,classId:made.klass._id});
        made.pp=await ParentProfile.create({userId:made.parent._id,children:[made.student._id]});

        const created=await hit('POST','/quizzes',made.teacher,{
            title:tag+' quiz',
            subjectId:String(made.subject._id),
            classId:String(made.klass._id),
            startTime:new Date(Date.now()-60000),
            endTime:new Date(Date.now()+3600000),
            timeLimit:30,
            status:'published',
            questions:[{text:'2+2?',type:'single',marks:5,options:[{text:'4',isCorrect:true},{text:'5'}]}]
        });
        check('teacher can create quiz',created.code,201);
        made.quiz=created.json.quiz;
        const qid=String(made.quiz._id);

        check('student cannot create quiz',(await hit('POST','/quizzes',made.student,{})).code,403);
        check('parent cannot create quiz',(await hit('POST','/quizzes',made.parent,{})).code,403);
        check('student cannot delete quiz',(await hit('DELETE','/quizzes/'+qid,made.student)).code,403);
        check('student cannot change status',(await hit('PATCH','/quizzes/'+qid+'/status',made.student,{status:'closed'})).code,403);
        check('parent cannot change status',(await hit('PATCH','/quizzes/'+qid+'/status',made.parent,{status:'closed'})).code,403);
        check('student denied teacher results',(await hit('GET','/quizzes/'+qid+'/results',made.student)).code,403);
        check('parent denied teacher results',(await hit('GET','/quizzes/'+qid+'/results',made.parent)).code,403);
        check('teacher allowed results',(await hit('GET','/quizzes/'+qid+'/results',made.teacher)).code,200);

        check('teacher cannot start attempt',(await hit('POST','/quizzes/'+qid+'/start',made.teacher)).code,403);
        check('parent cannot start attempt',(await hit('POST','/quizzes/'+qid+'/start',made.parent)).code,403);

        const start=await hit('POST','/quizzes/'+qid+'/start',made.student);
        check('student can start',start.code,200);
        check('answer key hidden at start',JSON.stringify(start.json.quiz).includes('isCorrect'),false);

        const optId=String(start.json.quiz.questions[0].options[0]._id);
        const sub=await hit('POST','/quizzes/'+qid+'/submit',made.student,{responses:{[String(start.json.quiz.questions[0]._id)]:[optId]}});
        check('student submit ok',sub.code,200);
        check('scored 5/5',[sub.json.score,sub.json.totalMarks],[5,5]);

        const openGet=await hit('GET','/quizzes/'+qid,made.student);
        check('answer key hidden while open',JSON.stringify(openGet.json.quiz.questions).includes('isCorrect'),false);
        check('review blocked while open',(await hit('GET','/quizzes/'+qid+'/review',made.student)).code,403);

        check('teacher can close',(await hit('PATCH','/quizzes/'+qid+'/status',made.teacher,{status:'closed'})).code,200);

        const rev=await hit('GET','/quizzes/'+qid+'/review',made.student);
        check('review open after close',rev.code,200);
        check('answer key visible after close',rev.json.quiz.questions[0].options.some((o)=>o.isCorrect),true);
        check('own attempt returned',rev.json.attempt.score,5);
        check('parent can review child',(await hit('GET','/quizzes/'+qid+'/review',made.parent)).json.attempt.score,5);
    }
    catch(err){
        failures++;
        console.log('FAIL  threw:',err.message);
    }
    finally{
        if(made.quiz) await Quiz.findOneAndDelete({_id:made.quiz._id});
        await QuizAttempt.deleteMany({studentId:made.student?._id});
        await StudentProfile.deleteMany({_id:made.sp?._id});
        await TeacherProfile.deleteMany({_id:made.tp?._id});
        await ParentProfile.deleteMany({_id:made.pp?._id});
        await Lesson.deleteMany({name:new RegExp('^'+tag,'i')});
        await User.deleteMany({_id:{$in:[made.teacher?._id,made.student?._id,made.parent?._id].filter(Boolean)}});
        await Classroom.deleteMany({_id:made.klass?._id});
        await Subject.deleteMany({_id:made.subject?._id});
        await Notification.deleteMany({userId:{$in:[made.student?._id,made.teacher?._id,made.parent?._id].filter(Boolean)}});
        await Result.deleteMany({studentId:made.student?._id});

        console.log(`\ncleanup: ${await Quiz.countDocuments({title:new RegExp('^'+tag,'i')})} quizzes, ${await User.countDocuments({email:new RegExp(tag,'i')})} users left behind`);
        console.log(failures===0?'\nALL HTTP CHECKS PASSED':`\n${failures} CHECK(S) FAILED`);
        await disconnect();
        process.exit(failures===0?0:1);
    }
})();
