const express=require('express');
const authRouter=express.Router();

const {register,login,googleAuth,refresh,logout,me,forgotPassword,resetPassword,changePassword}=require('../controllers/authController');
const authenticate=require('../middleware/authMiddleware');
const {authLimiter}=require('../middleware/rateLimiters');

authRouter.post('/register',authLimiter,register);
authRouter.post('/login',authLimiter,login);
authRouter.post('/google',authLimiter,googleAuth);
authRouter.post('/refresh',refresh);
authRouter.post('/logout',logout);
authRouter.post('/forgot-password',authLimiter,forgotPassword);
authRouter.post('/reset-password/:token',authLimiter,resetPassword);
authRouter.post('/change-password',authenticate,changePassword);
authRouter.get('/me',authenticate,me);

module.exports=authRouter;
