const express=require('express');
const submissionRouter=express.Router();

const {gradeSubmission}=require('../controllers/assignmentController');
const authenticate=require('../middleware/authMiddleware');
const authorize=require('../middleware/roleMiddleware');

submissionRouter.use(authenticate);

submissionRouter.put('/:id/grade',authorize('admin','teacher'),gradeSubmission);

module.exports=submissionRouter;
