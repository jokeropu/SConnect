const express=require('express');
const userRouter=express.Router();

const {listUsers,getUserById,createUser,updateUser,deleteUser,setUserStatus,updateOwnProfile,updateAvatar,listPending,bulkImport,linkParentChild,teacherDirectory}=require('../controllers/userController');
const authenticate=require('../middleware/authMiddleware');
const authorize=require('../middleware/roleMiddleware');
const {avatarUpload}=require('../middleware/uploadMiddleware');

userRouter.use(authenticate);

userRouter.get('/pending',authorize('admin'),listPending);
userRouter.get('/directory/teachers',teacherDirectory);
userRouter.patch('/profile',updateOwnProfile);
userRouter.patch('/avatar',...avatarUpload('avatar'),updateAvatar);
userRouter.post('/bulk-import',authorize('admin'),bulkImport);
userRouter.post('/link-parent',authorize('admin'),linkParentChild);

userRouter.get('/',authorize('admin','teacher'),listUsers);
userRouter.post('/',authorize('admin'),createUser);
userRouter.get('/:id',authorize('admin','teacher','parent'),getUserById);
userRouter.put('/:id',authorize('admin'),updateUser);
userRouter.patch('/:id/status',authorize('admin'),setUserStatus);
userRouter.delete('/:id',authorize('admin'),deleteUser);

module.exports=userRouter;
