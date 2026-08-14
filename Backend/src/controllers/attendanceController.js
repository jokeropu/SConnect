const Attendance=require('../models/attendance');
const StudentProfile=require('../models/studentProfile');
const Classroom=require('../models/classroom');
const Notification=require('../models/notification');
const notify=require('../utils/notify');
const {requireFields}=require('../utils/validate');
const {parsePaging,buildMeta}=require('../utils/pagination');
const {visibleClassIds,assertClassAccess,childIdsForParent}=require('../utils/scope');
const {attendancePercentage}=require('../utils/gradeUtility');
const {LOW_ATTENDANCE_THRESHOLD,LOW_ATTENDANCE_MIN_RECORDS,LOW_ATTENDANCE_NOTICE_COOLDOWN_MS}=require('../config/appConfig');

const todayString=(date=new Date())=>date.toISOString().slice(0,10);

// Warns students whose overall attendance has dropped below the threshold.
// Called after attendance is recorded, never from a read, and rate limited per
// student so re-saving a sheet does not pile up duplicate warnings.
const flagLowAttendance=async(studentIds)=>{
    if(studentIds.length===0){
        return;
    }

    const totals=await Attendance.aggregate([
        {$match:{'records.studentId':{$in:studentIds}}},
        {$unwind:'$records'},
        {$match:{'records.studentId':{$in:studentIds}}},
        {$group:{
            _id:'$records.studentId',
            total:{$sum:1},
            present:{$sum:{$cond:[{$in:['$records.status',['present','late']]},1,0]}}
        }}
    ]);

    const atRisk=totals
        .map((row)=>({studentId:row._id,total:row.total,percentage:attendancePercentage(row.present,row.total)}))
        .filter((row)=>row.total>=LOW_ATTENDANCE_MIN_RECORDS && row.percentage<LOW_ATTENDANCE_THRESHOLD);

    if(atRisk.length===0){
        return;
    }

    const warnedRecently=await Notification.find({
        userId:{$in:atRisk.map((row)=>row.studentId)},
        type:'attendance_low',
        createdAt:{$gte:new Date(Date.now()-LOW_ATTENDANCE_NOTICE_COOLDOWN_MS)}
    }).distinct('userId');

    const skip=new Set(warnedRecently.map(String));

    for(const row of atRisk){
        if(skip.has(String(row.studentId))){
            continue;
        }
        await notify(
            row.studentId,
            'attendance_low',
            'Attendance is below the required level',
            `Your attendance is ${row.percentage}%. The minimum is ${LOW_ATTENDANCE_THRESHOLD}%.`,
            '/attendance'
        );
    }
};

const markAttendance=async(req,res)=>{
    try{
        requireFields(req.body,['classId','date','records']);
        const {classId,lessonId,date,records}=req.body;

        await assertClassAccess(req.result,classId);

        if(!Array.isArray(records) || records.length===0){
            throw new Error("No attendance records provided");
        }

        // Correcting and re-saving a sheet must not re-announce students who were
        // already marked absent on it, so only the newly absent are notified.
        const previous=await Attendance.findOne({classId,date,lessonId:lessonId || null}).select('records');
        const alreadyAbsent=new Set(
            (previous?.records || []).filter((r)=>r.status==='absent').map((r)=>String(r.studentId))
        );

        const attendance=await Attendance.findOneAndUpdate(
            {classId,date,lessonId:lessonId || null},
            {$set:{records,takenBy:req.result._id}},
            {new:true,upsert:true,setDefaultsOnInsert:true}
        );

        const classroom=await Classroom.findById(classId).select('name');
        const newlyAbsent=attendance.records
            .filter((r)=>r.status==='absent' && !alreadyAbsent.has(String(r.studentId)))
            .map((r)=>r.studentId);

        if(newlyAbsent.length>0){
            const profiles=await StudentProfile.find({userId:{$in:newlyAbsent}}).select('userId parentId');
            for(const profile of profiles){
                await notify(profile.userId,'attendance_absent','Marked absent',`You were marked absent in ${classroom?.name || 'class'} on ${date}.`,'/attendance');
                if(profile.parentId){
                    await notify(profile.parentId,'attendance_absent','Your child was absent',`Marked absent in ${classroom?.name || 'class'} on ${date}.`,'/attendance');
                }
            }
        }

        await flagLowAttendance(attendance.records.map((r)=>r.studentId));

        res.status(201).json({attendance,message:"Attendance saved"});
    }
    catch(err){
        res.status(400).json({error:err.message});
    }
};

