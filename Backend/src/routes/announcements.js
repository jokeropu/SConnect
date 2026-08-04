const express=require('express');
const announcementRouter=express.Router();

const {listAnnouncements,createAnnouncement,updateAnnouncement,deleteAnnouncement}=require('../controllers/communicationController');
const authenticate=require('../middleware/authMiddleware');
const authorize=require('../middleware/roleMiddleware');

announcementRouter.use(authenticate);

announcementRouter.get('/',listAnnouncements);
announcementRouter.post('/',authorize('admin','teacher'),createAnnouncement);
announcementRouter.put('/:id',authorize('admin','teacher'),updateAnnouncement);
announcementRouter.delete('/:id',authorize('admin','teacher'),deleteAnnouncement);

module.exports=announcementRouter;
