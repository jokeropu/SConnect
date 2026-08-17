// A teacher must not be timetabled into two places at once.
const mongoose=require('mongoose');
const {connect,disconnect,BASE}=require('../helpers');
const jwt=require('jsonwebtoken');

const M='../../src/';
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
    const res=await fetch(BASE+path,{method,headers:{'Content-Type':'application/json',Authorization:'Bearer '+token(user)},body:body?JSON.stringify(body):undefined});
    let json=null;
    try{ json=await res.json(); }catch{ /* none */ }
    return {code:res.status,json};
};

(async()=>{
    await connect();
    const tag='zztt-'+Date.now();

    try{
        made.subject=await Subject.create({name:tag+'-sub',code:'T'+String(Date.now()).slice(-9)});
        made.admin=await User.create({firstName:'Timeadmin',lastName:'T',email:tag+'a@x.io',password:'x'.repeat(12),role:'admin',status:'approved'});
        made.teacher=await User.create({firstName:'Busyteach',lastName:'T',email:tag+'t@x.io',password:'x'.repeat(12),role:'teacher',status:'approved'});
        made.other=await User.create({firstName:'Freeteach',lastName:'T',email:tag+'f@x.io',password:'x'.repeat(12),role:'teacher',status:'approved'});

        made.secA=await Classroom.create({name:tag+'-5A',gradeLevel:5,section:'A',capacity:30,academicYear:'2026-27'});
        made.secB=await Classroom.create({name:tag+'-5B',gradeLevel:5,section:'B',capacity:30,academicYear:'2026-27'});
        made.tp=await TeacherProfile.create({userId:made.teacher._id,classes:[made.secA._id,made.secB._id]});
        made.tpo=await TeacherProfile.create({userId:made.other._id,classes:[made.secB._id]});

        const les=(over={})=>({name:tag+' lesson',subjectId:String(made.subject._id),classId:String(made.secA._id),
            teacherId:String(made.teacher._id),day:'monday',startTime:'09:00',endTime:'09:45',...over});

        const first=await hit('POST','/lessons',made.admin,les());
        check('first lesson created',first.code,201);
        made.first=first.json.lesson;

        // same teacher, same time, DIFFERENT class -> must be refused
        const dbl=await hit('POST','/lessons',made.admin,les({classId:String(made.secB._id)}));
        check('same teacher cannot be in two classes at once',dbl.code,400);
        check('the error names the conflict',/already takes/.test(dbl.json.error||''),true);

        // partial overlap counts too
        const partial=await hit('POST','/lessons',made.admin,les({classId:String(made.secB._id),startTime:'09:30',endTime:'10:15'}));
        check('a partial overlap is also refused',partial.code,400);

        // a different teacher at the same time is fine
        const okOther=await hit('POST','/lessons',made.admin,les({classId:String(made.secB._id),teacherId:String(made.other._id)}));
        check('a free teacher CAN take that slot',okOther.code,201);
        made.otherLesson=okOther.json.lesson;

        // same teacher, adjacent but non-overlapping slot is fine
        const adjacent=await hit('POST','/lessons',made.admin,les({classId:String(made.secB._id),startTime:'09:45',endTime:'10:30'}));
        check('back-to-back slots are allowed',adjacent.code,201);
        made.adjacent=adjacent.json.lesson;

        // same teacher, same time, different DAY is fine
        const otherDay=await hit('POST','/lessons',made.admin,les({classId:String(made.secB._id),day:'tuesday'}));
        check('same time on another day is allowed',otherDay.code,201);
        made.otherDay=otherDay.json.lesson;

        // the original per-class rule still holds
        const classClash=await hit('POST','/lessons',made.admin,les({teacherId:String(made.other._id)}));
        check('two lessons in one class at one time still refused',classClash.code,400);
        check('and it reports the class clash, not the teacher one',/clashes with/.test(classClash.json.error||''),true);

        // editing must not create a double-booking either
        const move=await hit('PUT','/lessons/'+made.adjacent._id,made.admin,{startTime:'09:00',endTime:'09:45'});
        check('editing a lesson onto a busy slot is refused',move.code,400);
        check('the moved lesson kept its original time',(await Lesson.findById(made.adjacent._id)).startTime,'09:45');
    }
    catch(err){
        failures++;
        console.log('FAIL  threw:',err.message);
    }
    finally{
        const ids=[made.admin?._id,made.teacher?._id,made.other?._id].filter(Boolean);
        await Lesson.deleteMany({name:new RegExp('^'+tag,'i')});
        await Notification.deleteMany({userId:{$in:ids}});
        await TeacherProfile.deleteMany({userId:{$in:ids}});
        await User.deleteMany({email:new RegExp('^'+tag,'i')});
        await Classroom.deleteMany({name:new RegExp('^'+tag,'i')});
        await Subject.deleteMany({name:new RegExp('^'+tag,'i')});

        const left=await Promise.all([
            User.countDocuments({email:new RegExp('^'+tag,'i')}),
            Lesson.countDocuments({name:new RegExp('^'+tag,'i')})
        ]);
        console.log(`\ncleanup leftovers [user,lesson]: ${left.join(',')}`);
        console.log(failures===0?'\nALL TIMETABLE CHECKS PASSED':`\n${failures} CHECK(S) FAILED`);
        await disconnect();
        process.exit(failures===0?0:1);
    }
})();
