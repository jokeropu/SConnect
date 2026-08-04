const axios=require('axios');

const verifyTurnstileToken=async(token,remoteip)=>{
    if(!process.env.TURNSTILE_SECRET_KEY){
        return {success:true,skipped:true};
    }
    if(!token){
        return {success:false};
    }

    try{
        const params=new URLSearchParams();
        params.append('secret',process.env.TURNSTILE_SECRET_KEY);
        params.append('response',token);
        if(remoteip) params.append('remoteip',remoteip);

        const {data}=await axios.post('https://challenges.cloudflare.com/turnstile/v0/siteverify',params);
        return data;
    }
    catch(err){
        console.error('Turnstile verification failed:',err.message);
        return {success:false};
    }
};

module.exports=verifyTurnstileToken;
