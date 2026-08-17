// Paper setting and paper marking come apart: the setter owns the paper, the
// section's own subject teacher enters the marks.
const mongoose=require('mongoose');
const {connect,disconnect,BASE}=require('../helpers');
const jwt=require('jsonwebtoken');

const M='../../src/';
const Exam=require('../../src/models/exam');
const Result=require('../../src/models/result');
const Lesson=require('../../src/models/lesson');
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
    const res=await fetch(BASE+path,{method,headers:{'Content-Type':'application/json',Authorization:'Bearer '+token(user)},body:body?JSON.stringify(body):undefined});
    let json=null;
    try{ json=await res.json(); }catch{ /* none */ }
    return {code:res.status,json};
};

(async()=>{
    await connect();
    const tag='zzmk-'+Date.now();

    try{
        made.maths=await Subject.create({name:tag+'-maths',code:'M'+String(Date.now()).slice(-9)});
        made.physics=await Subject.create({name:tag+'-phys',code:'P'+String(Date.now()).slice(-9)});

        made.head=await User.create({firstName:'Gradehead',lastName:'K',email:tag+'h@x.io',password:'x'.repeat(12),role:'teacher',status:'approved'});
        made.setter=await User.create({firstName:'Mathsone',lastName:'K',email:tag+'1@x.io',password:'x'.repeat(12),role:'teacher',status:'approved'});
        made.marker=await User.create({firstName:'Mathstwo',lastName:'K',email:tag+'2@x.io',password:'x'.repeat(12),role:'teacher',status:'approved'});
        made.physTeacher=await User.create({firstName:'Physone',lastName:'K',email:tag+'p@x.io',password:'x'.repeat(12),role:'teacher',status:'approved'});
        made.student=await User.create({firstName:'Pupil',lastName:'K',email:tag+'s@x.io',password:'x'.repeat(12),role:'student',status:'approved'});

        // one grade, two sections; head supervises both
        made.secA=await Classroom.create({name:tag+'-9A',gradeLevel:9,section:'A',capacity:30,academicYear:'2026-27',supervisorId:made.head._id});
        made.secB=await Classroom.create({name:tag+'-9B',gradeLevel:9,section:'B',capacity:30,academicYear:'2026-27',supervisorId:made.head._id});

        // setter teaches Maths in B only; marker teaches Maths in A only
        made.lesSetter=await Lesson.create({name:tag+' m-b',subjectId:made.maths._id,classId:made.secB._id,teacherId:made.setter._id,day:'monday',startTime:'09:00',endTime:'09:45'});
        made.lesMarker=await Lesson.create({name:tag+' m-a',subjectId:made.maths._id,classId:made.secA._id,teacherId:made.marker._id,day:'monday',startTime:'09:00',endTime:'09:45'});
        // a Physics teacher who also teaches section A, but a different subject
        made.lesPhys=await Lesson.create({name:tag+' p-a',subjectId:made.physics._id,classId:made.secA._id,teacherId:made.physTeacher._id,day:'tuesday',startTime:'09:00',endTime:'09:45'});

        made.tpSetter=await TeacherProfile.create({userId:made.setter._id,classes:[made.secB._id]});
        made.tpMarker=await TeacherProfile.create({userId:made.marker._id,classes:[made.secA._id]});
        made.tpPhys=await TeacherProfile.create({userId:made.physTeacher._id,classes:[made.secA._id]});
        made.tpHead=await TeacherProfile.create({userId:made.head._id,classes:[made.secA._id,made.secB._id]});
        made.sp=await StudentProfile.create({userId:made.student._id,classId:made.secA._id});

        // The setter writes section A's paper even though they don't teach A.
        made.exam=await Exam.create({title:tag+' Mid Term Maths 9-A',subjectId:made.maths._id,classId:made.secA._id,
            createdBy:made.setter._id,maxMarks:80,startTime:new Date(Date.now()+3600000),endTime:new Date(Date.now()+7200000)});
        const eid=String(made.exam._id);
        const entry={entries:[{studentId:String(made.student._id),marksObtained:64}]};

        // ---- setting the paper ----
        check('setter CAN edit their own paper',(await hit('PUT','/exams/'+eid,made.setter,{room:'Hall 1'})).code,200);
        check('class head CAN edit the paper',(await hit('PUT','/exams/'+eid,made.head,{room:'Hall 2'})).code,200);
        check('section maths teacher CANNOT edit the paper',(await hit('PUT','/exams/'+eid,made.marker,{room:'nope'})).code,403);

        // ---- marking the paper ----
        check('section maths teacher CAN enter marks',(await hit('POST','/exams/'+eid+'/results',made.marker,entry)).code,201);
        check('the mark landed',(await Result.findOne({examId:made.exam._id})).marksObtained,64);
        check('setter CANNOT mark a section they do not teach',(await hit('POST','/exams/'+eid+'/results',made.setter,entry)).code,403);
        check('a different subject teacher of the same section CANNOT mark',(await hit('POST','/exams/'+eid+'/results',made.physTeacher,entry)).code,403);
        check('class head CAN mark as fallback',(await hit('POST','/exams/'+eid+'/results',made.head,entry)).code,201);

        // ---- publishing ----
        check('section maths teacher CAN publish what they marked',(await hit('POST','/exams/'+eid+'/publish',made.marker)).code,200);

        // ---- the setter marking their OWN section works ----
        made.examB=await Exam.create({title:tag+' Mid Term Maths 9-B',subjectId:made.maths._id,classId:made.secB._id,
            createdBy:made.setter._id,maxMarks:80,startTime:new Date(Date.now()+3600000),endTime:new Date(Date.now()+7200000)});
        made.studentB=await User.create({firstName:'Pupilb',lastName:'K',email:tag+'sb@x.io',password:'x'.repeat(12),role:'student',status:'approved'});
        made.spB=await StudentProfile.create({userId:made.studentB._id,classId:made.secB._id});
        check('setter CAN mark the section they do teach',
            (await hit('POST','/exams/'+String(made.examB._id)+'/results',made.setter,{entries:[{studentId:String(made.studentB._id),marksObtained:70}]})).code,201);
    }
    catch(err){
        failures++;
        console.log('FAIL  threw:',err.message);
    }
    finally{
        const ids=[made.head?._id,made.setter?._id,made.marker?._id,made.physTeacher?._id,made.student?._id,made.studentB?._id].filter(Boolean);
        await Result.deleteMany({studentId:{$in:ids}});
        await Exam.deleteMany({title:new RegExp(tag,'i')});
        await Lesson.deleteMany({name:new RegExp(tag,'i')});
        await Notification.deleteMany({userId:{$in:ids}});
        await StudentProfile.deleteMany({userId:{$in:ids}});
        await TeacherProfile.deleteMany({userId:{$in:ids}});
        await User.deleteMany({email:new RegExp('^'+tag,'i')});
        await Classroom.deleteMany({name:new RegExp('^'+tag,'i')});
        await Subject.deleteMany({name:new RegExp('^'+tag,'i')});

        const left=await Promise.all([
            User.countDocuments({email:new RegExp('^'+tag,'i')}),
            Exam.countDocuments({title:new RegExp(tag,'i')}),
            Result.countDocuments({studentId:{$in:ids}})
        ]);
        console.log(`\ncleanup leftovers [user,exam,result]: ${left.join(',')}`);
        console.log(failures===0?'\nALL MARKS-RULE CHECKS PASSED':`\n${failures} CHECK(S) FAILED`);
        await disconnect();
        process.exit(failures===0?0:1);
    }
})();
