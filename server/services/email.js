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

let lastError = null;
// Diagnostic: is email configured, and did the last send fail?
export function getEmailStatus() {
  return {
    enabled: !!transporter,
    hasUser: !!GMAIL_USER,
    hasPassword: !!GMAIL_APP_PASSWORD,
    lastError,
  };
}

export async function sendMail({ to, subject, text, html }) {
  if (!transporter) {
    lastError = 'Not configured: GMAIL_USER / GMAIL_APP_PASSWORD missing';
    console.log(`[email disabled] to=${to} | ${subject} | ${text}`);
    return;
  }
  try {
    await transporter.sendMail({ from: `Dasturkhon <${GMAIL_USER}>`, to, subject, text, html });
    lastError = null;
  } catch (e) {
    lastError = String((e && e.message) || e);
    throw e;
  }
}
