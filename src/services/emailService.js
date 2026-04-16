import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
dotenv.config();

const transporter = nodemailer.createTransport({
    service: process.env.EMAIL_SERVICE || 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

export const sendEmail = async (to, subject, text, html) => {
    try {
        const info = await transporter.sendMail({
            from: `"Asian FX Signals" <${process.env.EMAIL_USER}>`,
            to,
            subject,
            text,
            html
        });
        console.log("Email sent: %s", info.messageId);
        return info;
    } catch (error) {
        console.error("Email error:", error);
        throw error;
    }
};
