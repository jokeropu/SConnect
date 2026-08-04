const express=require('express');
const examRouter=express.Router();

const {listExams,createExam,updateExam,deleteExam,enterResults,publishResults}=require('../controllers/examController');
const authenticate=require('../middleware/authMiddleware');
const authorize=require('../middleware/roleMiddleware');

examRouter.use(authenticate);

examRouter.get('/',listExams);
examRouter.post('/',authorize('admin','teacher'),createExam);
examRouter.put('/:id',authorize('admin','teacher'),updateExam);
examRouter.delete('/:id',authorize('admin','teacher'),deleteExam);
examRouter.post('/:id/results',authorize('admin','teacher'),enterResults);
examRouter.post('/:id/publish',authorize('admin','teacher'),publishResults);

module.exports=examRouter;
