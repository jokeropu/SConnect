const express=require('express');
const classRouter=express.Router();

const {listClasses,getClassById,createClass,updateClass,deleteClass,enrollStudents}=require('../controllers/academicController');
const authenticate=require('../middleware/authMiddleware');
const authorize=require('../middleware/roleMiddleware');

classRouter.use(authenticate);

classRouter.get('/',listClasses);
classRouter.post('/',authorize('admin'),createClass);
classRouter.get('/:id',getClassById);
classRouter.put('/:id',authorize('admin'),updateClass);
classRouter.delete('/:id',authorize('admin'),deleteClass);
classRouter.post('/:id/enroll',authorize('admin'),enrollStudents);

module.exports=classRouter;
