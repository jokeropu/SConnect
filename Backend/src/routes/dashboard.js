const express=require('express');
const dashboardRouter=express.Router();

const {dashboard,globalSearch}=require('../controllers/dashboardController');
const authenticate=require('../middleware/authMiddleware');

dashboardRouter.use(authenticate);

dashboardRouter.get('/',dashboard);
dashboardRouter.get('/search',globalSearch);

module.exports=dashboardRouter;
