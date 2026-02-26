// Gmail SMTP email sending via Nodemailer (free with any Gmail account)
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
    },
});

const FROM_NAME = process.env.EMAIL_FROM_NAME || 'Amiri Tate';
const FROM_EMAIL = process.env.GMAIL_USER;

/**
 * Send an email via Gmail SMTP
 * @param {string} to - recipient email address
 * @param {string} subject - email subject line
 * @param {string} body - email body (plain text)
 * @param {string} [html] - optional HTML body
 * @returns {{ success: boolean, messageId?: string, error?: string }}
 */
export async function sendEmail(to, subject, body, html = null) {
    try {
        const mailOptions = {
            from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
            to,
            subject,
            text: body,
        };

        if (html) {
            mailOptions.html = html;
        }

        const info = await transporter.sendMail(mailOptions);
        return { success: true, messageId: info.messageId };
    } catch (err) {
        console.error('Gmail SMTP error:', err);
        return { success: false, error: err.message };
    }
}
