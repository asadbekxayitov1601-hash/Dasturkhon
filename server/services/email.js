// Email sending via Gmail SMTP (nodemailer).
// Set GMAIL_USER and GMAIL_APP_PASSWORD (a Gmail "App Password", requires 2FA)
// in the environment. If they're not set, emails are logged to the console so
// the flow stays testable in development.
import nodemailer from 'nodemailer';

const GMAIL_USER = process.env.GMAIL_USER;
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD;

let transporter = null;
if (GMAIL_USER && GMAIL_APP_PASSWORD) {
  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD },
  });
}

export const emailEnabled = () => !!transporter;

export async function sendMail({ to, subject, text, html }) {
  if (!transporter) {
    console.log(`[email disabled] to=${to} | ${subject} | ${text}`);
    return;
  }
  await transporter.sendMail({
    from: `Dasturkhon <${GMAIL_USER}>`,
    to,
    subject,
    text,
    html,
  });
}
