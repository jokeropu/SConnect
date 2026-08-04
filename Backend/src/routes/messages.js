const express=require('express');
const messageRouter=express.Router();

const {listConversations,startConversation,listMessages,sendMessage,contactList}=require('../controllers/messageController');
const authenticate=require('../middleware/authMiddleware');
const {attachmentUpload}=require('../middleware/uploadMiddleware');

messageRouter.use(authenticate);

messageRouter.get('/contacts',contactList);
messageRouter.get('/',listConversations);
messageRouter.post('/',startConversation);
messageRouter.get('/:id/messages',listMessages);
messageRouter.post('/:id/messages',...attachmentUpload('attachment'),sendMessage);

module.exports=messageRouter;
