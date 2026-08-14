const express=require('express');
const quizRouter=express.Router();

const {listQuizzes,createQuiz,getQuiz,updateQuiz,deleteQuiz,setQuizStatus,startAttempt,submitQuiz,myAttempts,reviewQuiz,quizResults,exportQuizResults}=require('../controllers/quizController');
const authenticate=require('../middleware/authMiddleware');
const authorize=require('../middleware/roleMiddleware');

quizRouter.use(authenticate);

quizRouter.get('/',listQuizzes);
quizRouter.get('/attempts/mine',authorize('student'),myAttempts);
quizRouter.post('/',authorize('admin','teacher'),createQuiz);

quizRouter.get('/:id',getQuiz);
quizRouter.put('/:id',authorize('admin','teacher'),updateQuiz);
quizRouter.delete('/:id',authorize('admin','teacher'),deleteQuiz);
quizRouter.patch('/:id/status',authorize('admin','teacher'),setQuizStatus);

quizRouter.post('/:id/start',authorize('student'),startAttempt);
quizRouter.post('/:id/submit',authorize('student'),submitQuiz);
quizRouter.get('/:id/review',reviewQuiz);
quizRouter.get('/:id/results',authorize('admin','teacher'),quizResults);
quizRouter.get('/:id/results/csv',authorize('admin','teacher'),exportQuizResults);

module.exports=quizRouter;
