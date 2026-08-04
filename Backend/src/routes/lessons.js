const express=require('express');
const lessonRouter=express.Router();

const {listLessons,timetable,createLesson,updateLesson,deleteLesson}=require('../controllers/academicController');
const authenticate=require('../middleware/authMiddleware');
const authorize=require('../middleware/roleMiddleware');

lessonRouter.use(authenticate);

lessonRouter.get('/timetable',timetable);
lessonRouter.get('/',listLessons);
lessonRouter.post('/',authorize('admin','teacher'),createLesson);
lessonRouter.put('/:id',authorize('admin','teacher'),updateLesson);
lessonRouter.delete('/:id',authorize('admin','teacher'),deleteLesson);

module.exports=lessonRouter;
