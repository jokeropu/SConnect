const mongoose=require('mongoose');
const {connect,disconnect,BASE}=require('../helpers');
const jwt=require('jsonwebtoken');

const M='../../';
const Quiz=require('../../models/quiz');
const QuizAttempt=require('../../models/quizAttempt');
const Result=require('../../models/result');
const Exam=require('../../models/exam');
const Lesson=require('../../models/lesson');
const Event=require('../../models/event');
const Announcement=require('../../models/announcement');
const Assignment=require('../../models/assignment');
const Submission=require('../../models/submission');
const User=require('../../models/user');
const Classroom=require('../../models/classroom');
const Subject=require('../../models/subject');
const StudentProfile=require('../../models/studentProfile');
const TeacherProfile=require('../../models/teacherProfile');
const Notification=require('../../models/notification');

const made={};
let failures=0;

const check=(label,actual,expected)=>{
    const ok=JSON.stringify(actual)===JSON.stringify(expected);
    if(!ok) failures++;
    console.log(`${ok?'PASS':'FAIL'}  ${label}${ok?'':`  (got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)})`}`);
};

const token=(u)=>jwt.sign({_id:u._id,role:u.role},process.env.JWT_ACCESS_KEY,{expiresIn:'15m'});
const hit=async(method,path,user,body)=>{
    const res=await fetch(BASE+path,{method,headers:{'Content-Type':'application/json',Authorization:'Bearer '+token(user)},body:body?JSON.stringify(body):undefined});
    let json=null;
    try{ json=await res.json(); }catch{}
    return {code:res.status,json};
};

