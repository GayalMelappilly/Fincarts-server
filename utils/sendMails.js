import nodemailer from 'nodemailer'
import path from 'path'
import ejs from 'ejs'
import { fileURLToPath } from 'url';
import { configDotenv } from 'dotenv';
configDotenv()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export const sendVerificationEmail = async (email, code, token, name) => {
    // Create reusable transporter

    // console.log(process.env.SMTP_HOST, process.env.SMTP_PORT, process.env.SMTP_SERVICE, process.env.SMTP_SECURE, process.env.SMTP_PASSWORD, process.env.SMTP_USER)

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '465'),
      service: process.env.SMTP_SERVICE,
      // secure: process.env.SMTP_SECURE === 'true' || false,
      auth: {
        user: process.env.SMTP_MAIL,
        pass: process.env.SMTP_PASSWORD,
      },
    });
  
    // Create verification link with JWT token
    const verificationLink = `${process.env.FRONTEND_URL}/verify?token=${token}`;
  
    // Render email template with EJS
    const templatePath = path.join(__dirname, '../views/mails/verification-mail.ejs');
    const htmlContent = await ejs.renderFile(templatePath, {
      name,
      verificationToken: code, // Display code in email
      verificationLink // Link with JWT token
    });
  
    // Email options
    const mailOptions = {
      from: `"${process.env.EMAIL_FROM_NAME || 'App Team'}" <${process.env.EMAIL_FROM}>`,
      to: email,
      subject: 'Email Verification',
      html: htmlContent,
    };
  
    // Send email
    const info = await transporter.sendMail(mailOptions);
    console.log('Verification email sent:', info.messageId);
    
    return info;
  };