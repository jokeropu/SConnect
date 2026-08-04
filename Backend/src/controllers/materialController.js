const Material=require('../models/material');
const cloudinary=require('../config/cloudinary');
const {requireFields}=require('../utils/validate');
const {parsePaging,buildMeta,searchRegex}=require('../utils/pagination');
const {visibleClassIds}=require('../utils/scope');

const listMaterials=async(req,res)=>{
    try{
        const {page,limit,skip}=parsePaging(req.query);
        const {subjectId,classId,search}=req.query;

        const query={};
        if(subjectId) query.subjectId=subjectId;
        if(search) query.title=searchRegex(search);

        const allowed=await visibleClassIds(req.result);
        if(allowed===null){
            if(classId) query.classId=classId;
        }
        else{
            query.$or=[{classId:null},{classId:{$in:allowed}}];
        }

        const [materials,total]=await Promise.all([
            Material.find(query).populate('subjectId','name code').populate('uploadedBy','firstName lastName').sort({createdAt:-1}).skip(skip).limit(limit),
            Material.countDocuments(query)
        ]);

        res.status(200).json({data:materials,meta:buildMeta(page,limit,total)});
    }
    catch(err){
        res.status(500).json({error:err.message});
    }
};

const uploadMaterial=async(req,res)=>{
    try{
        requireFields(req.body,['title','subjectId']);
        if(!req.file){
            throw new Error("No file uploaded");
        }

        const material=await Material.create({
            title:req.body.title,
            description:req.body.description || '',
            subjectId:req.body.subjectId,
            classId:req.body.classId || null,
            uploadedBy:req.result._id,
            fileUrl:req.file.path,
            filePublicId:req.file.filename,
            fileType:req.file.mimetype || 'raw'
        });

        res.status(201).json({material,message:"Material uploaded"});
    }
    catch(err){
        res.status(400).json({error:err.message});
    }
};

const deleteMaterial=async(req,res)=>{
    try{
        const material=await Material.findById(req.params.id);
        if(!material){
            return res.status(404).json({error:"Material not found"});
        }
        if(req.result.role!=='admin' && String(material.uploadedBy)!==String(req.result._id)){
            return res.status(403).json({error:"Only the uploader can delete this material"});
        }

        if(material.filePublicId){
            await cloudinary.uploader.destroy(material.filePublicId,{resource_type:'raw'}).catch(()=>{});
        }

        await Material.findByIdAndDelete(req.params.id);
        res.status(200).json({message:"Material deleted"});
    }
    catch(err){
        res.status(500).json({error:err.message});
    }
};

const trackDownload=async(req,res)=>{
    try{
        const material=await Material.findByIdAndUpdate(req.params.id,{$inc:{downloads:1}},{new:true});
        if(!material){
            return res.status(404).json({error:"Material not found"});
        }
        res.status(200).json({url:material.fileUrl,downloads:material.downloads});
    }
    catch(err){
        res.status(500).json({error:err.message});
    }
};

module.exports={listMaterials,uploadMaterial,deleteMaterial,trackDownload};