(async()=>{
    await connect();
    const tag='zzch-'+Date.now();

    try{
        made.subject=await Subject.create({name:tag+'-sub',code:'H'+String(Date.now()).slice(-9)});

        made.head=await User.create({firstName:'Classhead',lastName:'H',email:tag+'h@x.io',password:'x'.repeat(12),role:'teacher',status:'approved'});
        made.owner=await User.create({firstName:'Ownerteach',lastName:'H',email:tag+'o@x.io',password:'x'.repeat(12),role:'teacher',status:'approved'});
        made.other=await User.create({firstName:'Otherteach',lastName:'H',email:tag+'x@x.io',password:'x'.repeat(12),role:'teacher',status:'approved'});
        made.student=await User.create({firstName:'Pupil',lastName:'H',email:tag+'s@x.io',password:'x'.repeat(12),role:'student',status:'approved'});

        made.secA=await Classroom.create({name:tag+'-7A',gradeLevel:7,section:'A',capacity:30,academicYear:'2026-27',supervisorId:made.head._id});
        made.secB=await Classroom.create({name:tag+'-7B',gradeLevel:7,section:'B',capacity:30,academicYear:'2026-27',supervisorId:made.head._id});
        made.foreign=await Classroom.create({name:tag+'-8A',gradeLevel:8,section:'A',capacity:30,academicYear:'2026-27',supervisorId:null});

        made.tpHead=await TeacherProfile.create({userId:made.head._id,classes:[made.secA._id,made.secB._id]});
        made.tpOwner=await TeacherProfile.create({userId:made.owner._id,classes:[made.secA._id,made.foreign._id]});
        made.lessonQuiz=await Lesson.create({name:tag+' qlesson',subjectId:made.subject._id,classId:made.secA._id,teacherId:made.owner._id,day:'friday',startTime:'11:00',endTime:'11:45'});
        made.tpOther=await TeacherProfile.create({userId:made.other._id,classes:[made.foreign._id]});
        made.sp=await StudentProfile.create({userId:made.student._id,classId:made.secA._id});

        const win={startTime:new Date(Date.now()+3600000),endTime:new Date(Date.now()+7200000)};
        const A=String(made.secA._id);
        const sub=String(made.subject._id);

        const exam=await hit('POST','/exams',made.owner,{title:tag+' exam',subjectId:sub,classId:A,maxMarks:50,...win});
        check('owner creates exam',exam.code,201);
        const eid=exam.json.exam._id;
        check('class head CAN edit an exam they did not create',(await hit('PUT','/exams/'+eid,made.head,{room:'B2'})).code,200);
        check('unrelated teacher CANNOT edit it',(await hit('PUT','/exams/'+eid,made.other,{room:'X'})).code,403);

        check('class head CAN enter exam marks',(await hit('POST','/exams/'+eid+'/results',made.head,{entries:[{studentId:String(made.student._id),marksObtained:40}]})).code,201);
        check('unrelated teacher CANNOT enter exam marks',(await hit('POST','/exams/'+eid+'/results',made.other,{entries:[{studentId:String(made.student._id),marksObtained:10}]})).code,403);
        check('class head CAN publish results',(await hit('POST','/exams/'+eid+'/publish',made.head)).code,200);

        const asg=await hit('POST','/assignments',made.owner,{title:tag+' asg',subjectId:sub,classId:A,dueDate:new Date(Date.now()+86400000),maxMarks:20});
        check('owner creates assignment',asg.code,201);
        const aid=asg.json.assignment._id;
        check('class head CAN edit the assignment',(await hit('PUT','/assignments/'+aid,made.head,{maxMarks:25})).code,200);
        check('unrelated teacher CANNOT edit it',(await hit('PUT','/assignments/'+aid,made.other,{maxMarks:1})).code,403);

        made.submission=await Submission.create({assignmentId:aid,studentId:made.student._id,textAnswer:'work'});
        const sid=String(made.submission._id);
        check('unrelated teacher CANNOT mark a submission',(await hit('PUT','/submissions/'+sid+'/grade',made.other,{marksObtained:25})).code,403);
        check('class head CAN mark it (fallback)',(await hit('PUT','/submissions/'+sid+'/grade',made.head,{marksObtained:18})).code,200);
        check('the mark that stuck is the class head\'s',(await Submission.findById(sid)).marksObtained,18);
        check('assigning teacher CAN still mark',(await hit('PUT','/submissions/'+sid+'/grade',made.owner,{marksObtained:20})).code,200);

        const quiz=await hit('POST','/quizzes',made.owner,{title:tag+' quiz',subjectId:sub,classId:A,timeLimit:15,...win,
            questions:[{text:'q',type:'single',marks:2,options:[{text:'a',isCorrect:true},{text:'b'}]}]});
        check('owner creates quiz',quiz.code,201);
        const qid=quiz.json.quiz._id;
        check('class head CAN edit the quiz',(await hit('PUT','/quizzes/'+qid,made.head,{title:tag+' renamed'})).code,200);
        check('class head CAN publish it',(await hit('PATCH','/quizzes/'+qid+'/status',made.head,{status:'published'})).code,200);
        check('unrelated teacher CANNOT publish it',(await hit('PATCH','/quizzes/'+qid+'/status',made.other,{status:'closed'})).code,403);

        const les=await hit('POST','/lessons',made.owner,{name:tag+' lesson',subjectId:sub,classId:A,teacherId:String(made.owner._id),day:'monday',startTime:'09:00',endTime:'10:00'});
        check('owner creates lesson',les.code,201);
        const lid=les.json.lesson._id;
        check('class head CAN edit the timetable',(await hit('PUT','/lessons/'+lid,made.head,{room:'R9'})).code,200);
        check('unrelated teacher CANNOT',(await hit('PUT','/lessons/'+lid,made.other,{room:'R1'})).code,403);

        const foreignExam=await hit('POST','/exams',made.owner,{title:tag+' foreign',subjectId:sub,classId:String(made.foreign._id),maxMarks:50,...win});
        check('owner creates exam in another grade',foreignExam.code,201);
        made.foreignExamId=foreignExam.json.exam._id;
        check('class head CANNOT reach another grade',(await hit('PUT','/exams/'+made.foreignExamId,made.head,{room:'nope'})).code,403);

        made.bExam=await Exam.create({title:tag+' secB',subjectId:made.subject._id,classId:made.secB._id,
            createdBy:made.owner._id,maxMarks:50,...win});
        made.bExamId=String(made.bExam._id);
        check('class head reaches a section they do not teach',(await hit('PUT','/exams/'+made.bExamId,made.head,{room:'B-ok'})).code,200);

        made.globalEvent=await Event.create({title:tag+' global',audience:'all',classId:null,createdBy:made.owner._id,...win});
        check('nobody becomes class head of a school-wide event',(await hit('PUT','/events/'+made.globalEvent._id,made.head,{title:'x'})).code,403);
    }
    catch(err){
        failures++;
        console.log('FAIL  threw:',err.message);
    }
    finally{
        const ids=[made.head?._id,made.owner?._id,made.other?._id,made.student?._id].filter(Boolean);
        await Quiz.deleteMany({title:new RegExp(tag,'i')});
        await QuizAttempt.deleteMany({studentId:{$in:ids}});
        await Result.deleteMany({studentId:{$in:ids}});
        await Exam.deleteMany({title:new RegExp(tag,'i')});
        await Assignment.deleteMany({title:new RegExp(tag,'i')});
        await Submission.deleteMany({studentId:{$in:ids}});
        await Lesson.deleteMany({name:new RegExp(tag,'i')});
        await Event.deleteMany({title:new RegExp(tag,'i')});
        await Announcement.deleteMany({title:new RegExp(tag,'i')});
        await Notification.deleteMany({userId:{$in:ids}});
        await StudentProfile.deleteMany({userId:{$in:ids}});
        await TeacherProfile.deleteMany({userId:{$in:ids}});
        await User.deleteMany({email:new RegExp('^'+tag,'i')});
        await Classroom.deleteMany({name:new RegExp('^'+tag,'i')});
        await Subject.deleteMany({name:new RegExp('^'+tag,'i')});

        const left=await Promise.all([
            User.countDocuments({email:new RegExp('^'+tag,'i')}),
            Classroom.countDocuments({name:new RegExp('^'+tag,'i')}),
            Exam.countDocuments({title:new RegExp(tag,'i')})
        ]);
        console.log(`\ncleanup leftovers [user,class,exam]: ${left.join(',')}`);
        console.log(failures===0?'\nALL CLASS-HEAD CHECKS PASSED':`\n${failures} CHECK(S) FAILED`);
        await disconnect();
        process.exit(failures===0?0:1);
    }
})();
