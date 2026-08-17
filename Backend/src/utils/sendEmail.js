const nodemailer=require('nodemailer');

const transporter=nodemailer.createTransport({
    service:'gmail',
    connectionTimeout:30000,
    greetingTimeout:30000,
    socketTimeout:60000,
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
