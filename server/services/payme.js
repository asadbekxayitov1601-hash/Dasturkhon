// server/services/payme.js
// Payme Card API integration (subscribe.payme.uz)
// Docs: https://developer.payme.uz/documentation/cards-api

import crypto from 'crypto';

const PAYME_API_URL = 'https://checkout.test.paycom.uz/api'; // test
// For production use: 'https://checkout.paycom.uz/api'

const PAYME_MERCHANT_ID  = process.env.PAYME_MERCHANT_ID;
const PAYME_SECRET_KEY   = process.env.PAYME_SECRET_KEY;   // test or prod key

// ── Helper: build Basic auth header ──────────────────────────────────────────
function getAuthHeader() {
  const credentials = Buffer.from(`${PAYME_MERCHANT_ID}:${PAYME_SECRET_KEY}`).toString('base64');
  return `Basic ${credentials}`;
}

// ── Helper: make a Payme API call ─────────────────────────────────────────────
async function paymeRequest(method, params) {
  const body = {
    id: crypto.randomUUID(),
    method,
    params,
  };

  const res = await fetch(PAYME_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Auth': getAuthHeader(),
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();

  if (data.error) {
    throw new Error(data.error.message || 'Payme API error');
  }

  return data.result;
}

// ── 1. Verify card — returns token + sends OTP to cardholder's phone ──────────
// cardNumber: "8600123456789012"
// expiry:     "0326"  (MMYY)
export async function verifyCard(cardNumber, expiry) {
  const result = await paymeRequest('cards.create', {
    card: {
      number: cardNumber.replace(/\s/g, ''),
      expire: expiry.replace('/', ''),
    },
    save: true,
  });
  // result.card.token — temporary token, becomes permanent after OTP confirm
  // result.card.phone — masked phone number OTP was sent to
  return {
    token: result.card.token,
    phone: result.card.phone, // e.g. "+998 ** *** 45 67"
  };
}

// ── 2. Confirm OTP — activates the card token ─────────────────────────────────
export async function confirmOtp(token, code) {
  const result = await paymeRequest('cards.verify', {
    token,
    code,
  });
  // result.card.token — now a permanent verified token
  // result.card.verify — true if verified
  return {
    token: result.card.token,
    verified: result.card.verify,
  };
}

// ── 3. Charge card — deduct subscription amount ───────────────────────────────
// amount is in TIYIN (1 UZS = 100 tiyin)
// so 50_000 UZS = 5_000_000 tiyin
export async function chargeCard(token, amountUzs, orderId, description) {
  const amountTiyin = amountUzs * 100;

  const result = await paymeRequest('receipts.create_p2p', {
    token,
    amount: amountTiyin,
    order_id: orderId,
    description,
  });

  return {
    receiptId: result._id,
    state: result.state,
  };
}

// ── 4. Remove card token (on unsubscribe or card change) ──────────────────────
export async function removeCard(token) {
  await paymeRequest('cards.remove', { token });
}

// ── Plan amounts in UZS ───────────────────────────────────────────────────────
export const PLAN_AMOUNTS = {
  weekly:  15_000,
  monthly: 50_000,
  yearly:  500_000,
};
