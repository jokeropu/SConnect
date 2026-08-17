const mongoose=require('mongoose');
const {connect,disconnect,BASE}=require('../helpers');
const jwt=require('jsonwebtoken');

const M='../../';
const Attendance=require('../../models/attendance');
const Notification=require('../../models/notification');
const User=require('../../models/user');
const Classroom=require('../../models/classroom');
const StudentProfile=require('../../models/studentProfile');
const TeacherProfile=require('../../models/teacherProfile');

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

const countNotes=(type)=>Notification.countDocuments({userId:made.student._id,type});

(async()=>{
    await connect();
    const tag='ZZATT-'+Date.now();

    try{
        made.klass=await Classroom.create({name:tag+'-class',gradeLevel:9,capacity:30,academicYear:'2026-27'});
        made.teacher=await User.create({firstName:'Teach',lastName:'A',email:tag+'t@x.io',password:'x'.repeat(12),role:'teacher',status:'approved'});
        made.student=await User.create({firstName:'Stud',lastName:'A',email:tag+'s@x.io',password:'x'.repeat(12),role:'student',status:'approved'});
        made.tp=await TeacherProfile.create({userId:made.teacher._id,classes:[made.klass._id]});
        made.sp=await StudentProfile.create({userId:made.student._id,classId:made.klass._id});

        const sid=String(made.student._id);
        const cid=String(made.klass._id);

        for(let i=0;i<12;i++){
            const date=`2026-03-${String(i+1).padStart(2,'0')}`;
            const status=i<9?'absent':'present';
            const r=await hit('POST','/attendance',made.teacher,{classId:cid,date,records:[{studentId:sid,status}]});
            if(r.code!==201) throw new Error('mark failed: '+JSON.stringify(r.json));
        }

        const lowAfterMarking=await countNotes('attendance_low');
        check('low-attendance warned at most once during marking',lowAfterMarking<=1,true);
        check('low-attendance warned at least once',lowAfterMarking>=1,true);

        const before=await countNotes('attendance_low');
        for(let i=0;i<5;i++){
            const r=await hit('GET','/attendance/student',made.student);
            if(r.code!==200) throw new Error('read failed: '+JSON.stringify(r.json));
        }
        const after=await countNotes('attendance_low');
        check('5 page views create ZERO new notifications',after-before,0);

        const view=await hit('GET','/attendance/student',made.student);
        check('response flags belowThreshold',view.json.belowThreshold,true);
        check('response carries the threshold',view.json.threshold,75);
        check('percentage still computed',view.json.percentage,25);

        const absentBefore=await countNotes('attendance_absent');
        await hit('POST','/attendance',made.teacher,{classId:cid,date:'2026-03-01',records:[{studentId:sid,status:'absent'}]});
        await hit('POST','/attendance',made.teacher,{classId:cid,date:'2026-03-01',records:[{studentId:sid,status:'absent'}]});
        check('re-saving an unchanged sheet sends no absent notices',(await countNotes('attendance_absent'))-absentBefore,0);

        const beforeNew=await countNotes('attendance_absent');
        await hit('POST','/attendance',made.teacher,{classId:cid,date:'2026-03-20',records:[{studentId:sid,status:'absent'}]});
        check('a new absence still notifies',(await countNotes('attendance_absent'))-beforeNew,1);

        const beforeFlip=await countNotes('attendance_absent');
        await hit('POST','/attendance',made.teacher,{classId:cid,date:'2026-03-21',records:[{studentId:sid,status:'present'}]});
        check('marking present sends no absent notice',(await countNotes('attendance_absent'))-beforeFlip,0);
        await hit('POST','/attendance',made.teacher,{classId:cid,date:'2026-03-21',records:[{studentId:sid,status:'absent'}]});
        check('correcting present->absent notifies once',(await countNotes('attendance_absent'))-beforeFlip,1);

        const lowBefore=await countNotes('attendance_low');
        await hit('POST','/attendance',made.teacher,{classId:cid,date:'2026-03-22',records:[{studentId:sid,status:'absent'}]});
        check('low-attendance warning is rate limited',(await countNotes('attendance_low'))-lowBefore,0);
    }
    catch(err){
        failures++;
        console.log('FAIL  threw:',err.message);
    }
    finally{
        const ids=[made.student?._id,made.teacher?._id].filter(Boolean);
        await Attendance.deleteMany({classId:made.klass?._id});
        await Notification.deleteMany({userId:{$in:ids}});
        await StudentProfile.deleteMany({_id:made.sp?._id});
        await TeacherProfile.deleteMany({_id:made.tp?._id});
        await User.deleteMany({email:new RegExp(tag,'i')});
        await Classroom.deleteMany({name:new RegExp('^'+tag,'i')});

        const left=await Promise.all([
            Attendance.countDocuments({classId:made.klass?._id}),
            User.countDocuments({email:new RegExp(tag,'i')}),
            Classroom.countDocuments({name:new RegExp(tag,'i')})
        ]);
        console.log(`\ncleanup leftovers [attendance,user,class]: ${left.join(',')}`);
        console.log(failures===0?'\nALL ATTENDANCE CHECKS PASSED':`\n${failures} CHECK(S) FAILED`);
        await disconnect();
        process.exit(failures===0?0:1);
    }
})();
