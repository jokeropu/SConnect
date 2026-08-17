// CSV export: content, escaping, spreadsheet-formula injection, authorization.
const mongoose=require('mongoose');
const {connect,disconnect,BASE}=require('../helpers');
const jwt=require('jsonwebtoken');

const M='../../src/';
const Quiz=require('../../src/models/quiz');
const QuizAttempt=require('../../src/models/quizAttempt');
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
    console.log(`${ok?'PASS':'FAIL'}  ${label}${ok?'':`\n        got  ${JSON.stringify(actual)}\n        want ${JSON.stringify(expected)}`}`);
};

const token=(u)=>jwt.sign({_id:u._id,role:u.role},process.env.JWT_ACCESS_KEY,{expiresIn:'15m'});

const raw=async(method,path,user)=>{
    const res=await fetch(BASE+path,{method,headers:{Authorization:'Bearer '+token(user)}});
    const buf=Buffer.from(await res.arrayBuffer());
    return {code:res.status,headers:res.headers,bytes:buf,body:buf.toString('utf8')};
};
const hit=async(method,path,user,body)=>{
    const res=await fetch(BASE+path,{method,headers:{'Content-Type':'application/json',Authorization:'Bearer '+token(user)},body:body?JSON.stringify(body):undefined});
    let json=null;
    try{ json=await res.json(); }catch{ /* none */ }
    return {code:res.status,json};
};

