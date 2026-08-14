const mongoose=require('mongoose');
const {Schema}=mongoose;
const {NOTIFICATION_TTL_SECONDS}=require('../config/appConfig');

const NOTIFICATION_TYPES=[
    'account_approved',
    'account_suspended',
    'password_reset',
    'assignment_created',
    'assignment_due_soon',
    'assignment_graded',
    'exam_scheduled',
    'result_published',
    'quiz_published',
    'quiz_closed',
    'attendance_absent',
    'attendance_low',
    'announcement_posted',
    'event_created',
    'message_received',
    'class_assigned'
];

const notificationSchema=new Schema({
    userId:{
        type:Schema.Types.ObjectId,
        ref:'user',
        required:true
    },
    type:{
        type:String,
        enum:NOTIFICATION_TYPES,
        required:true
    },
    title:{
        type:String,
        required:true
    },
    message:{
        type:String,
        required:true
    },
    link:{
        type:String,
        default:null
    },
    read:{
        type:Boolean,
        default:false
    }
},{
    timestamps:true
});

notificationSchema.index({userId:1,createdAt:-1});

notificationSchema.index({createdAt:1},{expireAfterSeconds:NOTIFICATION_TTL_SECONDS});

const Notification=mongoose.model("notification",notificationSchema);
module.exports=Notification;
module.exports.NOTIFICATION_TYPES=NOTIFICATION_TYPES;
