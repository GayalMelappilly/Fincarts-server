import nodemailer from 'nodemailer';
import path from 'path';
import ejs from 'ejs';
import { fileURLToPath } from 'url';
import { google } from 'googleapis';
import { configDotenv } from 'dotenv';
import { generateSellerOrderInvoice } from './invoice/sellerOrderInvoice.js';

configDotenv();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI;
const REFRESH_TOKEN = process.env.GOOGLE_REFRESH_TOKEN;
const MAIL_ID = process.env.SMTP_MAIL;

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
oauth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });

export const sendNotificationEmail = async (toEmail, orderData, userName, type) => {
  try {
    const accessToken = await oauth2Client.getAccessToken();

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        type: 'OAuth2',
        user: MAIL_ID,
        clientId: CLIENT_ID,
        clientSecret: CLIENT_SECRET,
        refreshToken: REFRESH_TOKEN,
        accessToken,
      },
    });

    // ✅ Generate invoice PDF
    let invoicePDF;
    let htmlContent;
    if (type === 'seller') {
      invoicePDF = await generateSellerOrderInvoice(orderData);

      htmlContent = await ejs.renderFile(
        path.join(__dirname, '../views/mails/order-placed-mail.ejs'),
        {
          name: userName,
          order: orderData.order,
          items: orderData.orderItems,
          payment: orderData.paymentDetails,
          shipping: orderData.shippingDetails,
          itemDetails: orderData.itemDetails
        }
      );

    } else if (type === 'customer') {
      invoicePDF = await generateSellerOrderInvoice(orderData);

      htmlContent = await ejs.renderFile(
        path.join(__dirname, '../views/mails/customer-order-confirmation-mail.ejs'),
        {
          name: userName,
          order: orderData.order,
          items: orderData.orderItems,
          payment: orderData.paymentDetails,
          shipping: orderData.shippingDetails,
          itemDetails: orderData.itemDetails,
          customerDetails: orderData.customerDetails
        }
      );
    }

    // ✅ Email options
    const mailOptions = {
      from: `"Fincarts" <${MAIL_ID}>`,
      to: toEmail,
      subject: 'Order Confirmed: Invoice Attached',
      html: htmlContent,
      attachments: [
        {
          filename: `invoice-${orderData.order.id}.pdf`,
          content: invoicePDF,
          contentType: 'application/pdf',
        }
      ],
    };

    const info = await transporter.sendMail(mailOptions);

    console.log('Order confirmation email sent:', info.messageId);

    return info;
  } catch (err) {
    console.error('❌ Failed to send order email:', err);
    throw err;
  }
};
