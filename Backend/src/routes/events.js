const express=require('express');
const eventRouter=express.Router();

const {listEvents,createEvent,updateEvent,deleteEvent}=require('../controllers/communicationController');
const authenticate=require('../middleware/authMiddleware');
const authorize=require('../middleware/roleMiddleware');

eventRouter.use(authenticate);

eventRouter.get('/',listEvents);
eventRouter.post('/',authorize('admin','teacher'),createEvent);
eventRouter.put('/:id',authorize('admin','teacher'),updateEvent);
eventRouter.delete('/:id',authorize('admin','teacher'),deleteEvent);

module.exports=eventRouter;
