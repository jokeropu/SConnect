const express=require('express');
const materialRouter=express.Router();

const {listMaterials,uploadMaterial,deleteMaterial,trackDownload}=require('../controllers/materialController');
const authenticate=require('../middleware/authMiddleware');
const authorize=require('../middleware/roleMiddleware');
const {materialUpload}=require('../middleware/uploadMiddleware');

materialRouter.use(authenticate);

materialRouter.get('/',listMaterials);
materialRouter.post('/',authorize('admin','teacher'),...materialUpload('file'),uploadMaterial);
materialRouter.get('/:id/download',trackDownload);
materialRouter.delete('/:id',authorize('admin','teacher'),deleteMaterial);

module.exports=materialRouter;
