// Email sending.
//
// Prefers an HTTP API provider (Brevo) because many hosts — including Railway —
// block outbound SMTP ports (25/465/587), which makes Gmail SMTP time out.
// Brevo's API goes over HTTPS (443), which is never blocked, and supports
// "single sender verification" so you can send from a normal Gmail address
// without owning a domain.
//
// Configure ONE of:
//   1) BREVO_API_KEY            (recommended; works on Railway)
//   2) GMAIL_USER + GMAIL_APP_PASSWORD  (SMTP fallback; only on hosts allowing SMTP)
//
// Sender address:
//   MAIL_FROM       — the "from" email (defaults to GMAIL_USER). For Brevo this
//                     address must be a Verified Sender in your Brevo account.
//   MAIL_FROM_NAME  — display name (defaults to "Dasturkhon").
import nodemailer from 'nodemailer';

const BREVO_API_KEY = process.env.BREVO_API_KEY;
const GMAIL_USER = process.env.GMAIL_USER;
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD;
const MAIL_FROM = process.env.MAIL_FROM || GMAIL_USER;
const MAIL_FROM_NAME = process.env.MAIL_FROM_NAME || 'Dasturkhon';

// SMTP fallback transport (fast timeouts so a blocked port fails in ~10s
// instead of hanging the request for 2-3 minutes).
let transporter = null;
if (!BREVO_API_KEY && GMAIL_USER && GMAIL_APP_PASSWORD) {
  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });
}

function activeProvider() {
  if (BREVO_API_KEY) return 'brevo';
  if (transporter) return 'gmail-smtp';
  return 'none';
}

export const emailEnabled = () => activeProvider() !== 'none';

let lastError = null;
// Diagnostic: which provider is active, is it configured, and did the last send fail?
export function getEmailStatus() {
  return {
    provider: activeProvider(),
    enabled: emailEnabled(),
    hasFrom: !!MAIL_FROM,
    from: MAIL_FROM || null,
    lastError,
  };
}

async function sendViaBrevo({ to, subject, text, html }) {
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': BREVO_API_KEY,
      'content-type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify({
      sender: { email: MAIL_FROM, name: MAIL_FROM_NAME },
      to: [{ email: to }],
      subject,
      textContent: text,
      ...(html ? { htmlContent: html } : {}),
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Brevo API ${res.status}: ${body}`);
  }
}

export async function sendMail({ to, subject, text, html }) {
  try {
    if (BREVO_API_KEY) {
      await sendViaBrevo({ to, subject, text, html });
    } else if (transporter) {
      await transporter.sendMail({ from: `${MAIL_FROM_NAME} <${MAIL_FROM}>`, to, subject, text, html });
    } else {
      lastError = 'Not configured: set BREVO_API_KEY (recommended) or GMAIL_USER/GMAIL_APP_PASSWORD';
      console.log(`[email disabled] to=${to} | ${subject} | ${text}`);
      return;
    }
    lastError = null;
  } catch (e) {
    lastError = String((e && e.message) || e);
    throw e;
  }
}
