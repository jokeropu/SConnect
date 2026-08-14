const {GRADE_BANDS}=require('../config/appConfig');

const gradeFor=(percentage)=>{
    const band=GRADE_BANDS.find((b)=>percentage>=b.min) || GRADE_BANDS[GRADE_BANDS.length-1];
    return {grade:band.grade,points:band.points};
};

const scoreBreakdown=(marksObtained,maxMarks)=>{
    const safeMax=maxMarks>0?maxMarks:1;
    const percentage=Math.round((marksObtained/safeMax)*10000)/100;
    const {grade,points}=gradeFor(percentage);
    return {percentage,grade,points};
};

// Each result carries a weight so a quiz can count for a fraction of an exam.
// Rows written before weight existed have no value, hence the fallback to 1.
const weightOf=(result)=>(result.weight??1);

const buildReportCard=(results)=>{
    if(results.length===0){
        return {subjects:[],totalObtained:0,totalMax:0,percentage:0,grade:'F',gpa:0};
    }

    const totalObtained=results.reduce((sum,r)=>sum+r.marksObtained,0);
    const totalMax=results.reduce((sum,r)=>sum+r.maxMarks,0);

    const weightedObtained=results.reduce((sum,r)=>sum+r.marksObtained*weightOf(r),0);
    const weightedMax=results.reduce((sum,r)=>sum+r.maxMarks*weightOf(r),0);
    const percentage=Math.round((weightedObtained/(weightedMax||1))*10000)/100;
    const {grade}=gradeFor(percentage);

    const weightTotal=results.reduce((sum,r)=>sum+weightOf(r),0);
    const gpa=weightTotal>0
        ?Math.round((results.reduce((sum,r)=>sum+r.points*weightOf(r),0)/weightTotal)*100)/100
        :0;

    // totalObtained/totalMax stay unweighted so the report card can still show
    // the raw marks a student actually scored.
    return {totalObtained,totalMax,percentage,grade,gpa};
};

const attendancePercentage=(present,total)=>{
    if(total===0) return 0;
    return Math.round((present/total)*10000)/100;
};

module.exports={gradeFor,scoreBreakdown,buildReportCard,attendancePercentage};
