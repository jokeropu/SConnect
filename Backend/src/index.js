const express=require('express');
const app=express();
require('dotenv').config();
const http=require('http');
const helmet=require('helmet');
const compression=require('compression');
const cookieParser=require('cookie-parser');
const cors=require('cors');

const main=require('./config/db');
const redisClient=require('./config/redis');
const attachSockets=require('./sockets');
const {notFound,errorHandler}=require('./middleware/errorHandler');
const {apiLimiter}=require('./middleware/rateLimiters');

const authRouter=require('./routes/auth');
const userRouter=require('./routes/users');
const classRouter=require('./routes/classes');
const subjectRouter=require('./routes/subjects');
const lessonRouter=require('./routes/lessons');
const assignmentRouter=require('./routes/assignments');
const submissionRouter=require('./routes/submissions');
const examRouter=require('./routes/exams');
const quizRouter=require('./routes/quizzes');
const resultRouter=require('./routes/results');
const attendanceRouter=require('./routes/attendance');
const announcementRouter=require('./routes/announcements');
const eventRouter=require('./routes/events');
const messageRouter=require('./routes/messages');
const notificationRouter=require('./routes/notifications');
const materialRouter=require('./routes/materials');
const dashboardRouter=require('./routes/dashboard');

const allowedOrigins=(process.env.CLIENT_URL || 'http://localhost:5174,http://localhost:5173')
    .split(',')
    .map((o)=>o.trim());

app.set('trust proxy',1);
app.use(helmet({crossOriginResourcePolicy:{policy:'cross-origin'}}));
app.use(compression());
app.use(cors({
    origin:allowedOrigins,
    credentials:true
}));
app.use(express.json({limit:'2mb'}));
app.use(express.urlencoded({extended:true}));
app.use(cookieParser());
app.use('/api',apiLimiter);

app.get('/health',(req,res)=>{
    res.status(200).json({status:'ok',uptime:process.uptime()});
});

app.use('/api/auth',authRouter);
app.use('/api/users',userRouter);
app.use('/api/classes',classRouter);
app.use('/api/subjects',subjectRouter);
app.use('/api/lessons',lessonRouter);
app.use('/api/assignments',assignmentRouter);
app.use('/api/submissions',submissionRouter);
app.use('/api/exams',examRouter);
app.use('/api/quizzes',quizRouter);
app.use('/api/results',resultRouter);
app.use('/api/attendance',attendanceRouter);
app.use('/api/announcements',announcementRouter);
app.use('/api/events',eventRouter);
app.use('/api/conversations',messageRouter);
app.use('/api/notifications',notificationRouter);
app.use('/api/materials',materialRouter);
app.use('/api/dashboard',dashboardRouter);

app.use(notFound);
app.use(errorHandler);

const httpServer=http.createServer(app);
attachSockets(httpServer,allowedOrigins);

const InitializeConnection=async()=>{
    try{
        await Promise.all([main(),redisClient.connect()]);
        console.log("DB Connected");

        const port=process.env.PORT || 4000;
        httpServer.listen(port,()=>{
            console.log("Server listening at port number: "+port);
        });
    }
    catch(err){
        console.error("Fatal startup error, exiting: "+err);
        process.exit(1);
    }
};

InitializeConnection();
