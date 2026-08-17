const mongoose=require('mongoose');
const {Schema}=mongoose;
const {QUIZ_STATUS,QUIZ_QUESTION_TYPES}=require('../config/appConfig');

const optionSchema=new Schema({
    text:{
        type:String,
        required:true,
        trim:true
    },
    isCorrect:{
        type:Boolean,
        default:false
    }
});

const questionSchema=new Schema({
    text:{
        type:String,
        required:true,
        trim:true
    },
    imageUrl:{
        type:String,
        default:null
    },
    type:{
        type:String,
        enum:QUIZ_QUESTION_TYPES,
        default:'single'
    },
    marks:{
        type:Number,
        default:1,
        min:0
    },
    negativeMarks:{
        type:Number,
        default:0,
        min:0
    },
    correctAnswer:{
        type:String,
        default:null
    },
    options:[optionSchema]
});

questionSchema.pre('validate',function(next){
    if(this.type==='single' || this.type==='multiple'){
        if(this.options.length<2){
            return next(new Error(`"${this.text}" needs at least 2 options`));
        }
        const correct=this.options.filter((o)=>o.isCorrect).length;
        if(correct===0){
            return next(new Error(`"${this.text}" needs at least one correct option`));
        }
        if(this.type==='single' && correct>1){
            return next(new Error(`"${this.text}" is single-choice but has ${correct} correct options`));
        }
        this.correctAnswer=null;
    }
    else{
        if(!this.correctAnswer || !String(this.correctAnswer).trim()){
            return next(new Error(`"${this.text}" needs a correct answer`));
        }
        if(this.type==='integer' && Number.isNaN(Number(this.correctAnswer))){
            return next(new Error(`"${this.text}" expects a numeric answer`));
        }
        this.options=[];
    }
    next();
});

const quizSchema=new Schema({
    title:{
        type:String,
        required:true,
        trim:true
    },
    description:{
        type:String,
        default:'',
        trim:true
    },
    subjectId:{
        type:Schema.Types.ObjectId,
        ref:'subject',
        required:true
    },
    classId:{
        type:Schema.Types.ObjectId,
        ref:'class',
        required:true
    },
    createdBy:{
        type:Schema.Types.ObjectId,
        ref:'user',
        required:true
    },
    status:{
        type:String,
        enum:QUIZ_STATUS,
        default:'draft'
    },
    startTime:{
        type:Date,
        required:true
    },
    endTime:{
        type:Date,
        required:true
    },
    timeLimit:{
        type:Number,
        required:true,
        min:1,
        max:600
    },
    negativeMarking:{
        type:Boolean,
        default:false
    },
    questions:[questionSchema],
    totalMarks:{
        type:Number,
        default:0
    }
},{
    timestamps:true
});

quizSchema.index({classId:1,startTime:-1});
quizSchema.index({subjectId:1});

const sumMarks=(questions)=>(questions || []).reduce((sum,q)=>sum+(q.marks ?? 1),0);

quizSchema.pre('save',function(next){
    this.totalMarks=sumMarks(this.questions);
    next();
});

// insertMany skips save hooks, which would leave totalMarks at zero and make
// every score look like it beat the paper
quizSchema.pre('insertMany',function(next,docs){
    for(const doc of docs || []){
        doc.totalMarks=sumMarks(doc.questions);
    }
    next();
});

quizSchema.methods.isOver=function(){
    return this.status==='closed' || new Date(this.endTime)<new Date();
};

quizSchema.methods.isOpen=function(){
    const now=new Date();
    return this.status==='published' && new Date(this.startTime)<=now && new Date(this.endTime)>now;
};

quizSchema.post('findOneAndDelete',async function(quiz){
    if(quiz){
        await mongoose.model('quizAttempt').deleteMany({quizId:quiz._id});
        await mongoose.model('result').deleteMany({quizId:quiz._id});
    }
});

const Quiz=mongoose.model("quiz",quizSchema);
module.exports=Quiz;
