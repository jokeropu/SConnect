const validator=require('validator');

const validateRegistration=(data)=>{
    const mandatoryField=['firstName','email','password'];
    const isAllowed=mandatoryField.every((k)=>Object.keys(data).includes(k));

    if(!isAllowed){
        throw new Error("Mandatory fields are missing");
    }
    if(!validator.isEmail(data.email)){
        throw new Error("Invalid Email");
    }
    if(!validator.isStrongPassword(data.password)){
        throw new Error("Password must be at least 8 characters with uppercase, lowercase, number and symbol");
    }
};

const validateObjectId=(id,label='id')=>{
    if(!validator.isMongoId(String(id))){
        throw new Error(`Invalid ${label}`);
    }
};

const requireFields=(data,fields)=>{
    const missing=fields.filter((f)=>data[f]===undefined || data[f]===null || data[f]==='');
    if(missing.length>0){
        throw new Error(`Missing required fields: ${missing.join(', ')}`);
    }
};

const pickFields=(data,fields)=>{
    const picked={};
    for(const field of fields){
        if(data[field]!==undefined) picked[field]=data[field];
    }
    return picked;
};

module.exports={validateRegistration,validateObjectId,requireFields,pickFields};
