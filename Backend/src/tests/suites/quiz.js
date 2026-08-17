const mongoose=require('mongoose');
const {connect,disconnect,BASE}=require('../helpers');

const M='../../';
const Quiz=require('../../models/quiz');
const QuizAttempt=require('../../models/quizAttempt');
const Lesson=require('../../models/lesson');
const User=require('../../models/user');
const Classroom=require('../../models/classroom');
const Subject=require('../../models/subject');
const StudentProfile=require('../../models/studentProfile');
const TeacherProfile=require('../../models/teacherProfile');
const ParentProfile=require('../../models/parentProfile');
const ctrl=require('../../controllers/quizController');

const made={};
let failures=0;

const check=(label,actual,expected)=>{
    const ok=JSON.stringify(actual)===JSON.stringify(expected);
    if(!ok) failures++;
    console.log(`${ok?'PASS':'FAIL'}  ${label}${ok?'':`  (got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)})`}`);
};

const call=async(handler,{user,params={},body={},query={}})=>{
    let payload,code;
    const res={
        status(c){code=c;return this;},
        json(p){payload=p;return this;}
    };
    await handler({result:user,params,body,query},res);
    return {code,payload};
};

(async()=>{
    await connect();
    const tag='ZZTEST-'+Date.now();

    try{
        made.subject=await Subject.create({name:tag+'-sub',code:'C'+String(Date.now()).slice(-9)});
        made.klass=await Classroom.create({name:tag+'-class',gradeLevel:9,capacity:30,academicYear:'2026-27'});
        made.teacher=await User.create({firstName:'Teach',lastName:'Temp',email:tag+'t@x.io',password:'x'.repeat(12),role:'teacher',status:'approved'});
        made.student=await User.create({firstName:'Stud',lastName:'Temp',email:tag+'s@x.io',password:'x'.repeat(12),role:'student',status:'approved'});
        made.tp=await TeacherProfile.create({userId:made.teacher._id,classes:[made.klass._id]});
        made.lesson=await Lesson.create({name:tag+' lesson',subjectId:made.subject._id,classId:made.klass._id,teacherId:made.teacher._id,day:'monday',startTime:'09:00',endTime:'09:45'});
        made.sp=await StudentProfile.create({userId:made.student._id,classId:made.klass._id});

        const teacher={_id:made.teacher._id,role:'teacher'};
        const student={_id:made.student._id,role:'student'};

        const created=await call(ctrl.createQuiz,{user:teacher,body:{
            title:tag+' quiz',
            subjectId:String(made.subject._id),
            classId:String(made.klass._id),
            startTime:new Date(Date.now()-60000),
            endTime:new Date(Date.now()+3600000),
            timeLimit:30,
            negativeMarking:true,
            status:'published',
            questions:[
                {text:'Single',type:'single',marks:4,negativeMarks:1,options:[{text:'A',isCorrect:true},{text:'B'},{text:'C'}]},
                {text:'Multi',type:'multiple',marks:4,negativeMarks:1,options:[{text:'A',isCorrect:true},{text:'B',isCorrect:true},{text:'C'}]},
                {text:'Text',type:'text',marks:2,negativeMarks:1,correctAnswer:'Photosynthesis'},
                {text:'Int',type:'integer',marks:2,negativeMarks:1,correctAnswer:'42'},
                {text:'Skipped',type:'single',marks:5,negativeMarks:2,options:[{text:'A',isCorrect:true},{text:'B'}]}
            ]
        }});
        check('createQuiz status',created.code,201);
        made.quiz=created.payload.quiz;
        check('totalMarks summed',made.quiz.totalMarks,17);

        const q=made.quiz.questions;

        const started=await call(ctrl.startAttempt,{user:student,params:{id:String(made.quiz._id)}});
        check('startAttempt status',started.code,200);
        const leaked=JSON.stringify(started.payload.quiz.questions);
        check('no isCorrect leaked to student',leaked.includes('isCorrect'),false);
        check('no correctAnswer leaked to student',leaked.includes('correctAnswer'),false);

        const submitted=await call(ctrl.submitQuiz,{user:student,params:{id:String(made.quiz._id)},body:{responses:{
            [q[0]._id]:[String(q[0].options[0]._id)],
            [q[1]._id]:[String(q[1].options[0]._id)],
            [q[2]._id]:'  photoSYNTHESIS ',
            [q[3]._id]:'41',
        }}});
        check('submit status',submitted.code,200);
        check('score = 4',submitted.payload.score,4);
        check('totalMarks = 17',submitted.payload.totalMarks,17);
        check('not autoSubmitted',submitted.payload.autoSubmitted,false);
        check('review locked while open',submitted.payload.reviewAvailable,false);

        const stored=await QuizAttempt.findOne({quizId:made.quiz._id});
        check('skipped question scored 0',stored.answers[4].marksAwarded,0);
        check('skipped question not correct',stored.answers[4].isCorrect,false);
        check('text answer normalized+correct',stored.answers[2].isCorrect,true);

        const again=await call(ctrl.submitQuiz,{user:student,params:{id:String(made.quiz._id)},body:{responses:{}}});
        check('double submit rejected',again.code,400);
        check('score unchanged after retry',(await QuizAttempt.findOne({quizId:made.quiz._id})).score,4);

        const early=await call(ctrl.reviewQuiz,{user:student,params:{id:String(made.quiz._id)}});
        check('review blocked before close',early.code,403);

        const closed=await call(ctrl.setQuizStatus,{user:teacher,params:{id:String(made.quiz._id)},body:{status:'closed'}});
        check('close status',closed.code,200);

        const review=await call(ctrl.reviewQuiz,{user:student,params:{id:String(made.quiz._id)}});
        check('review open after close',review.code,200);
        check('review exposes answer key',review.payload.quiz.questions[0].options.some((o)=>o.isCorrect),true);
        check('review includes own attempt',review.payload.attempt.score,4);

        made.student2=await User.create({firstName:'Studtwo',lastName:'Temp',email:tag+'s2@x.io',password:'x'.repeat(12),role:'student',status:'approved'});
        made.sp2=await StudentProfile.create({userId:made.student2._id,classId:made.klass._id});
        const other=await call(ctrl.reviewQuiz,{user:{_id:made.student2._id,role:'student'},params:{id:String(made.quiz._id)}});
        check('non-attempter can review',other.code,200);
        check('non-attempter sees answer key',other.payload.quiz.questions[2].correctAnswer,'Photosynthesis');
        check('non-attempter has no attempt',other.payload.attempt,null);

        const results=await call(ctrl.quizResults,{user:teacher,params:{id:String(made.quiz._id)}});
        check('results status',results.code,200);
        check('results submitted count',results.payload.summary.submitted,1);
        check('results notAttempted count',results.payload.summary.notAttempted,1);
        check('results average',results.payload.summary.averageScore,4);
        check('per-question accuracy Q1',results.payload.questionStats[0].accuracy,100);
        check('per-question accuracy Q2',results.payload.questionStats[1].accuracy,0);
        check('skipped Q counted as unanswered',results.payload.questionStats[4].answered,0);

        made.parent=await User.create({firstName:'Parent',lastName:'Temp',email:tag+'p@x.io',password:'x'.repeat(12),role:'parent',status:'approved'});
        made.pp=await ParentProfile.create({userId:made.parent._id,children:[made.student._id]});
        const parent={_id:made.parent._id,role:'parent'};

        const pReview=await call(ctrl.reviewQuiz,{user:parent,params:{id:String(made.quiz._id)},query:{}});
        check('parent sees own child attempt',pReview.payload.attempt.score,4);
        const pOther=await call(ctrl.reviewQuiz,{user:parent,params:{id:String(made.quiz._id)},query:{studentId:String(made.student2._id)}});
        check('parent blocked from other child',pOther.code,403);

        made.outsider=await User.create({firstName:'Outsider',lastName:'Temp',email:tag+'o@x.io',password:'x'.repeat(12),role:'teacher',status:'approved'});
        made.op=await TeacherProfile.create({userId:made.outsider._id,classes:[]});
        const denied=await call(ctrl.quizResults,{user:{_id:made.outsider._id,role:'teacher'},params:{id:String(made.quiz._id)}});
        check('outsider teacher denied results',denied.code,400);

        made.draft=await Quiz.create({title:tag+' draft',subjectId:made.subject._id,classId:made.klass._id,createdBy:made.teacher._id,
            startTime:new Date(),endTime:new Date(Date.now()+3600000),timeLimit:10,status:'draft',
            questions:[{text:'d',type:'single',marks:1,options:[{text:'A',isCorrect:true},{text:'B'}]}]});
        const listed=await call(ctrl.listQuizzes,{user:student,query:{}});
        check('draft hidden from student',listed.payload.data.some((x)=>x.status==='draft'),false);
        const parentList=await call(ctrl.listQuizzes,{user:parent,query:{}});
        check('draft hidden from parent',parentList.payload.data.some((x)=>x.status==='draft'),false);
        const pGet=await call(ctrl.getQuiz,{user:parent,params:{id:String(made.draft._id)}});
        check('parent blocked from draft detail',pGet.code,403);
        const teacherList=await call(ctrl.listQuizzes,{user:teacher,query:{}});
        check('draft visible to teacher',teacherList.payload.data.some((x)=>String(x._id)===String(made.draft._id)),true);

        const bad=await call(ctrl.createQuiz,{user:teacher,body:{
            title:'bad',subjectId:String(made.subject._id),classId:String(made.klass._id),
            startTime:new Date(),endTime:new Date(Date.now()+3600000),timeLimit:10,
            questions:[{text:'no correct option',type:'single',marks:1,options:[{text:'A'},{text:'B'}]}]
        }});
        check('rejects question with no correct option',bad.code,400);
    }
    catch(err){
        failures++;
        console.log('FAIL  threw:',err.message);
    }
    finally{
        if(made.quiz) await Quiz.findOneAndDelete({_id:made.quiz._id});
        if(made.draft) await Quiz.findOneAndDelete({_id:made.draft._id});
        await QuizAttempt.deleteMany({studentId:{$in:[made.student?._id,made.student2?._id].filter(Boolean)}});
        await StudentProfile.deleteMany({_id:{$in:[made.sp?._id,made.sp2?._id].filter(Boolean)}});
        await TeacherProfile.deleteMany({_id:{$in:[made.tp?._id,made.op?._id].filter(Boolean)}});
        await ParentProfile.deleteMany({_id:{$in:[made.pp?._id].filter(Boolean)}});
        await Lesson.deleteMany({name:new RegExp('^'+tag,'i')});
        await User.deleteMany({_id:{$in:[made.teacher?._id,made.student?._id,made.student2?._id,made.outsider?._id,made.parent?._id].filter(Boolean)}});
        await Classroom.deleteMany({_id:made.klass?._id});
        await Subject.deleteMany({_id:made.subject?._id});
        await mongoose.model('notification').deleteMany({userId:{$in:[made.student?._id,made.student2?._id].filter(Boolean)}});

        const leftQuiz=await Quiz.countDocuments({title:new RegExp('^'+tag,'i')});
        const leftUser=await User.countDocuments({email:new RegExp(tag,'i')});
        console.log(`\ncleanup: ${leftQuiz} quizzes, ${leftUser} users left behind`);
        console.log(failures===0?'\nALL CHECKS PASSED':`\n${failures} CHECK(S) FAILED`);
        await disconnect();
        process.exit(failures===0?0:1);
    }
})();
