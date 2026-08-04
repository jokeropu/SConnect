const express=require('express');
const notificationRouter=express.Router();

const {listNotifications,markRead,markAllRead,clearAll}=require('../controllers/notificationController');
const authenticate=require('../middleware/authMiddleware');

notificationRouter.use(authenticate);

notificationRouter.get('/',listNotifications);
notificationRouter.patch('/read-all',markAllRead);
notificationRouter.patch('/:id/read',markRead);
notificationRouter.delete('/',clearAll);

module.exports=notificationRouter;
