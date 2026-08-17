const mongoose=require('mongoose');
const {connect,disconnect,BASE}=require('../helpers');
const jwt=require('jsonwebtoken');

const M='../../src/';
const Exam=require('../../src/models/exam');
const Lesson=require('../../src/models/lesson');
const User=require('../../src/models/user');
const Classroom=require('../../src/models/classroom');
const Subject=require('../../src/models/subject');
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

const classesOf=async(userId)=>{
    const p=await TeacherProfile.findOne({userId}).select('classes');
    return (p?.classes || []).map(String);
};

(async()=>{
    await connect();
    const tag='ZZMA-'+Date.now();

    try{
        made.subject=await Subject.create({name:tag+'-sub',code:'C'+String(Date.now()).slice(-9)});
        made.klass=await Classroom.create({name:tag+'-class',gradeLevel:9,capacity:30,academicYear:'2026-27'});

        made.admin=await User.create({firstName:'Admin',lastName:'M',email:tag+'a@x.io',password:'x'.repeat(12),role:'admin',status:'approved'});
        made.insider=await User.create({firstName:'Insider',lastName:'M',email:tag+'i@x.io',password:'x'.repeat(12),role:'teacher',status:'approved'});
        made.attacker=await User.create({firstName:'Attacker',lastName:'M',email:tag+'k@x.io',password:'x'.repeat(12),role:'teacher',status:'approved'});
        made.victim=await User.create({firstName:'Victim',lastName:'M',email:tag+'v@x.io',password:'x'.repeat(12),role:'teacher',status:'approved'});

        made.tpI=await TeacherProfile.create({userId:made.insider._id,classes:[made.klass._id]});
        made.tpK=await TeacherProfile.create({userId:made.attacker._id,classes:[]});
        made.tpV=await TeacherProfile.create({userId:made.victim._id,classes:[]});

        const lesson=(over={})=>({name:tag+' lesson',subjectId:String(made.subject._id),classId:String(made.klass._id),
            teacherId:String(made.insider._id),day:'tuesday',startTime:'11:00',endTime:'12:00',...over});

        const esc=await hit('POST','/lessons',made.attacker,lesson({teacherId:String(made.attacker._id)}));
        check('teacher without class access CANNOT create lesson there',esc.code,403);
        check('attacker gained NO class access',await classesOf(made.attacker._id),[]);

        const hijack=await hit('POST','/lessons',made.insider,lesson({teacherId:String(made.victim._id),startTime:'13:00',endTime:'14:00'}));
        check('insider can create a lesson in their own class',hijack.code,201);
        check('teacherId forced to the creator',String(hijack.json.lesson.teacherId),String(made.insider._id));
        check('victim was NOT granted class access',await classesOf(made.victim._id),[]);

        const assigned=await hit('POST','/lessons',made.admin,lesson({teacherId:String(made.victim._id),startTime:'15:00',endTime:'16:00'}));
        check('admin CAN assign another teacher',assigned.code,201);
        check('admin assignment keeps requested teacher',String(assigned.json.lesson.teacherId),String(made.victim._id));
        check('admin assignment grants that teacher the class',await classesOf(made.victim._id),[String(made.klass._id)]);

        const normal=await hit('POST','/lessons',made.insider,lesson({startTime:'08:00',endTime:'09:00'}));
        check('assigned teacher can still add their own lesson',normal.code,201);

        const exam=await hit('POST','/exams',made.insider,{title:tag+' exam',subjectId:String(made.subject._id),
            classId:String(made.klass._id),maxMarks:50,resultsPublished:true,
            startTime:new Date(Date.now()+3600000),endTime:new Date(Date.now()+7200000)});
        check('exam created',exam.code,201);
        check('resultsPublished NOT injectable at creation',(await Exam.findById(exam.json.exam._id)).resultsPublished,false);

        const newClass=await hit('POST','/classes',made.admin,{name:tag+'-c2',gradeLevel:10,section:'B',capacity:25,
            academicYear:'2026-27',supervisorId:String(made.insider._id),subjects:[String(made.subject._id)]});
        check('admin can still create a class with all fields',newClass.code,201);
        check('class supervisorId persisted',String(newClass.json.classroom.supervisorId),String(made.insider._id));
        check('class subjects persisted',newClass.json.classroom.subjects.length,1);

        const upd=await hit('PUT','/classes/'+newClass.json.classroom._id,made.admin,{capacity:44,section:'C'});
        check('admin can still update a class',[upd.code,upd.json.classroom.capacity,upd.json.classroom.section],[200,44,'C']);

        const newSubject=await hit('POST','/subjects',made.admin,{name:tag+'-s2',code:'D'+String(Date.now()).slice(-9),
            description:'desc',teachers:[String(made.insider._id)]});
        check('admin can still create a subject with all fields',newSubject.code,201);
        check('subject description persisted',newSubject.json.subject.description,'desc');
        check('subject teachers persisted',newSubject.json.subject.teachers.length,1);

        const updS=await hit('PUT','/subjects/'+newSubject.json.subject._id,made.admin,{description:'changed'});
        check('admin can still update a subject',[updS.code,updS.json.subject.description],[200,'changed']);
    }
    catch(err){
        failures++;
        console.log('FAIL  threw:',err.message);
    }
    finally{
        const ids=Object.values(made).map((d)=>d?._id).filter(Boolean);
        await Lesson.deleteMany({name:new RegExp('^'+tag,'i')});
        await Exam.deleteMany({title:new RegExp('^'+tag,'i')});
        await TeacherProfile.deleteMany({userId:{$in:ids}});
        await Notification.deleteMany({userId:{$in:ids}});
        await User.deleteMany({email:new RegExp(tag,'i')});
        await Classroom.deleteMany({name:new RegExp('^'+tag,'i')});
        await Subject.deleteMany({name:new RegExp('^'+tag,'i')});

        const left=await Promise.all([
            Lesson.countDocuments({name:new RegExp(tag,'i')}),Exam.countDocuments({title:new RegExp(tag,'i')}),
            User.countDocuments({email:new RegExp(tag,'i')}),Classroom.countDocuments({name:new RegExp(tag,'i')}),
            Subject.countDocuments({name:new RegExp(tag,'i')})
        ]);
        console.log(`\ncleanup leftovers [lesson,exam,user,class,subject]: ${left.join(',')}`);
        console.log(failures===0?'\nALL MASS-ASSIGNMENT CHECKS PASSED':`\n${failures} CHECK(S) FAILED`);
        await disconnect();
        process.exit(failures===0?0:1);
    }
})();
