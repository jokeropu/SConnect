const mongoose=require('mongoose');
const {connect,disconnect,BASE}=require('../helpers');
const jwt=require('jsonwebtoken');

const M='../../src/';
const Quiz=require('../../src/models/quiz');
const Exam=require('../../src/models/exam');
const Lesson=require('../../src/models/lesson');
const Event=require('../../src/models/event');
const User=require('../../src/models/user');
const Classroom=require('../../src/models/classroom');
const Subject=require('../../src/models/subject');
const StudentProfile=require('../../src/models/studentProfile');
const TeacherProfile=require('../../src/models/teacherProfile');
const Notification=require('../../src/models/notification');

const made={};
let failures=0;

const check=(label,actual,expected)=>{
    const ok=JSON.stringify(actual)===JSON.stringify(expected);
    if(!ok) failures++;
    console.log(`${ok?'PASS':'FAIL'}  ${label}${ok?'':`  (got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)})`}`);
};

const token=(u)=>jwt.sign({_id:u._id,role:u.role},process.env.JWT_ACCESS_KEY,{expiresIn:'15m'});

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
    const tag='ZZOWN-'+Date.now();

    try{
        made.subject=await Subject.create({name:tag+'-sub',code:'C'+String(Date.now()).slice(-9)});
        made.klass=await Classroom.create({name:tag+'-class',gradeLevel:9,capacity:30,academicYear:'2026-27'});

        made.owner=await User.create({firstName:'Owner',lastName:'T',email:tag+'o@x.io',password:'x'.repeat(12),role:'teacher',status:'approved'});
        made.coTeacher=await User.create({firstName:'Coteach',lastName:'T',email:tag+'c@x.io',password:'x'.repeat(12),role:'teacher',status:'approved'});
        made.outsider=await User.create({firstName:'Outsider',lastName:'T',email:tag+'x@x.io',password:'x'.repeat(12),role:'teacher',status:'approved'});
        made.admin=await User.create({firstName:'Admin',lastName:'T',email:tag+'a@x.io',password:'x'.repeat(12),role:'admin',status:'approved'});

        made.tp1=await TeacherProfile.create({userId:made.owner._id,classes:[made.klass._id]});
        made.tp2=await TeacherProfile.create({userId:made.coTeacher._id,classes:[made.klass._id]});
        made.tp3=await TeacherProfile.create({userId:made.outsider._id,classes:[]});

        made.student=await User.create({firstName:'Stud',lastName:'T',email:tag+'s@x.io',password:'x'.repeat(12),role:'student',status:'approved'});
        made.sp=await StudentProfile.create({userId:made.student._id,classId:made.klass._id});

        const window={startTime:new Date(Date.now()+3600000),endTime:new Date(Date.now()+7200000)};

        const exam=await hit('POST','/exams',made.owner,{title:tag+' exam',subjectId:String(made.subject._id),classId:String(made.klass._id),maxMarks:50,...window});
        check('owner creates exam',exam.code,201);
        const examId=exam.json.exam._id;

        check('co-teacher CANNOT edit exam',(await hit('PUT','/exams/'+examId,made.coTeacher,{title:'hijacked'})).code,403);
        check('outsider CANNOT edit exam',(await hit('PUT','/exams/'+examId,made.outsider,{title:'hijacked'})).code,403);
        check('co-teacher CANNOT delete exam',(await hit('DELETE','/exams/'+examId,made.coTeacher)).code,403);
        check('co-teacher CANNOT publish exam results',(await hit('POST','/exams/'+examId+'/publish',made.coTeacher)).code,403);
        check('owner CAN edit exam',(await hit('PUT','/exams/'+examId,made.owner,{title:tag+' renamed'})).code,200);
        check('admin CAN edit exam',(await hit('PUT','/exams/'+examId,made.admin,{room:'B12'})).code,200);
        check('exam title actually changed',(await Exam.findById(examId)).title,tag+' renamed');

        made.klass2=await Classroom.create({name:tag+'-class2',gradeLevel:10,capacity:30,academicYear:'2026-27'});
        await hit('PUT','/exams/'+examId,made.owner,{classId:String(made.klass2._id)});
        check('exam classId NOT reassignable',String((await Exam.findById(examId)).classId),String(made.klass._id));
        await hit('PUT','/exams/'+examId,made.owner,{createdBy:String(made.coTeacher._id)});
        check('exam createdBy NOT reassignable',String((await Exam.findById(examId)).createdBy),String(made.owner._id));

        const lesson=await hit('POST','/lessons',made.owner,{name:tag+' lesson',subjectId:String(made.subject._id),classId:String(made.klass._id),teacherId:String(made.owner._id),day:'monday',startTime:'09:00',endTime:'10:00'});
        check('owner creates lesson',lesson.code,201);
        const lessonId=lesson.json.lesson._id;

        check('co-teacher CANNOT edit lesson',(await hit('PUT','/lessons/'+lessonId,made.coTeacher,{name:'hijacked'})).code,403);
        check('co-teacher CANNOT delete lesson',(await hit('DELETE','/lessons/'+lessonId,made.coTeacher)).code,403);
        check('owner CAN edit lesson',(await hit('PUT','/lessons/'+lessonId,made.owner,{room:'A1'})).code,200);
        await hit('PUT','/lessons/'+lessonId,made.owner,{teacherId:String(made.coTeacher._id)});
        check('lesson teacherId NOT reassignable',String((await Lesson.findById(lessonId)).teacherId),String(made.owner._id));

        const event=await hit('POST','/events',made.owner,{title:tag+' event',audience:'class',classId:String(made.klass._id),...window});
        check('owner creates class event',event.code,201);
        const eventId=event.json.event._id;

        check('co-teacher CANNOT edit event',(await hit('PUT','/events/'+eventId,made.coTeacher,{title:'hijacked'})).code,403);
        check('co-teacher CANNOT delete event',(await hit('DELETE','/events/'+eventId,made.coTeacher)).code,403);
        check('owner CAN edit event',(await hit('PUT','/events/'+eventId,made.owner,{title:tag+' renamed'})).code,200);
        await hit('PUT','/events/'+eventId,made.owner,{audience:'all',classId:null});
        check('event audience NOT escalatable to school-wide',(await Event.findById(eventId)).audience,'class');

        const quiz=await hit('POST','/quizzes',made.owner,{title:tag+' quiz',subjectId:String(made.subject._id),classId:String(made.klass._id),timeLimit:20,...window,
            questions:[{text:'2+2?',type:'single',marks:2,options:[{text:'4',isCorrect:true},{text:'5'}]}]});
        check('owner creates quiz',quiz.code,201);
        const quizId=quiz.json.quiz._id;

        check('co-teacher CANNOT edit quiz',(await hit('PUT','/quizzes/'+quizId,made.coTeacher,{title:'hijacked'})).code,403);
        check('co-teacher CANNOT delete quiz',(await hit('DELETE','/quizzes/'+quizId,made.coTeacher)).code,403);
        check('co-teacher CANNOT publish quiz',(await hit('PATCH','/quizzes/'+quizId+'/status',made.coTeacher,{status:'published'})).code,403);
        check('outsider CANNOT publish quiz',(await hit('PATCH','/quizzes/'+quizId+'/status',made.outsider,{status:'published'})).code,403);
        check('owner CAN edit quiz',(await hit('PUT','/quizzes/'+quizId,made.owner,{title:tag+' renamed'})).code,200);
        check('owner CAN publish quiz',(await hit('PATCH','/quizzes/'+quizId+'/status',made.owner,{status:'published'})).code,200);
        check('admin CAN close quiz',(await hit('PATCH','/quizzes/'+quizId+'/status',made.admin,{status:'closed'})).code,200);

        check('co-teacher CAN still view quiz results',(await hit('GET','/quizzes/'+quizId+'/results',made.coTeacher)).code,200);
        check('outsider CANNOT view quiz results',(await hit('GET','/quizzes/'+quizId+'/results',made.outsider)).code,400);
        check('co-teacher CAN still view quiz detail',(await hit('GET','/quizzes/'+quizId,made.coTeacher)).code,200);

        check('owner CAN delete quiz',(await hit('DELETE','/quizzes/'+quizId,made.owner)).code,200);
        check('owner CAN delete exam',(await hit('DELETE','/exams/'+examId,made.owner)).code,200);
        check('owner CAN delete lesson',(await hit('DELETE','/lessons/'+lessonId,made.owner)).code,200);
        check('owner CAN delete event',(await hit('DELETE','/events/'+eventId,made.owner)).code,200);
    }
    catch(err){
        failures++;
        console.log('FAIL  threw:',err.message);
    }
    finally{
        const ids=Object.values(made).map((d)=>d?._id).filter(Boolean);
        await Quiz.deleteMany({title:new RegExp('^'+tag,'i')});
        await Exam.deleteMany({title:new RegExp('^'+tag,'i')});
        await Lesson.deleteMany({name:new RegExp('^'+tag,'i')});
        await Event.deleteMany({title:new RegExp('^'+tag,'i')});
        await StudentProfile.deleteMany({_id:made.sp?._id});
        await TeacherProfile.deleteMany({_id:{$in:[made.tp1?._id,made.tp2?._id,made.tp3?._id].filter(Boolean)}});
        await Notification.deleteMany({userId:{$in:ids}});
        await User.deleteMany({email:new RegExp(tag,'i')});
        await Classroom.deleteMany({name:new RegExp('^'+tag,'i')});
        await Subject.deleteMany({name:new RegExp('^'+tag,'i')});

        const left=await Promise.all([
            Quiz.countDocuments({title:new RegExp(tag,'i')}),Exam.countDocuments({title:new RegExp(tag,'i')}),
            Lesson.countDocuments({name:new RegExp(tag,'i')}),Event.countDocuments({title:new RegExp(tag,'i')}),
            User.countDocuments({email:new RegExp(tag,'i')}),Classroom.countDocuments({name:new RegExp(tag,'i')})
        ]);
        console.log(`\ncleanup leftovers [quiz,exam,lesson,event,user,class]: ${left.join(',')}`);
        console.log(failures===0?'\nALL OWNERSHIP CHECKS PASSED':`\n${failures} CHECK(S) FAILED`);
        await disconnect();
        process.exit(failures===0?0:1);
    }
})();
