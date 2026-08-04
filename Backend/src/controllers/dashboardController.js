const User=require('../models/user');
const Classroom=require('../models/classroom');
const Subject=require('../models/subject');
const Lesson=require('../models/lesson');
const Assignment=require('../models/assignment');
const Submission=require('../models/submission');
const Exam=require('../models/exam');
const Result=require('../models/result');
const Attendance=require('../models/attendance');
const Announcement=require('../models/announcement');
const Event=require('../models/event');
const StudentProfile=require('../models/studentProfile');
const {visibleClassIds,childIdsForParent,classIdForStudent,classIdsForTeacher}=require('../utils/scope');
const {attendancePercentage,buildReportCard}=require('../utils/gradeUtility');
const {searchRegex}=require('../utils/pagination');

const todayString=(date=new Date())=>date.toISOString().slice(0,10);

const genderSplit=async(match={})=>{
    const rows=await User.aggregate([
        {$match:{role:'student',status:'approved',...match}},
        {$group:{_id:'$sex',count:{$sum:1}}}
    ]);

    const result={male:0,female:0,other:0};
    for(const row of rows){
        result[row._id || 'other']=row.count;
    }
    return result;
};

const attendanceWeek=async(classIds)=>{
    const since=new Date();
    since.setDate(since.getDate()-7);

    const query={date:{$gte:todayString(since)}};
    if(classIds) query.classId={$in:classIds};

    const sheets=await Attendance.find(query);
    const byDay={};

    for(const sheet of sheets){
        const present=sheet.records.filter((r)=>r.status==='present' || r.status==='late').length;
        if(!byDay[sheet.date]) byDay[sheet.date]={name:sheet.date.slice(5),present:0,absent:0};
        byDay[sheet.date].present+=present;
        byDay[sheet.date].absent+=sheet.records.length-present;
    }

    return Object.values(byDay).sort((a,b)=>a.name.localeCompare(b.name));
};

const gradeDistribution=async(studentIds)=>{
    const match=studentIds?{studentId:{$in:studentIds}}:{};
    const rows=await Result.aggregate([
        {$match:match},
        {$group:{_id:'$grade',count:{$sum:1}}},
        {$sort:{_id:1}}
    ]);
    return rows.map((row)=>({name:row._id,count:row.count}));
};

const adminDashboard=async(req,res)=>{
    const [students,teachers,parents,admins,pending,classes,subjects,lessons]=await Promise.all([
        User.countDocuments({role:'student',status:'approved'}),
        User.countDocuments({role:'teacher',status:'approved'}),
        User.countDocuments({role:'parent',status:'approved'}),
        User.countDocuments({role:'admin'}),
        User.countDocuments({status:'pending'}),
        Classroom.countDocuments({}),
        Subject.countDocuments({}),
        Lesson.countDocuments({})
    ]);

    const [gender,attendance,grades,announcements,events]=await Promise.all([
        genderSplit(),
        attendanceWeek(null),
        gradeDistribution(null),
        Announcement.find({}).populate('authorId','firstName lastName').sort({pinned:-1,createdAt:-1}).limit(5),
        Event.find({startTime:{$gte:new Date()}}).sort({startTime:1}).limit(5)
    ]);

    return res.status(200).json({
        role:'admin',
        counts:{students,teachers,parents,admins,pending,classes,subjects,lessons},
        gender,
        attendance,
        grades,
        announcements,
        events
    });
};

const teacherDashboard=async(req,res)=>{
    const classIds=await classIdsForTeacher(req.result._id);
    const profiles=await StudentProfile.find({classId:{$in:classIds}}).select('userId');
    const studentIds=profiles.map((p)=>p.userId);

    const [lessons,assignments,exams,ungraded]=await Promise.all([
        Lesson.countDocuments({teacherId:req.result._id}),
        Assignment.countDocuments({teacherId:req.result._id}),
        Exam.countDocuments({createdBy:req.result._id}),
        Submission.countDocuments({status:{$in:['submitted','late']},assignmentId:{$in:await Assignment.find({teacherId:req.result._id}).distinct('_id')}})
    ]);

    const [gender,attendance,grades,upcoming,announcements]=await Promise.all([
        genderSplit({_id:{$in:studentIds}}),
        attendanceWeek(classIds),
        gradeDistribution(studentIds),
        Assignment.find({teacherId:req.result._id,dueDate:{$gte:new Date()}}).populate('classId','name').sort({dueDate:1}).limit(5),
        Announcement.find({$or:[{scope:'global'},{classId:{$in:classIds}}]}).populate('authorId','firstName lastName').sort({pinned:-1,createdAt:-1}).limit(5)
    ]);

    return res.status(200).json({
        role:'teacher',
        counts:{classes:classIds.length,students:studentIds.length,lessons,assignments,exams,ungraded},
        gender,
        attendance,
        grades,
        upcoming,
        announcements
    });
};

