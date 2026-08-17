const mongoose=require('mongoose');
const {connect,disconnect,BASE}=require('../helpers');

const M='../../';
const User=require('../../models/user');
const Classroom=require('../../models/classroom');
const Subject=require('../../models/subject');
const Lesson=require('../../models/lesson');
const StudentProfile=require('../../models/studentProfile');
const TeacherProfile=require('../../models/teacherProfile');
const ParentProfile=require('../../models/parentProfile');
const {contactList,canMessage}=require('../../controllers/messageController');

const made={users:[],other:[]};
let failures=0;

const check=(label,actual,expected)=>{
    const ok=JSON.stringify(actual)===JSON.stringify(expected);
    if(!ok) failures++;
    console.log(`${ok?'PASS':'FAIL'}  ${label}${ok?'':`\n        got  ${JSON.stringify(actual)}\n        want ${JSON.stringify(expected)}`}`);
};

const call=async(user,search)=>{
    let payload;
    const res={status(){return this;},json(p){payload=p;return this;}};
    await contactList({result:user,query:{search:search||undefined,limit:100},params:{},body:{}},res);
    return payload.data;
};

const expectedFor=async(me,everyone)=>{
    const allowed=[];
    for(const u of everyone){
        if(String(u._id)===String(me._id)) continue;
        if(u.status!=='approved') continue;
        if(await canMessage(me,u._id)) allowed.push(String(u._id));
    }
    return allowed.sort();
};

const mkUser=async(tag,role,name)=>{
    const u=await User.create({firstName:name,lastName:'Cx',email:`${tag}${name}@x.io`,
        password:'x'.repeat(12),role,status:'approved'});
    made.users.push(u);
    return u;
};

(async()=>{
    await connect();
    const tag='ZZCON-'+Date.now()+'-';

    try{
        const subject=await Subject.create({name:tag+'sub',code:(tag+'S').slice(0,12)});
        const classX=await Classroom.create({name:tag+'X',gradeLevel:9,capacity:50,academicYear:'2026-27'});
        const classY=await Classroom.create({name:tag+'Y',gradeLevel:10,capacity:50,academicYear:'2026-27'});
        made.other.push(subject,classX,classY);

        const admin=await mkUser(tag,'admin','Adminone');
        const teachX=await mkUser(tag,'teacher','Teachx');
        const teachY=await mkUser(tag,'teacher','Teachy');
        const studX=await mkUser(tag,'student','Studx');
        const studY=await mkUser(tag,'student','Study');
        const parentX=await mkUser(tag,'parent','Parentx');
        const parentY=await mkUser(tag,'parent','Parenty');

        made.other.push(
            await TeacherProfile.create({userId:teachX._id,classes:[classX._id]}),
            await TeacherProfile.create({userId:teachY._id,classes:[classY._id]}),
            await StudentProfile.create({userId:studX._id,classId:classX._id,parentId:parentX._id}),
            await StudentProfile.create({userId:studY._id,classId:classY._id,parentId:parentY._id}),
            await ParentProfile.create({userId:parentX._id,children:[studX._id]}),
            await ParentProfile.create({userId:parentY._id,children:[studY._id]}),
            await Lesson.create({name:tag+'lx',subjectId:subject._id,classId:classX._id,teacherId:teachX._id,day:'monday',startTime:'09:00',endTime:'10:00'}),
            await Lesson.create({name:tag+'ly',subjectId:subject._id,classId:classY._id,teacherId:teachY._id,day:'monday',startTime:'09:00',endTime:'10:00'})
        );

        const everyone=await User.find({email:new RegExp('^'+tag,'i')});

        for(const [label,me] of [['teacher',teachX],['student',studX],['parent',parentX],['admin',admin]]){
            const got=(await call(me,tag)).map((u)=>String(u._id)).filter((id)=>everyone.some((u)=>String(u._id)===id)).sort();
            const want=await expectedFor(me,everyone);
            check(`${label} contact set matches canMessage exactly`,got,want);
        }

        const teacherNames=(await call(teachX,tag)).filter((u)=>everyone.some((e)=>String(e._id)===String(u._id))).map((u)=>u.firstName).sort();
        check('teacher sees own students and their parents, plus staff',teacherNames,['Adminone','Parentx','Studx','Teachy']);

        const studentNames=(await call(studX,tag)).filter((u)=>everyone.some((e)=>String(e._id)===String(u._id))).map((u)=>u.firstName).sort();
        check('student sees only admins and their own teachers',studentNames,['Adminone','Teachx']);

        const parentNames=(await call(parentX,tag)).filter((u)=>everyone.some((e)=>String(e._id)===String(u._id))).map((u)=>u.firstName).sort();
        check("parent sees only admins and their child's teachers",parentNames,['Adminone','Teachx']);

        let ops=0;
        mongoose.set('debug',()=>{ ops++; });

        ops=0; await call(teachX,tag); const teacherOpsSmall=ops;
        ops=0; await call(studX,tag);  const studentOps=ops;
        ops=0; await call(admin,tag);  const adminOps=ops;

        for(let i=0;i<40;i++) await mkUser(tag,'teacher','Pad'+String(i).padStart(2,'0'));

        ops=0; await call(teachX,tag); const teacherOpsBig=ops;
        mongoose.set('debug',false);

        console.log(`\n        queries — teacher(6 users): ${teacherOpsSmall}, teacher(46 users): ${teacherOpsBig}, student: ${studentOps}, admin: ${adminOps}`);
        check('teacher query count is flat as users grow',teacherOpsBig,teacherOpsSmall);
        check('teacher stays under 10 queries',teacherOpsSmall<10,true);
        check('student stays under 10 queries',studentOps<10,true);
        check('admin needs a constant two queries (list + total)',adminOps,2);

        const after=(await call(teachX,tag)).filter((u)=>everyone.concat(made.users).some((e)=>String(e._id)===String(u._id)));
        check('padding teachers are all included',after.length,44);
    }
    catch(err){
        failures++;
        console.log('FAIL  threw:',err.message);
    }
    finally{
        mongoose.set('debug',false);
        const ids=made.users.map((u)=>u._id);
        await Lesson.deleteMany({name:new RegExp('^'+tag,'i')});
        await StudentProfile.deleteMany({userId:{$in:ids}});
        await TeacherProfile.deleteMany({userId:{$in:ids}});
        await ParentProfile.deleteMany({userId:{$in:ids}});
        await mongoose.model('notification').deleteMany({userId:{$in:ids}});
        await User.deleteMany({email:new RegExp('^'+tag,'i')});
        await Classroom.deleteMany({name:new RegExp('^'+tag,'i')});
        await Subject.deleteMany({name:new RegExp('^'+tag,'i')});

        const left=await Promise.all([
            User.countDocuments({email:new RegExp('^'+tag,'i')}),
            Classroom.countDocuments({name:new RegExp('^'+tag,'i')}),
            Lesson.countDocuments({name:new RegExp('^'+tag,'i')})
        ]);
        console.log(`\ncleanup leftovers [user,class,lesson]: ${left.join(',')}`);
        console.log(failures===0?'\nALL CONTACT-LIST CHECKS PASSED':`\n${failures} CHECK(S) FAILED`);
        await disconnect();
        process.exit(failures===0?0:1);
    }
})();
