const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: process.env.SMTP_PORT || 587,
    secure: process.env.SMTP_PORT == 465, // true for 465, false for other ports
    auth: {
        user: process.env.SMTP_USER || 'your-email@gmail.com',
        pass: process.env.SMTP_PASS || 'your-app-password' 
    }
});

async function sendNotification(email, subject, text) {
    if(!email) return;
    try {
        let info = await transporter.sendMail({
            from: '"SmartConnect Notifications" <noreply@smartconnect.local>',
            to: email,
            subject: subject,
            text: text
        });
        console.log('Email Notification Sent:', info.messageId);
    } catch (err) {
        console.error('Email sending error:', err.message);
    }
}

module.exports = { sendNotification };