const studentPayload=async(studentId)=>{
    const classId=await classIdForStudent(studentId);

    const [lessons,assignments,submissions,results,sheets,announcements,events]=await Promise.all([
        Lesson.find({classId}).populate('subjectId','name code').populate('teacherId','firstName lastName').sort({day:1,startTime:1}),
        Assignment.find({classId,dueDate:{$gte:new Date()}}).populate('subjectId','name').sort({dueDate:1}).limit(5),
        Submission.find({studentId}),
        Result.find({studentId}),
        Attendance.find({'records.studentId':studentId}),
        Announcement.find({$or:[{scope:'global'},{classId}]}).populate('authorId','firstName lastName').sort({pinned:-1,createdAt:-1}).limit(5),
        Event.find({$or:[{audience:'all'},{classId}],startTime:{$gte:new Date()}}).sort({startTime:1}).limit(5)
    ]);

    let present=0;
    let total=0;
    for(const sheet of sheets){
        const record=sheet.records.find((r)=>String(r.studentId)===String(studentId));
        if(!record) continue;
        total++;
        if(record.status==='present' || record.status==='late') present++;
    }

    return {
        classId,
        counts:{
            lessons:lessons.length,
            pendingAssignments:assignments.length,
            submitted:submissions.length,
            graded:submissions.filter((s)=>s.status==='graded').length
        },
        attendance:{present,total,percentage:attendancePercentage(present,total)},
        report:buildReportCard(results),
        timetable:lessons,
        upcoming:assignments,
        announcements,
        events
    };
};

const studentDashboard=async(req,res)=>{
    const payload=await studentPayload(req.result._id);
    return res.status(200).json({role:'student',...payload});
};

const parentDashboard=async(req,res)=>{
    const children=await childIdsForParent(req.result._id);
    const users=await User.find({_id:{$in:children}}).select('firstName lastName avatarUrl');

    const payloads=[];
    for(const child of users){
        const payload=await studentPayload(child._id);
        payloads.push({child,...payload});
    }

    return res.status(200).json({role:'parent',children:payloads});
};

const dashboard=async(req,res)=>{
    try{
        if(req.result.role==='admin') return await adminDashboard(req,res);
        if(req.result.role==='teacher') return await teacherDashboard(req,res);
        if(req.result.role==='student') return await studentDashboard(req,res);
        return await parentDashboard(req,res);
    }
    catch(err){
        res.status(500).json({error:err.message});
    }
};

const globalSearch=async(req,res)=>{
    try{
        const term=req.query.q;
        if(!term || term.trim().length<2){
            return res.status(200).json({users:[],classes:[],subjects:[],assignments:[]});
        }

        const rx=searchRegex(term);
        const allowed=await visibleClassIds(req.result);
        const classFilter=allowed===null?{}:{_id:{$in:allowed}};

        const [users,classes,subjects,assignments]=await Promise.all([
            req.result.role==='admin' || req.result.role==='teacher'
                ? User.find({$or:[{firstName:rx},{lastName:rx},{email:rx}]}).select('firstName lastName role avatarUrl').limit(8)
                : [],
            Classroom.find({name:rx,...classFilter}).select('name gradeLevel section').limit(6),
            Subject.find({$or:[{name:rx},{code:rx}]}).select('name code').limit(6),
            Assignment.find({title:rx,...(allowed===null?{}:{classId:{$in:allowed}})}).select('title dueDate').limit(6)
        ]);

        res.status(200).json({users,classes,subjects,assignments});
    }
    catch(err){
        res.status(500).json({error:err.message});
    }
};

module.exports={dashboard,globalSearch};
