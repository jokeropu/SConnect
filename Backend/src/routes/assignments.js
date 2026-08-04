const express=require('express');
const assignmentRouter=express.Router();

const {listAssignments,getAssignmentById,createAssignment,updateAssignment,deleteAssignment,submitAssignment,gradeSubmission,mySubmissions}=require('../controllers/assignmentController');
const authenticate=require('../middleware/authMiddleware');
const authorize=require('../middleware/roleMiddleware');
const {attachmentUpload}=require('../middleware/uploadMiddleware');

assignmentRouter.use(authenticate);

assignmentRouter.get('/submissions/mine',mySubmissions);
assignmentRouter.get('/',listAssignments);
assignmentRouter.post('/',authorize('admin','teacher'),...attachmentUpload('attachment'),createAssignment);
assignmentRouter.get('/:id',getAssignmentById);
assignmentRouter.put('/:id',authorize('admin','teacher'),...attachmentUpload('attachment'),updateAssignment);
assignmentRouter.delete('/:id',authorize('admin','teacher'),deleteAssignment);
assignmentRouter.post('/:id/submit',authorize('student'),...attachmentUpload('file'),submitAssignment);

module.exports=assignmentRouter;
