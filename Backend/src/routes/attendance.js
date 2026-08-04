const express=require('express');
const attendanceRouter=express.Router();

const {markAttendance,getAttendanceSheet,listAttendance,studentAttendance,classAttendanceTrend}=require('../controllers/attendanceController');
const authenticate=require('../middleware/authMiddleware');
const authorize=require('../middleware/roleMiddleware');

attendanceRouter.use(authenticate);

attendanceRouter.get('/sheet',authorize('admin','teacher'),getAttendanceSheet);
attendanceRouter.get('/trend',classAttendanceTrend);
attendanceRouter.get('/student',studentAttendance);
attendanceRouter.get('/student/:studentId',studentAttendance);
attendanceRouter.get('/',listAttendance);
attendanceRouter.post('/',authorize('admin','teacher'),markAttendance);

module.exports=attendanceRouter;
