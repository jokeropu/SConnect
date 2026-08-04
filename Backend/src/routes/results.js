const express=require('express');
const resultRouter=express.Router();

const {listResults,reportCard}=require('../controllers/examController');
const authenticate=require('../middleware/authMiddleware');

resultRouter.use(authenticate);

resultRouter.get('/',listResults);
resultRouter.get('/report-card',reportCard);
resultRouter.get('/report-card/:studentId',reportCard);

module.exports=resultRouter;