const getAttendanceSheet=async(req,res)=>{
    try{
        const {classId,date,lessonId}=req.query;
        requireFields(req.query,['classId']);
        await assertClassAccess(req.result,classId);

        const day=date || todayString();
        const profiles=await StudentProfile.find({classId}).populate('userId','firstName lastName avatarUrl');
        const existing=await Attendance.findOne({classId,date:day,lessonId:lessonId || null});

        const roster=profiles.map((profile)=>{
            const record=existing?.records.find((r)=>String(r.studentId)===String(profile.userId._id));
            return {
                studentId:profile.userId._id,
                name:`${profile.userId.firstName} ${profile.userId.lastName}`.trim(),
                avatarUrl:profile.userId.avatarUrl,
                rollNumber:profile.rollNumber,
                status:record?.status || 'present',
                note:record?.note || ''
            };
        });

        res.status(200).json({classId,date:day,saved:!!existing,roster});
    }
    catch(err){
        res.status(403).json({error:err.message});
    }
};

const listAttendance=async(req,res)=>{
    try{
        const {page,limit,skip}=parsePaging(req.query);
        const {classId,from,to}=req.query;

        const query={};
        if(from || to){
            query.date={};
            if(from) query.date.$gte=from;
            if(to) query.date.$lte=to;
        }

        const allowed=await visibleClassIds(req.result);
        if(allowed===null){
            if(classId) query.classId=classId;
        }
        else{
            query.classId=classId && allowed.includes(String(classId))?classId:{$in:allowed};
        }

        const [sheets,total]=await Promise.all([
            Attendance.find(query).populate('classId','name gradeLevel section').populate('takenBy','firstName lastName').sort({date:-1}).skip(skip).limit(limit),
            Attendance.countDocuments(query)
        ]);

        const data=sheets.map((sheet)=>{
            const present=sheet.records.filter((r)=>r.status==='present' || r.status==='late').length;
            return {
                _id:sheet._id,
                classId:sheet.classId,
                date:sheet.date,
                takenBy:sheet.takenBy,
                total:sheet.records.length,
                present,
                absent:sheet.records.length-present,
                percentage:attendancePercentage(present,sheet.records.length)
            };
        });

        res.status(200).json({data,meta:buildMeta(page,limit,total)});
    }
    catch(err){
        res.status(500).json({error:err.message});
    }
};

const studentAttendance=async(req,res)=>{
    try{
        const studentId=req.params.studentId || req.result._id;

        if(req.result.role==='parent'){
            const children=await childIdsForParent(req.result._id);
            if(!children.includes(String(studentId))){
                return res.status(403).json({error:"That is not your child"});
            }
        }
        if(req.result.role==='student' && String(studentId)!==String(req.result._id)){
            return res.status(403).json({error:"You can only view your own attendance"});
        }

        const sheets=await Attendance.find({'records.studentId':studentId}).sort({date:1});

        let present=0;
        let absent=0;
        let late=0;
        const timeline=[];

        for(const sheet of sheets){
            const record=sheet.records.find((r)=>String(r.studentId)===String(studentId));
            if(!record) continue;

            if(record.status==='present') present++;
            else if(record.status==='late') late++;
            else if(record.status==='absent') absent++;

            timeline.push({date:sheet.date,status:record.status,note:record.note});
        }

        const total=present+absent+late;
        const percentage=attendancePercentage(present+late,total);

        res.status(200).json({
            studentId,
            present,
            absent,
            late,
            total,
            percentage,
            belowThreshold:total>=LOW_ATTENDANCE_MIN_RECORDS && percentage<LOW_ATTENDANCE_THRESHOLD,
            threshold:LOW_ATTENDANCE_THRESHOLD,
            timeline
        });
    }
    catch(err){
        res.status(500).json({error:err.message});
    }
};

const classAttendanceTrend=async(req,res)=>{
    try{
        const {classId,weeks}=req.query;
        const allowed=await visibleClassIds(req.result);

        const query={};
        if(classId){
            await assertClassAccess(req.result,classId);
            query.classId=classId;
        }
        else if(allowed!==null){
            query.classId={$in:allowed};
        }

        const span=Number(weeks || 4)*7;
        const since=new Date();
        since.setDate(since.getDate()-span);
        query.date={$gte:todayString(since)};

        const sheets=await Attendance.find(query).sort({date:1});
        const byDate={};

        for(const sheet of sheets){
            const present=sheet.records.filter((r)=>r.status==='present' || r.status==='late').length;
            if(!byDate[sheet.date]) byDate[sheet.date]={date:sheet.date,present:0,absent:0};
            byDate[sheet.date].present+=present;
            byDate[sheet.date].absent+=sheet.records.length-present;
        }

        res.status(200).json({data:Object.values(byDate)});
    }
    catch(err){
        res.status(500).json({error:err.message});
    }
};

module.exports={markAttendance,getAttendanceSheet,listAttendance,studentAttendance,classAttendanceTrend};
