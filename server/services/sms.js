// SMS sending — used for phone sign-in verification codes.
//
// Default provider: Brevo transactional SMS (reuses BREVO_API_KEY). Brevo SMS
// needs separate SMS credits in your Brevo account and an alphanumeric sender
// name (<= 11 chars). If delivery to Uzbek numbers is weak, swap to a local
// gateway (e.g. Eskiz.uz) by implementing sendViaEskiz and pointing sendSms at
// it — everything else (endpoints, codes) stays the same.
//
// Config:
//   BREVO_API_KEY  — same key as email.
//   SMS_SENDER     — sender name shown to the user (default "Dasturkhon").
const BREVO_API_KEY = process.env.BREVO_API_KEY;
const SMS_SENDER = (process.env.SMS_SENDER || 'Dasturkhon').slice(0, 11);

let lastError = null;

export const smsEnabled = () => !!BREVO_API_KEY;

export function getSmsStatus() {
  return { provider: BREVO_API_KEY ? 'brevo' : 'none', enabled: smsEnabled(), sender: SMS_SENDER, lastError };
}

// Brevo wants the recipient in international format WITHOUT a leading "+".
function brevoRecipient(to) {
  return String(to).replace(/[^\d]/g, '');
}

async function sendViaBrevo({ to, text }) {
  const res = await fetch('https://api.brevo.com/v3/transactionalSMS/sms', {
    method: 'POST',
    headers: { 'api-key': BREVO_API_KEY, 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ sender: SMS_SENDER, recipient: brevoRecipient(to), content: text, type: 'transactional' }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Brevo SMS ${res.status}: ${body}`);
  }
}

export async function sendSms({ to, text }) {
  try {
    if (BREVO_API_KEY) {
      await sendViaBrevo({ to, text });
    } else {
      lastError = 'Not configured: set BREVO_API_KEY (with SMS credits)';
      console.log(`[sms disabled] to=${to} | ${text}`);
      return;
    }
    lastError = null;
  } catch (e) {
    lastError = String((e && e.message) || e);
    throw e;
  }
}
