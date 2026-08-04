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

const buildReportCard=(results)=>{
    if(results.length===0){
        return {subjects:[],totalObtained:0,totalMax:0,percentage:0,grade:'F',gpa:0};
    }

    const totalObtained=results.reduce((sum,r)=>sum+r.marksObtained,0);
    const totalMax=results.reduce((sum,r)=>sum+r.maxMarks,0);
    const percentage=Math.round((totalObtained/(totalMax||1))*10000)/100;
    const {grade}=gradeFor(percentage);
    const gpa=Math.round((results.reduce((sum,r)=>sum+r.points,0)/results.length)*100)/100;

    return {totalObtained,totalMax,percentage,grade,gpa};
};

const attendancePercentage=(present,total)=>{
    if(total===0) return 0;
    return Math.round((present/total)*10000)/100;
};

module.exports={gradeFor,scoreBreakdown,buildReportCard,attendancePercentage};
