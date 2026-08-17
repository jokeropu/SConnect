const mongoose=require('mongoose');
const {connect,disconnect,BASE}=require('../helpers');
const jwt=require('jsonwebtoken');

const M='../../';
const Quiz=require('../../models/quiz');
const QuizAttempt=require('../../models/quizAttempt');
const Result=require('../../models/result');
const Exam=require('../../models/exam');
const Lesson=require('../../models/lesson');
const User=require('../../models/user');
const Classroom=require('../../models/classroom');
const Subject=require('../../models/subject');
const StudentProfile=require('../../models/studentProfile');
const TeacherProfile=require('../../models/teacherProfile');
const Notification=require('../../models/notification');
const {buildReportCard}=require('../../utils/gradeUtility');
const {QUIZ_RESULT_WEIGHT}=require('../../config/appConfig');

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
    const tag='zzqr-'+Date.now();

    try{
        check('weight config is 0.1',QUIZ_RESULT_WEIGHT,0.1);

        const exam={marksObtained:80,maxMarks:100,points:9,weight:1};
        const quiz={marksObtained:2,maxMarks:20,points:0,weight:0.1};
        const weightedCard=buildReportCard([exam,quiz]);
        check('weighted percentage dilutes a bad quiz',weightedCard.percentage,78.63);
        check('unweighted maths would have been much worse',Math.round((82/120)*10000)/100,68.33);
        check('weighted gpa barely moves',weightedCard.gpa,8.18);
        check('raw marks kept unweighted for display',[weightedCard.totalObtained,weightedCard.totalMax],[82,120]);

        const legacy=buildReportCard([{marksObtained:80,maxMarks:100,points:9},{marksObtained:60,maxMarks:100,points:7}]);
        check('legacy rows without weight still average normally',[legacy.percentage,legacy.gpa],[70,8]);

        made.subject=await Subject.create({name:tag+'-sub',code:(tag+'S').slice(0,12)});
        made.klass=await Classroom.create({name:tag+'-class',gradeLevel:9,capacity:30,academicYear:'2026-27'});
        made.teacher=await User.create({firstName:'Teach',lastName:'Qr',email:tag+'t@x.io',password:'x'.repeat(12),role:'teacher',status:'approved'});
        made.student=await User.create({firstName:'Stud',lastName:'Qr',email:tag+'s@x.io',password:'x'.repeat(12),role:'student',status:'approved'});
        made.tp=await TeacherProfile.create({userId:made.teacher._id,classes:[made.klass._id]});
        made.sp=await StudentProfile.create({userId:made.student._id,classId:made.klass._id});
        made.lesson=await Lesson.create({name:tag+' lesson',subjectId:made.subject._id,classId:made.klass._id,teacherId:made.teacher._id,day:'monday',startTime:'09:00',endTime:'09:45'});

        const window={startTime:new Date(Date.now()-60000),endTime:new Date(Date.now()+3600000)};

        const quizRes=await hit('POST','/quizzes',made.teacher,{title:tag+' quiz',subjectId:String(made.subject._id),
            classId:String(made.klass._id),timeLimit:20,status:'published',...window,
            questions:[
                {text:'q1',type:'single',marks:5,options:[{text:'a',isCorrect:true},{text:'b'}]},
                {text:'q2',type:'single',marks:5,options:[{text:'a',isCorrect:true},{text:'b'}]}
            ]});
        check('quiz created',quizRes.code,201);
        made.quiz=quizRes.json.quiz;

        const start=await hit('POST','/quizzes/'+made.quiz._id+'/start',made.student);
        const qs=start.json.quiz.questions;
        await hit('POST','/quizzes/'+made.quiz._id+'/submit',made.student,{responses:{
            [qs[0]._id]:[String(qs[0].options[0]._id)],
            [qs[1]._id]:[String(qs[1].options[1]._id)]
        }});

        const result=await Result.findOne({quizId:made.quiz._id,studentId:made.student._id});
        check('a Result row was written for the quiz',!!result,true);
        check('Result carries the quiz marks',[result.marksObtained,result.maxMarks],[5,10]);
        check('Result weight is the quiz weight',result.weight,QUIZ_RESULT_WEIGHT);
        check('Result attributed to the quiz author',String(result.enteredBy),String(made.teacher._id));
        check('Result linked to the quiz, not an exam',[!!result.quizId,result.examId],[true,null]);

        const card=await hit('GET','/results/report-card',made.student);
        check('report card reachable',card.code,200);
        check('report card flags weighting',card.json.weighted,true);
        const sub=card.json.subjects.find((s)=>s.subject.name===tag+'-sub');
        check('quiz grouped under its own subject, not Other',!!sub,true);
        check('subject shows the raw quiz marks',[sub?.obtained,sub?.max],[5,10]);

        const list=await hit('GET','/results',made.student);
        const row=list.json.data.find((r)=>String(r.quizId?._id)===String(made.quiz._id));
        check('quiz appears in the results list',!!row,true);
        check('list populates the quiz title',row?.quizId?.title,tag+' quiz');

        made.quiz2=await Quiz.create({title:tag+' neg',subjectId:made.subject._id,classId:made.klass._id,
            createdBy:made.teacher._id,status:'published',timeLimit:10,negativeMarking:true,...window,
            questions:[{text:'n',type:'single',marks:1,negativeMarks:5,options:[{text:'a',isCorrect:true},{text:'b'}]}]});
        const s2=await hit('POST','/quizzes/'+made.quiz2._id+'/start',made.student);
        const q2=s2.json.quiz.questions[0];
        const neg=await hit('POST','/quizzes/'+made.quiz2._id+'/submit',made.student,{responses:{[q2._id]:[String(q2.options[1]._id)]}});
        check('negative score accepted by the quiz',neg.json.score,-5);
        const negResult=await Result.findOne({quizId:made.quiz2._id,studentId:made.student._id});
        check('negative score floored to 0 in Result',negResult?.marksObtained,0);

        await hit('DELETE','/quizzes/'+made.quiz2._id,made.teacher);
        check('deleting a quiz removes its Result',await Result.countDocuments({quizId:made.quiz2._id}),0);
        made.quiz2=null;

        const examRes=await hit('POST','/exams',made.teacher,{title:tag+' exam',subjectId:String(made.subject._id),
            classId:String(made.klass._id),maxMarks:100,...window});
        made.exam=examRes.json.exam;
        await hit('POST','/exams/'+made.exam._id+'/results',made.teacher,{entries:[{studentId:String(made.student._id),marksObtained:80}]});
        const examResult=await Result.findOne({examId:made.exam._id,studentId:made.student._id});
        check('exam Result defaults to full weight',examResult.weight,1);
    }
    catch(err){
        failures++;
        console.log('FAIL  threw:',err.message);
    }
    finally{
        const ids=[made.student?._id,made.teacher?._id].filter(Boolean);
        if(made.quiz) await Quiz.findOneAndDelete({_id:made.quiz._id});
        if(made.quiz2) await Quiz.findOneAndDelete({_id:made.quiz2._id});
        if(made.exam) await Exam.findByIdAndDelete(made.exam._id);
        await Lesson.deleteMany({name:new RegExp('^'+tag,'i')});
        await Result.deleteMany({studentId:{$in:ids}});
        await QuizAttempt.deleteMany({studentId:{$in:ids}});
        await Notification.deleteMany({userId:{$in:ids}});
        await StudentProfile.deleteMany({userId:{$in:ids}});
        await TeacherProfile.deleteMany({userId:{$in:ids}});
        await User.deleteMany({email:new RegExp('^'+tag,'i')});
        await Classroom.deleteMany({name:new RegExp('^'+tag,'i')});
        await Subject.deleteMany({name:new RegExp('^'+tag,'i')});

        const left=await Promise.all([
            User.countDocuments({email:new RegExp('^'+tag,'i')}),
            Quiz.countDocuments({title:new RegExp('^'+tag,'i')}),
            Result.countDocuments({studentId:{$in:ids}}),
            Exam.countDocuments({title:new RegExp('^'+tag,'i')})
        ]);
        console.log(`\ncleanup leftovers [user,quiz,result,exam]: ${left.join(',')}`);
        console.log(failures===0?'\nALL QUIZ-RESULT CHECKS PASSED':`\n${failures} CHECK(S) FAILED`);
        await disconnect();
        process.exit(failures===0?0:1);
    }
})();
