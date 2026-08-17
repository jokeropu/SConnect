const nodemailer=require('nodemailer');

const transporter=nodemailer.createTransport({
    service:'gmail',
    connectionTimeout:10000,
    greetingTimeout:10000,
    socketTimeout:15000,
    auth:{
        user:process.env.SENDER_GMAIL,
        pass:process.env.SENDER_PASSWORD
    }
});

const sendEmail=async({to,subject,html})=>{
    await transporter.sendMail({
        from:`"SConnect" <${process.env.SENDER_GMAIL}>`,
        to,
        subject,
        html
    });
};

module.exports=sendEmail;
