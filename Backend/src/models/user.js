const mongoose=require('mongoose');
const {Schema}=mongoose;
const {ROLES,USER_STATUS}=require('../config/appConfig');

const userSchema=new Schema({
    firstName:{
        type:String,
        required:true,
        trim:true,
        minlength:2,
        maxlength:40
    },
    lastName:{
        type:String,
        trim:true,
        maxlength:40,
        default:''
    },
    email:{
        type:String,
        required:true,
        unique:true,
        trim:true,
        lowercase:true,
        immutable:true
    },
    password:{
        type:String,
        required:true
    },
    role:{
        type:String,
        enum:ROLES,
        default:'student'
    },
    status:{
        type:String,
        enum:USER_STATUS,
        default:'pending'
    },
    phone:{
        type:String,
        trim:true,
        default:null
    },
    address:{
        type:String,
        trim:true,
        default:''
    },
    sex:{
        type:String,
        enum:['male','female','other'],
        default:'other'
    },
    bloodType:{
        type:String,
        default:''
    },
    birthday:{
        type:Date,
        default:null
    },
    avatarUrl:{
        type:String,
        default:null
    },
    avatarPublicId:{
        type:String,
        default:null
    },
    googleId:{
        type:String,
        unique:true,
        sparse:true
    },
    lastLoginAt:{
        type:Date,
        default:null
    },
    resetPasswordToken:{
        type:String,
        default:null
    },
    resetPasswordExpires:{
        type:Date,
        default:null
    }
},{
    timestamps:true
});

userSchema.index({role:1,status:1});
userSchema.index({firstName:'text',lastName:'text',email:'text'});

userSchema.virtual('fullName').get(function(){
    return `${this.firstName} ${this.lastName}`.trim();
});

userSchema.set('toJSON',{virtuals:true});
userSchema.set('toObject',{virtuals:true});

userSchema.post('findOneAndDelete',async function(userInfo){
    if(userInfo){
        const userId=userInfo._id;
        await mongoose.model('teacherProfile').deleteMany({userId});
        await mongoose.model('studentProfile').deleteMany({userId});
        await mongoose.model('parentProfile').deleteMany({userId});
        await mongoose.model('notification').deleteMany({userId});
        await mongoose.model('submission').deleteMany({studentId:userId});
        await mongoose.model('result').deleteMany({studentId:userId});
    }
});

const User=mongoose.model("user",userSchema);
module.exports=User;
