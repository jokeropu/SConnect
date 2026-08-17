const mongoose=require('mongoose');
const {connect,disconnect,BASE}=require('../helpers');
const jwt=require('jsonwebtoken');

const M='../../';
const Quiz=require('../../models/quiz');
const QuizAttempt=require('../../models/quizAttempt');
const Result=require('../../models/result');
const Lesson=require('../../models/lesson');
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
    const tag='zzqs-'+Date.now();

    try{
        made.maths=await Subject.create({name:tag+'-maths',code:'Q'+String(Date.now()).slice(-9)});
        made.physics=await Subject.create({name:tag+'-phys',code:'R'+String(Date.now()).slice(-9)});

        made.head=await User.create({firstName:'Gradehead',lastName:'Q',email:tag+'h@x.io',password:'x'.repeat(12),role:'teacher',status:'approved'});
        made.mathsA=await User.create({firstName:'Mathsa',lastName:'Q',email:tag+'ma@x.io',password:'x'.repeat(12),role:'teacher',status:'approved'});
        made.physA=await User.create({firstName:'Physa',lastName:'Q',email:tag+'pa@x.io',password:'x'.repeat(12),role:'teacher',status:'approved'});
        made.mathsOther=await User.create({firstName:'Mathsother',lastName:'Q',email:tag+'mo@x.io',password:'x'.repeat(12),role:'teacher',status:'approved'});

        made.secA=await Classroom.create({name:tag+'-6A',gradeLevel:6,section:'A',capacity:30,academicYear:'2026-27',supervisorId:made.head._id});
        made.secB=await Classroom.create({name:tag+'-6B',gradeLevel:6,section:'B',capacity:30,academicYear:'2026-27',supervisorId:made.head._id});
        made.outside=await Classroom.create({name:tag+'-7A',gradeLevel:7,section:'A',capacity:30,academicYear:'2026-27',supervisorId:null});

        made.l1=await Lesson.create({name:tag+' m6a',subjectId:made.maths._id,classId:made.secA._id,teacherId:made.mathsA._id,day:'monday',startTime:'09:00',endTime:'09:45'});
        made.l2=await Lesson.create({name:tag+' p6a',subjectId:made.physics._id,classId:made.secA._id,teacherId:made.physA._id,day:'tuesday',startTime:'09:00',endTime:'09:45'});
        made.l3=await Lesson.create({name:tag+' m7a',subjectId:made.maths._id,classId:made.outside._id,teacherId:made.mathsOther._id,day:'monday',startTime:'10:00',endTime:'10:45'});

        made.tpHead=await TeacherProfile.create({userId:made.head._id,classes:[made.secA._id,made.secB._id]});
        made.tpMathsA=await TeacherProfile.create({userId:made.mathsA._id,classes:[made.secA._id]});
        made.tpPhysA=await TeacherProfile.create({userId:made.physA._id,classes:[made.secA._id]});
        made.tpOther=await TeacherProfile.create({userId:made.mathsOther._id,classes:[made.outside._id]});

        const win={startTime:new Date(Date.now()-60000),endTime:new Date(Date.now()+3600000)};
        const q=(classId,subjectId)=>({title:tag+' quiz',subjectId:String(subjectId),classId:String(classId),timeLimit:15,...win,
            questions:[{text:'q',type:'single',marks:2,options:[{text:'a',isCorrect:true},{text:'b'}]}]});

        const own=await hit('POST','/quizzes',made.mathsA,q(made.secA._id,made.maths._id));
        check('subject teacher of the section CAN set a quiz',own.code,201);
        made.quiz=own.json.quiz;

        check('a teacher of a DIFFERENT subject in the same section CANNOT',
            (await hit('POST','/quizzes',made.physA,q(made.secA._id,made.maths._id))).code,403);

        check('the same subject teacher from another grade CANNOT',
            (await hit('POST','/quizzes',made.mathsOther,q(made.secA._id,made.maths._id))).code,403);

        const headA=await hit('POST','/quizzes',made.head,q(made.secA._id,made.maths._id));
        check('class head CAN set a quiz for section A',headA.code,201);
        made.quizHeadA=headA.json.quiz;

        const headB=await hit('POST','/quizzes',made.head,q(made.secB._id,made.maths._id));
        check('class head CAN set one for section B, which nobody teaches',headB.code,201);
        made.quizHeadB=headB.json.quiz;

        check('class head CANNOT set a quiz outside their grade',
            (await hit('POST','/quizzes',made.head,q(made.outside._id,made.maths._id))).code,403);

        check('the two quizzes are separate records for separate sections',
            String(made.quizHeadA.classId)!==String(made.quizHeadB.classId),true);
        check('section A has its own quizzes only',
            await Quiz.countDocuments({classId:made.secA._id,title:new RegExp(tag,'i')}),2);
        check('section B has its own',
            await Quiz.countDocuments({classId:made.secB._id,title:new RegExp(tag,'i')}),1);

        check('creator CAN edit their quiz',(await hit('PUT','/quizzes/'+made.quiz._id,made.mathsA,{title:tag+' edited'})).code,200);
        check('class head CAN edit it too',(await hit('PUT','/quizzes/'+made.quiz._id,made.head,{timeLimit:20})).code,200);
        check('another subject teacher CANNOT edit it',(await hit('PUT','/quizzes/'+made.quiz._id,made.physA,{timeLimit:1})).code,403);

        const phys=await hit('POST','/quizzes',made.physA,q(made.secA._id,made.physics._id));
        check('physics teacher CAN set a physics quiz there',phys.code,201);
        made.quizPhys=phys.json.quiz;
    }
    catch(err){
        failures++;
        console.log('FAIL  threw:',err.message);
    }
    finally{
        const ids=[made.head?._id,made.mathsA?._id,made.physA?._id,made.mathsOther?._id].filter(Boolean);
        await Quiz.deleteMany({title:new RegExp(tag,'i')});
        await QuizAttempt.deleteMany({quizId:{$exists:true},studentId:{$in:ids}});
        await Result.deleteMany({studentId:{$in:ids}});
        await Lesson.deleteMany({name:new RegExp(tag,'i')});
        await Notification.deleteMany({userId:{$in:ids}});
        await StudentProfile.deleteMany({userId:{$in:ids}});
        await TeacherProfile.deleteMany({userId:{$in:ids}});
        await User.deleteMany({email:new RegExp('^'+tag,'i')});
        await Classroom.deleteMany({name:new RegExp('^'+tag,'i')});
        await Subject.deleteMany({name:new RegExp('^'+tag,'i')});

        const left=await Promise.all([
            User.countDocuments({email:new RegExp('^'+tag,'i')}),
            Quiz.countDocuments({title:new RegExp(tag,'i')}),
            Classroom.countDocuments({name:new RegExp('^'+tag,'i')})
        ]);
        console.log(`\ncleanup leftovers [user,quiz,class]: ${left.join(',')}`);
        console.log(failures===0?'\nALL QUIZ-SETTER CHECKS PASSED':`\n${failures} CHECK(S) FAILED`);
        await disconnect();
        process.exit(failures===0?0:1);
    }
})();
