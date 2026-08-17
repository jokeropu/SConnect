const StudentProfile=require('../models/studentProfile');
const ParentProfile=require('../models/parentProfile');
const TeacherProfile=require('../models/teacherProfile');
const Classroom=require('../models/classroom');
const Lesson=require('../models/lesson');

const classIdsForTeacher=async(teacherId)=>{
    const profile=await TeacherProfile.findOne({userId:teacherId}).select('classes');
    const lessonClasses=await Lesson.find({teacherId}).distinct('classId');
    const owned=profile?.classes || [];
    return [...new Set([...owned,...lessonClasses].map((id)=>String(id)))];
};

const classIdForStudent=async(studentId)=>{
    const profile=await StudentProfile.findOne({userId:studentId}).select('classId');
    return profile?.classId ? String(profile.classId) : null;
};

const childIdsForParent=async(parentId)=>{
    const profile=await ParentProfile.findOne({userId:parentId}).select('children');
    return (profile?.children || []).map((id)=>String(id));
};

const classIdsForParent=async(parentId)=>{
    const childIds=await childIdsForParent(parentId);
    const profiles=await StudentProfile.find({userId:{$in:childIds}}).select('classId');
    return [...new Set(profiles.map((p)=>String(p.classId)).filter(Boolean))];
};

const visibleClassIds=async(user)=>{
    if(user.role==='admin') return null;
    if(user.role==='teacher') return await classIdsForTeacher(user._id);
    if(user.role==='student'){
        const classId=await classIdForStudent(user._id);
        return classId?[classId]:[];
    }
    if(user.role==='parent') return await classIdsForParent(user._id);
    return [];
};

const visibleStudentIds=async(user)=>{
    if(user.role==='admin') return null;
    if(user.role==='student') return [String(user._id)];
    if(user.role==='parent') return await childIdsForParent(user._id);

    const classIds=await classIdsForTeacher(user._id);
    const profiles=await StudentProfile.find({classId:{$in:classIds}}).select('userId');
    return profiles.map((p)=>String(p.userId));
};

const assertClassAccess=async(user,classId)=>{
    if(user.role==='admin') return true;
    const allowed=await visibleClassIds(user);
    if(!allowed.includes(String(classId))){
        throw new Error("You do not have access to this class");
    }
    return true;
};

const isClassSupervisor=async(userId,classId)=>{
    if(!classId) return false;
    const classroom=await Classroom.findById(classId).select('supervisorId');
    return !!classroom?.supervisorId && String(classroom.supervisorId)===String(userId);
};

const canManageClassRecord=async(user,classId,ownerId)=>{
    if(user.role==='admin') return true;
    if(ownerId && String(ownerId)===String(user._id)) return true;
    return await isClassSupervisor(user._id,classId);
};

const teachesSubjectInClass=async(userId,classId,subjectId)=>{
    if(!classId || !subjectId) return false;
    return !!(await Lesson.exists({classId,subjectId,teacherId:userId}));
};

const canActAsSubjectTeacher=async(user,classId,subjectId)=>{
    if(user.role==='admin') return true;
    if(await teachesSubjectInClass(user._id,classId,subjectId)) return true;
    return await isClassSupervisor(user._id,classId);
};

module.exports={classIdsForTeacher,classIdForStudent,childIdsForParent,classIdsForParent,visibleClassIds,visibleStudentIds,assertClassAccess,isClassSupervisor,canManageClassRecord,teachesSubjectInClass,canActAsSubjectTeacher};