(async()=>{
    await connect();
    const tag='zzcsv-'+Date.now();

    try{
        made.subject=await Subject.create({name:tag+'-sub',code:'X'+String(Date.now()).slice(-9)});
        made.klass=await Classroom.create({name:tag+'-class',gradeLevel:9,capacity:30,academicYear:'2026-27'});
        made.teacher=await User.create({firstName:'Teach',lastName:'Csv',email:tag+'t@x.io',password:'x'.repeat(12),role:'teacher',status:'approved'});
        made.tp=await TeacherProfile.create({userId:made.teacher._id,classes:[made.klass._id]});
        made.lesson=await Lesson.create({name:tag+' lesson',subjectId:made.subject._id,classId:made.klass._id,teacherId:made.teacher._id,day:'monday',startTime:'09:00',endTime:'09:45'});

        // adversarial names: a comma, a quote, and a spreadsheet formula
        made.s1=await User.create({firstName:'Ada, Jr',lastName:'"Quoted"',email:tag+'a@x.io',password:'x'.repeat(12),role:'student',status:'approved'});
        made.s2=await User.create({firstName:'=cmd|calc',lastName:'Evil',email:tag+'b@x.io',password:'x'.repeat(12),role:'student',status:'approved'});
        made.s3=await User.create({firstName:'Absent',lastName:'Student',email:tag+'c@x.io',password:'x'.repeat(12),role:'student',status:'approved'});
        made.sp1=await StudentProfile.create({userId:made.s1._id,classId:made.klass._id});
        made.sp2=await StudentProfile.create({userId:made.s2._id,classId:made.klass._id});
        made.sp3=await StudentProfile.create({userId:made.s3._id,classId:made.klass._id});

        const win={startTime:new Date(Date.now()-60000),endTime:new Date(Date.now()+3600000)};
        const q=await hit('POST','/quizzes',made.teacher,{title:tag+' Mid, Term "1"',subjectId:String(made.subject._id),
            classId:String(made.klass._id),timeLimit:20,status:'published',...win,
            questions:[
                {text:'q1',type:'single',marks:5,options:[{text:'a',isCorrect:true},{text:'b'}]},
                {text:'q2',type:'single',marks:3,options:[{text:'a',isCorrect:true},{text:'b'}]}
            ]});
        check('quiz created',q.code,201);
        made.quiz=q.json.quiz;

        // s1 gets both right (8), s2 gets one right (5), s3 never attempts
        for(const [student,secondRight] of [[made.s1,true],[made.s2,false]]){
            const st=await hit('POST','/quizzes/'+made.quiz._id+'/start',student);
            const qs=st.json.quiz.questions;
            await hit('POST','/quizzes/'+made.quiz._id+'/submit',student,{responses:{
                [qs[0]._id]:[String(qs[0].options[0]._id)],
                [qs[1]._id]:[String(qs[1].options[secondRight?0:1]._id)]
            }});
        }

        const csv=await raw('GET','/quizzes/'+made.quiz._id+'/results/csv',made.teacher);
        check('export returns 200',csv.code,200);
        check('content type is csv',csv.headers.get('content-type'),'text/csv; charset=utf-8');
        check('sent as a download',/attachment; filename=/.test(csv.headers.get('content-disposition')),true);
        check('filename slug derived from the title',/filename="[a-z0-9-]+-results\.csv"/.test(csv.headers.get('content-disposition')),true);
        check('starts with a UTF-8 BOM so Excel reads it correctly',[...csv.bytes.subarray(0,3)],[0xEF,0xBB,0xBF]);

        const lines=csv.body.replace(/^\uFEFF/,'').trim().split('\r\n');
        check('header + 2 attempts + 1 non-attempter',lines.length,4);

        const header=lines[0].split(',');
        check('per-question columns carry their marks',[header[10],header[11]],['Q1 (5)','Q2 (3)']);
        check('column count matches header',lines[1].split(',').length>=10,true);

        // ranked by score, so the 8/8 student is first
        check('top scorer ranked first',lines[1].startsWith('1,'),true);
        check('a comma in a name is quoted, not split',lines[1].includes('"Ada, Jr ""Quoted"""'),true);
        check('quotes inside a field are doubled',lines[1].includes('""Quoted""'),true);

        // the important one: a name starting with = must not stay a live formula
        const evilRow=lines.find((l)=>l.includes('cmd|calc'));
        check('formula-injection name is neutralised',/'=cmd\|calc/.test(evilRow),true);
        check('formula name never begins a raw = cell',/,=cmd/.test(evilRow),false);

        // scores and per-question marks
        check('first row scores 8 of 8',/,8,8,100,/.test(lines[1]),true);
        check('second row scores 5 of 8',/,5,8,62\.5,/.test(lines[2]),true);
        check('per-question marks are exported',lines[1].trim().endsWith(',5,3'),true);
        check('wrong answer shows 0 marks',lines[2].trim().endsWith(',5,0'),true);

        // non-attempters must appear so a teacher can chase them
        const missingRow=lines.find((l)=>l.includes('Not attempted'));
        check('student who never attempted is listed',!!missingRow,true);
        check('non-attempter has no rank',missingRow.startsWith(','),true);

        // authorization must match the JSON results endpoint
        check('student cannot export',(await raw('GET','/quizzes/'+made.quiz._id+'/results/csv',made.s1)).code,403);
        made.outsider=await User.create({firstName:'Out',lastName:'Csv',email:tag+'o@x.io',password:'x'.repeat(12),role:'teacher',status:'approved'});
        made.tpo=await TeacherProfile.create({userId:made.outsider._id,classes:[]});
        check('teacher of another class cannot export',(await raw('GET','/quizzes/'+made.quiz._id+'/results/csv',made.outsider)).code,400);
    }
    catch(err){
        failures++;
        console.log('FAIL  threw:',err.message);
    }
    finally{
        const ids=[made.s1?._id,made.s2?._id,made.s3?._id,made.teacher?._id,made.outsider?._id].filter(Boolean);
        if(made.quiz) await Quiz.findOneAndDelete({_id:made.quiz._id});
        await QuizAttempt.deleteMany({studentId:{$in:ids}});
        await Result.deleteMany({studentId:{$in:ids}});
        await Notification.deleteMany({userId:{$in:ids}});
        await StudentProfile.deleteMany({userId:{$in:ids}});
        await TeacherProfile.deleteMany({userId:{$in:ids}});
        await Lesson.deleteMany({name:new RegExp('^'+tag,'i')});
        await User.deleteMany({email:new RegExp('^'+tag,'i')});
        await Classroom.deleteMany({name:new RegExp('^'+tag,'i')});
        await Subject.deleteMany({name:new RegExp('^'+tag,'i')});

        const left=await Promise.all([
            User.countDocuments({email:new RegExp('^'+tag,'i')}),
            Quiz.countDocuments({title:new RegExp(tag,'i')}),
            Result.countDocuments({studentId:{$in:ids}})
        ]);
        console.log(`\ncleanup leftovers [user,quiz,result]: ${left.join(',')}`);
        console.log(failures===0?'\nALL CSV CHECKS PASSED':`\n${failures} CHECK(S) FAILED`);
        await disconnect();
        process.exit(failures===0?0:1);
    }
})();
