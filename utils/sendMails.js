import nodemailer from 'nodemailer'
import path from 'path'
import ejs from 'ejs'
import { fileURLToPath } from 'url';
import { configDotenv } from 'dotenv';
import { google } from 'googleapis'
configDotenv()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI
const REFRESH_TOKEN = process.env.GOOGLE_REFRESH_TOKEN
const MAIL_ID = process.env.SMTP_MAIL

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
oauth2Client.setCredentials({refresh_token : REFRESH_TOKEN})

export const sendVerificationEmail = async (email, code, token, name) => {

  console.log(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI, REFRESH_TOKEN)

  try {
    // Get the access token
    const accessToken = await oauth2Client.getAccessToken();

    // Create transporter - note the correct method name is createTransport (not createTransporter)
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        type: 'OAuth2',
        user: MAIL_ID,
        clientId: CLIENT_ID,
        clientSecret: CLIENT_SECRET,
        refreshToken: REFRESH_TOKEN,
        accessToken: accessToken,
      },
    });

    await transporter.verify();
    console.log('SMTP server connection verified');

    // Create verification link
    const verificationLink = `${process.env.FRONTEND_URL}/verify?token=${token}`;

    // Render email template
    const templatePath = path.join(__dirname, '../views/mails/verification-mail.ejs');
    const htmlContent = await ejs.renderFile(templatePath, {
      name,
      verificationToken: code,
      verificationLink
    });

    // Email options
    const mailOptions = {
      from: `"${'Fincarts'}" <${MAIL_ID}>`,
      to: email,
      subject: 'Email Verification',
      headers: {
        'X-Priority': '1', // High priority
        'X-Mailer': 'MyMailer',
      },
      text: `Hello ${name},\n\nPlease verify your email by entering this code: ${code}\nor visit this link: ${verificationLink}`,
      html: htmlContent,
      dsn: {
        id: `${Date.now()}`,
        return: 'headers',
        notify: ['failure', 'delay'],
        recipient: process.env.SMTP_MAIL
      }
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Verification email sent:', info.messageId);
    return info;
  } catch (error) {
    console.error('Error sending email with OAuth:', error);
    throw error;
  }
};