const mongoose=require('mongoose');
const {Schema}=mongoose;
const {QUIZ_ATTEMPT_STATUS}=require('../config/appConfig');

const answerSchema=new Schema({
    questionId:{
        type:Schema.Types.ObjectId,
        required:true
    },
    selectedOptions:[{
        type:Schema.Types.ObjectId
    }],
    textResponse:{
        type:String,
        default:null
    },
    isCorrect:{
        type:Boolean,
        default:false
    },
    marksAwarded:{
        type:Number,
        default:0
    }
},{
    _id:false
});

const quizAttemptSchema=new Schema({
    quizId:{
        type:Schema.Types.ObjectId,
        ref:'quiz',
        required:true
    },
    studentId:{
        type:Schema.Types.ObjectId,
        ref:'user',
        required:true
    },
    answers:[answerSchema],
    score:{
        type:Number,
        default:0
    },
    totalMarks:{
        type:Number,
        default:0
    },
    status:{
        type:String,
        enum:QUIZ_ATTEMPT_STATUS,
        default:'in-progress'
    },
    startedAt:{
        type:Date,
        default:Date.now
    },
    submittedAt:{
        type:Date,
        default:null
    },
    timeTakenMs:{
        type:Number,
        default:0
    },
    autoSubmitted:{
        type:Boolean,
        default:false
    }
},{
    timestamps:true
});

quizAttemptSchema.index({quizId:1,studentId:1},{unique:true});
quizAttemptSchema.index({studentId:1,createdAt:-1});

const QuizAttempt=mongoose.model("quizAttempt",quizAttemptSchema);
module.exports=QuizAttempt;
