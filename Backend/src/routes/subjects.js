const express=require('express');
const subjectRouter=express.Router();

const {listSubjects,createSubject,updateSubject,deleteSubject}=require('../controllers/academicController');
const authenticate=require('../middleware/authMiddleware');
const authorize=require('../middleware/roleMiddleware');

subjectRouter.use(authenticate);

subjectRouter.get('/',listSubjects);
subjectRouter.post('/',authorize('admin'),createSubject);
subjectRouter.put('/:id',authorize('admin'),updateSubject);
subjectRouter.delete('/:id',authorize('admin'),deleteSubject);

module.exports=subjectRouter;
