const multer=require('multer');
const cloudinary=require('../config/cloudinary');

const memoryUpload=multer({
    storage:multer.memoryStorage(),
    limits:{fileSize:10*1024*1024}
});

const streamToCloudinary=(buffer,options)=>new Promise((resolve,reject)=>{
    const stream=cloudinary.uploader.upload_stream(options,(error,result)=>{
        if(error) return reject(error);
        resolve(result);
    });
    stream.end(buffer);
});

const sendToCloudinary=(folder,resourceType)=>async(req,res,next)=>{
    try{
        if(!req.file){
            return next();
        }

        const result=await streamToCloudinary(req.file.buffer,{
            folder:`sconnect/${folder}`,
            resource_type:resourceType
        });

        req.file.path=result.secure_url;
        req.file.filename=result.public_id;
        req.file.resourceType=result.resource_type;
        next();
    }
    catch(err){
        res.status(400).json({error:`Upload failed: ${err.message}`});
    }
};

const uploadHandler=(folder,resourceType)=>(field)=>[
    memoryUpload.single(field),
    sendToCloudinary(folder,resourceType)
];

const avatarUpload=uploadHandler('avatars','image');
const attachmentUpload=uploadHandler('attachments','auto');
const materialUpload=uploadHandler('materials','auto');

module.exports={avatarUpload,attachmentUpload,materialUpload};
