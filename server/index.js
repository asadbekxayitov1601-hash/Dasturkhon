import 'dotenv/config';
import crypto from 'crypto';
import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import { OAuth2Client } from 'google-auth-library';
import { sendMail, getEmailStatus } from './services/email.js';
import { installLogging, logError, getRecentLogs } from './services/logger.js';

// Capture console.error output + uncaught errors to server/logs/error.log.
installLogging();

const app = express();
const PORT = process.env.PORT || 4000;
const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

// Google sign-in: only enabled when GOOGLE_CLIENT_ID is configured.
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const googleClient = GOOGLE_CLIENT_ID ? new OAuth2Client(GOOGLE_CLIENT_ID) : null;

// Standard 7-day session token for a user.
function makeToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, name: user.name, isAdmin: user.isAdmin, isPro: user.isPro },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

// ── DB-backed verification codes ────────────────────────────────────────────
// Used for signup, login 2FA, and password reset. Stored in the database (not
// in memory) so codes survive server restarts and work across instances.
const genCode = () => String(Math.floor(100000 + Math.random() * 900000));
const CODE_TTL_MS = 10 * 60 * 1000;

// Create a fresh code for (email, type), replacing any previous one. Returns the code.
async function createCode({ email, type, data = null, userId = null }) {
  await prisma.verificationCode.deleteMany({ where: { email, type } });
  const code = genCode();
  await prisma.verificationCode.create({
    data: {
      email,
      type,
      code,
      data: data ? JSON.stringify(data) : null,
      userId: userId ?? null,
      expiresAt: new Date(Date.now() + CODE_TTL_MS),
      attempts: 0,
    },
  });
  return code;
}

// Validate a submitted code. Returns { entry } on success, or { error, status }.
// Deletes the code on success / expiry / attempt-exhaustion; increments attempts
// on a wrong code.
async function consumeCode({ email, type, code }) {
  const entry = await prisma.verificationCode.findFirst({
    where: { email, type },
    orderBy: { createdAt: 'desc' },
  });
  if (!entry) return { error: 'No pending request. Please start again.', code: 'no_pending', status: 400 };
  if (entry.expiresAt.getTime() < Date.now()) {
    await prisma.verificationCode.delete({ where: { id: entry.id } });
    return { error: 'Code expired. Please start again.', code: 'code_expired', status: 400 };
  }
  if (entry.attempts >= 5) {
    await prisma.verificationCode.delete({ where: { id: entry.id } });
    return { error: 'Too many attempts. Please start again.', code: 'too_many_attempts', status: 429 };
  }
  if (String(code || '').trim() !== entry.code) {
    await prisma.verificationCode.update({ where: { id: entry.id }, data: { attempts: entry.attempts + 1 } });
    return { error: 'Invalid code', code: 'invalid_code', status: 400 };
  }
  await prisma.verificationCode.delete({ where: { id: entry.id } });
  return { entry };
}

// Normalize an origin/URL for comparison: trim whitespace and drop any
// trailing slash so "https://site.app/" and "https://site.app" are equal.
const normalizeOrigin = (value) => (value || '').trim().replace(/\/+$/, '');

// FRONTEND_URL may be a single URL or a comma-separated list of allowed origins.
const allowedOrigins = (process.env.FRONTEND_URL || '')
  .split(',')
  .map(normalizeOrigin)
  .filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, Postman, same-origin
    // proxied requests from Vercel).
    if (!origin) return callback(null, true);
    const normalized = normalizeOrigin(origin);
    // Allow configured origins (trailing-slash-insensitive) and any
    // *.vercel.app deployment (covers preview deployments too), or localhost in dev.
    if (
      allowedOrigins.includes(normalized) ||
      /\.vercel\.app$/.test(normalized) ||
      /^https?:\/\/localhost(:\d+)?$/.test(normalized)
    ) {
      return callback(null, true);
    }
    callback(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true,
}));

app.use(express.json({ limit: '50mb' }));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Parse the stored socialLinks JSON string into an object. Always returns an
// object so the client never has to null-check.
function parseSocial(str) {
  if (!str) return {};
  try {
    const v = JSON.parse(str);
    return v && typeof v === 'object' ? v : {};
  } catch {
    return {};
  }
}

// Shape a Prisma user into the object sent to the client. Keep this in one
// place so every endpoint returns the same fields (incl. avatarUrl/bio).
function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    isAdmin: user.isAdmin,
    isPro: user.isPro,
    avatarUrl: user.avatarUrl,
    bio: user.bio,
    phone: user.phone,
    socialLinks: parseSocial(user.socialLinks),
    cardLast4: user.cardLast4,
  };
}

// ── Presence tracking (powers the admin "online users" stat) ────────────────
const ONLINE_WINDOW_MS = 5 * 60 * 1000;        // a user counts as "online" if seen in the last 5 min
const PRESENCE_THROTTLE_MS = 60 * 1000;        // write lastSeen to the DB at most once/min per user
const lastPresenceWrite = new Map();           // userId -> epoch ms of last DB write

function touchPresence(userId) {
  if (!userId) return;
  const now = Date.now();
  if (now - (lastPresenceWrite.get(userId) || 0) < PRESENCE_THROTTLE_MS) return;
  lastPresenceWrite.set(userId, now);
  // Fire-and-forget: never block the request on presence bookkeeping.
  prisma.user.update({ where: { id: userId }, data: { lastSeen: new Date() } }).catch(() => {});
}

// auth middleware
function requireAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ message: 'No token' });
  const parts = auth.split(' ');
  if (parts.length !== 2) return res.status(401).json({ message: 'Bad token' });
  const token = parts[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    // attach user id to request
    req.user = payload;
    touchPresence(payload.id);
    next();
  } catch (e) {
    return res.status(401).json({ message: 'Invalid token' });
  }
}

function requireAdmin(req, res, next) {
  if (!req.user || !req.user.isAdmin) {
    return res.status(403).json({ message: 'Admin access required' });
  }
  next();
}

// Like requireAuth, but never blocks: sets req.user if a valid token is present,
// otherwise leaves it undefined. Used by public endpoints that personalise
// results (e.g. which paid recipes the viewer has unlocked).
function optionalAuth(req, _res, next) {
  const auth = req.headers.authorization;
  if (auth) {
    const parts = auth.split(' ');
    if (parts.length === 2) {
      try { req.user = jwt.verify(parts[1], JWT_SECRET); } catch (_) { /* ignore */ }
    }
  }
  next();
}

// Emailed verification codes for signup + login 2FA are OFF by default.
// Set EMAIL_CODE_ENABLED=true to require the emailed code again. (Password
// reset still uses an emailed code — that flow proves email ownership.)
const EMAIL_CODE_ENABLED = process.env.EMAIL_CODE_ENABLED === 'true';

// ── Signup with email verification code ─────────────────────────────────────
// Step 1 (signup-request) validates input, stores the pending account (as a DB
// verification code with the name+passwordHash payload) and emails a 6-digit
// code. Step 2 (signup-verify) checks the code and creates the real account.
// When EMAIL_CODE_ENABLED is false, the account is created immediately instead.
app.post('/api/auth/signup-request', async (req, res) => {
  const { name, email, password } = req.body;
  if (typeof email !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ message: 'Invalid email or password', code: 'invalid_input' });
  }
  const normalizedEmail = email.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalizedEmail)) {
    return res.status(400).json({ message: 'Invalid email address', code: 'invalid_email' });
  }
  if (password.length < 6) {
    return res.status(400).json({ message: 'Password must be at least 6 characters', code: 'weak_password' });
  }
  try {
    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) return res.status(409).json({ message: 'Email already registered', code: 'email_taken' });
    const passwordHash = await bcrypt.hash(password, 10);

    // Verification disabled: create the account now and return the session token.
    if (!EMAIL_CODE_ENABLED) {
      const user = await prisma.user.create({
        data: {
          name: typeof name === 'string' ? name.trim() : '',
          email: normalizedEmail,
          passwordHash,
          emailVerified: true,
          isAdmin: false,
        },
      });
      return res.json({ token: makeToken(user), user: publicUser(user) });
    }

    const code = await createCode({
      email: normalizedEmail,
      type: 'signup',
      data: { name: typeof name === 'string' ? name.trim() : '', passwordHash },
    });
    try {
      await sendMail({
        to: normalizedEmail,
        subject: 'Your Dasturkhon verification code',
        text: `Your Dasturkhon sign-up verification code is ${code}. It expires in 10 minutes.`,
        html: `<div style="font-family:sans-serif"><p>Welcome to Dasturkhon! Your verification code is:</p><p style="font-size:28px;font-weight:bold;letter-spacing:4px;color:#4A7C7E">${code}</p><p>It expires in 10 minutes.</p></div>`,
      });
    } catch (e) {
      console.error('signup email error:', e);
      return res.status(502).json({ message: "Couldn't send the code. Please check your email address is correct.", code: 'email_send_failed' });
    }
    res.json({ ok: true });
  } catch (e) {
    console.error('signup-request error:', e);
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/auth/signup-verify', async (req, res) => {
  const normalizedEmail = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const { entry, error, status, code } = await consumeCode({ email: normalizedEmail, type: 'signup', code: req.body.code });
  if (error) return res.status(status).json({ message: error, code });
  try {
    // Guard against the email being registered between step 1 and step 2.
    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) return res.status(409).json({ message: 'Email already registered', code: 'email_taken' });
    const payload = entry.data ? JSON.parse(entry.data) : {};
    // isAdmin is never taken from the request — new users are always non-admin.
    const user = await prisma.user.create({
      data: {
        name: payload.name || '',
        email: normalizedEmail,
        passwordHash: payload.passwordHash,
        emailVerified: true,
        isAdmin: false,
      },
    });
    res.json({ token: makeToken(user), user: publicUser(user) });
  } catch (e) {
    console.error('signup-verify error:', e);
    res.status(500).json({ message: 'Server error' });
  }
});

// ── Login with email 2FA code ───────────────────────────────────────────────
// Step 1 verifies the password then emails a one-time code; step 2 (login-verify)
// checks the code and returns the session token.
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  if (typeof email !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ message: 'Missing email or password', code: 'missing_credentials' });
  }
  const normalizedEmail = email.trim().toLowerCase();
  try {
    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    // Google-only accounts have no passwordHash — reject password login for them.
    if (!user || !user.passwordHash) return res.status(401).json({ message: 'Invalid credentials', code: 'invalid_credentials' });
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ message: 'Invalid credentials', code: 'invalid_credentials' });

    // 2FA disabled: issue the session token immediately, no emailed code.
    if (!EMAIL_CODE_ENABLED) {
      return res.json({ token: makeToken(user), user: publicUser(user) });
    }

    const code = await createCode({ email: normalizedEmail, type: 'login', userId: user.id });
    try {
      await sendMail({
        to: normalizedEmail,
        subject: 'Your Dasturkhon login code',
        text: `Your Dasturkhon login code is ${code}. It expires in 10 minutes.`,
        html: `<div style="font-family:sans-serif"><p>Your Dasturkhon login code is:</p><p style="font-size:28px;font-weight:bold;letter-spacing:4px;color:#4A7C7E">${code}</p><p>It expires in 10 minutes. If this wasn't you, change your password.</p></div>`,
      });
    } catch (e) {
      console.error('login email error:', e);
      return res.status(502).json({ message: 'Could not send login code. Please try again.', code: 'login_code_send_failed' });
    }
    res.json({ needsCode: true, email: normalizedEmail });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/auth/login-verify', async (req, res) => {
  const normalizedEmail = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const { entry, error, status, code } = await consumeCode({ email: normalizedEmail, type: 'login', code: req.body.code });
  if (error) return res.status(status).json({ message: error, code });
  try {
    const user = await prisma.user.findUnique({ where: { id: entry.userId } });
    if (!user) return res.status(401).json({ message: 'Invalid credentials', code: 'invalid_credentials' });
    res.json({ token: makeToken(user), user: publicUser(user) });
  } catch (e) {
    console.error('login-verify error:', e);
    res.status(500).json({ message: 'Server error' });
  }
});

// ── Google sign-in ──────────────────────────────────────────────────────────
// Frontend obtains a Google ID token (credential) via Google Identity Services
// and posts it here. We verify it, then find-or-create the matching user.
app.post('/api/auth/google', async (req, res) => {
  if (!googleClient) return res.status(503).json({ message: 'Google sign-in is not configured', code: 'google_not_configured' });
  const { credential } = req.body;
  if (typeof credential !== 'string') return res.status(400).json({ message: 'Missing Google credential', code: 'missing_google' });
  try {
    const ticket = await googleClient.verifyIdToken({ idToken: credential, audience: GOOGLE_CLIENT_ID });
    const payload = ticket.getPayload();
    const email = (payload?.email || '').toLowerCase();
    if (!email || payload.email_verified === false) {
      return res.status(401).json({ message: 'Google account email not available', code: 'google_email_unavailable' });
    }
    let user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          email,
          name: payload.name || payload.given_name || '',
          googleId: payload.sub,
          avatarUrl: payload.picture || null,
          emailVerified: true,
          isAdmin: false,
        },
      });
    } else if (!user.googleId) {
      // Link Google to an existing email/password account.
      user = await prisma.user.update({
        where: { id: user.id },
        data: { googleId: payload.sub, emailVerified: true },
      });
    }
    res.json({ token: makeToken(user), user: publicUser(user) });
  } catch (e) {
    console.error('google auth error:', e);
    res.status(401).json({ message: 'Invalid Google sign-in', code: 'invalid_google' });
  }
});

// ── Telegram bot (Mini App) ───────────────────────────────────────────────────
// The site runs as a Telegram Mini App. There is no login widget; instead, while
// a logged-in user is inside Telegram, the frontend posts the WebApp initData to
// /api/me/telegram-link so we can store their Telegram chat id. The bot then
// notifies them (e.g. when a chef they follow publishes) via sendTelegramMessage.
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

// Verify Telegram Mini App initData and return the embedded `user` object, or
// null if invalid. https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
function verifyTelegramInitData(initData) {
  if (!TELEGRAM_BOT_TOKEN || !initData) return null;
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    if (!hash) return null;
    params.delete('hash');
    const dataCheckString = [...params.entries()]
      .map(([k, v]) => `${k}=${v}`)
      .sort()
      .join('\n');
    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(TELEGRAM_BOT_TOKEN).digest();
    const computed = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
    if (computed !== hash) return null;
    // Reject stale payloads (older than 1 day).
    if (Math.abs(Date.now() / 1000 - Number(params.get('auth_date') || 0)) > 86400) return null;
    const userJson = params.get('user');
    return userJson ? JSON.parse(userJson) : null;
  } catch {
    return null;
  }
}

// Send a message via the Telegram Bot API (best-effort; never throws).
async function sendTelegramMessage(chatId, text) {
  if (!TELEGRAM_BOT_TOKEN || !chatId) return;
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
    });
  } catch (e) {
    console.error('telegram send failed:', e?.message || e);
  }
}

// Link the current account to the Telegram user it's opened by (inside the Mini App).
app.post('/api/me/telegram-link', requireAuth, async (req, res) => {
  const tgUser = verifyTelegramInitData(req.body?.initData);
  if (!tgUser?.id) return res.status(400).json({ message: 'Invalid Telegram data', code: 'invalid_telegram' });
  try {
    const telegramId = String(tgUser.id);
    // Single-owner: detach this telegram id from any other account first.
    await prisma.user.updateMany({ where: { telegramId, NOT: { id: req.user.id } }, data: { telegramId: null } });
    await prisma.user.update({
      where: { id: req.user.id },
      data: { telegramId, telegramUsername: tgUser.username || null },
    });
    res.json({ ok: true });
  } catch (e) {
    console.error('telegram link error:', e);
    res.status(500).json({ message: 'Server error', code: 'server_error' });
  }
});

// ── Telegram Login Widget (register / log in from the normal website) ──────────
// The frontend Telegram Login Widget returns the signed-in user's data + a hash.
// We verify the hash with the bot token, then find-or-create the user. This is
// the classic widget flow (distinct from the Mini App initData flow above) and
// lets people register or log in with Telegram from the website. A widget user
// has a telegramId but no email, so they receive notifications via the bot.
app.post('/api/auth/telegram', async (req, res) => {
  if (!TELEGRAM_BOT_TOKEN) {
    return res.status(503).json({ message: 'Telegram login is not configured', code: 'telegram_not_configured' });
  }
  const { hash, ...fields } = req.body || {};
  if (!hash || !fields.id) return res.status(400).json({ message: 'Invalid Telegram data', code: 'invalid_telegram' });
  try {
    // Verify the data really came from Telegram (HMAC-SHA256, key = SHA256(bot token)).
    const checkString = Object.keys(fields).sort().map((k) => `${k}=${fields[k]}`).join('\n');
    const secret = crypto.createHash('sha256').update(TELEGRAM_BOT_TOKEN).digest();
    const hmac = crypto.createHmac('sha256', secret).update(checkString).digest('hex');
    if (hmac !== hash) return res.status(401).json({ message: 'Telegram verification failed', code: 'invalid_telegram' });
    // Reject stale payloads (older than 1 day).
    if (Math.abs(Date.now() / 1000 - Number(fields.auth_date || 0)) > 86400) {
      return res.status(401).json({ message: 'Telegram data expired', code: 'invalid_telegram' });
    }
    const telegramId = String(fields.id);
    let user = await prisma.user.findFirst({ where: { telegramId } });
    if (!user) {
      const name = [fields.first_name, fields.last_name].filter(Boolean).join(' ').trim();
      user = await prisma.user.create({
        data: {
          telegramId,
          telegramUsername: fields.username || null,
          name: name || null,
          avatarUrl: fields.photo_url || null,
          isAdmin: false,
        },
      });
    }
    res.json({ token: makeToken(user), user: publicUser(user) });
  } catch (e) {
    console.error('telegram auth error:', e);
    res.status(500).json({ message: 'Server error', code: 'server_error' });
  }
});

// ── Password reset via emailed code ──────────────────────────────────────────
// Request a reset code by email.
app.post('/api/auth/forgot', async (req, res) => {
  try {
    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    if (!email) return res.status(400).json({ message: 'Email is required' });

    const user = await prisma.user.findUnique({ where: { email } });
    // Only send if the account exists, but always respond ok (no enumeration).
    if (user) {
      const code = await createCode({ email, type: 'reset', userId: user.id });
      try {
        await sendMail({
          to: email,
          subject: 'Your Dasturkhon password reset code',
          text: `Your password reset code is ${code}. It expires in 10 minutes. If you didn't request this, ignore this email.`,
          html: `<div style="font-family:sans-serif"><p>Your Dasturkhon password reset code is:</p><p style="font-size:28px;font-weight:bold;letter-spacing:4px;color:#4A7C7E">${code}</p><p>It expires in 10 minutes. If you didn't request this, ignore this email.</p></div>`,
        });
      } catch (e) {
        console.error('reset email error:', e);
      }
    }
    res.json({ ok: true });
  } catch (e) {
    console.error('forgot error:', e);
    res.status(500).json({ message: 'Server error' });
  }
});

// Verify the code and set a new password.
app.post('/api/auth/reset', async (req, res) => {
  try {
    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = req.body.password;
    if (!email) return res.status(400).json({ message: 'Email and code are required' });
    if (typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters', code: 'weak_password' });
    }
    const { error, status, code } = await consumeCode({ email, type: 'reset', code: req.body.code });
    if (error) return res.status(status).json({ message: error, code });

    const passwordHash = await bcrypt.hash(password, 10);
    await prisma.user.update({ where: { email }, data: { passwordHash } });
    res.json({ ok: true });
  } catch (e) {
    console.error('reset error:', e);
    res.status(500).json({ message: 'Server error' });
  }
});

// Diagnostic: admin can check whether email sending is configured/working.
app.get('/api/admin/email-status', requireAuth, requireAdmin, (req, res) => {
  res.json(getEmailStatus());
});

// Admin: user/usage statistics (total registered, currently online, new signups).
app.get('/api/admin/stats', requireAuth, requireAdmin, async (req, res) => {
  try {
    const now = Date.now();
    const onlineSince = new Date(now - ONLINE_WINDOW_MS);
    const dayAgo = new Date(now - 24 * 60 * 60 * 1000);
    const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
    const [totalUsers, onlineUsers, newToday, newThisWeek, totalRecipes] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { lastSeen: { gte: onlineSince } } }),
      prisma.user.count({ where: { createdAt: { gte: dayAgo } } }),
      prisma.user.count({ where: { createdAt: { gte: weekAgo } } }),
      prisma.recipe.count({ where: { status: 'approved' } }),
    ]);
    res.json({ totalUsers, onlineUsers, newToday, newThisWeek, totalRecipes, onlineWindowMinutes: ONLINE_WINDOW_MS / 60000 });
  } catch (e) {
    console.error('admin stats error:', e);
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/api/me', (req, res) => {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ message: 'No token' });
  const parts = auth.split(' ');
  if (parts.length !== 2) return res.status(401).json({ message: 'Bad token' });
  const token = parts[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    // Fetch latest user data from DB to ensure isAdmin is up to date
    prisma.user.findUnique({ where: { id: payload.id } }).then(user => {
      if (!user) return res.status(401).json({ message: 'User not found' });
      res.json({ user: publicUser(user) });
    }).catch(e => res.status(500).json({ message: 'Server error' }));
  } catch (e) {
    res.status(401).json({ message: 'Invalid token' });
  }
});

// Pantry CRUD
app.get('/api/pantry', requireAuth, async (req, res) => {
  try {
    const items = await prisma.pantryItem.findMany({ where: { userId: req.user.id }, orderBy: { createdAt: 'desc' } });
    res.json(items);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/pantry', requireAuth, async (req, res) => {
  try {
    const { name, status, category, quantity } = req.body;
    const item = await prisma.pantryItem.create({ data: { userId: req.user.id, name, status, category, quantity } });
    res.json(item);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Server error' });
  }
});

app.put('/api/pantry/:id', requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const existing = await prisma.pantryItem.findUnique({ where: { id } });
    if (!existing || existing.userId !== req.user.id) return res.status(404).json({ message: 'Not found' });
    const updated = await prisma.pantryItem.update({ where: { id }, data: req.body });
    res.json(updated);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Server error' });
  }
});

app.delete('/api/pantry/:id', requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const existing = await prisma.pantryItem.findUnique({ where: { id } });
    if (!existing || existing.userId !== req.user.id) return res.status(404).json({ message: 'Not found' });
    await prisma.pantryItem.delete({ where: { id } });
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Server error' });
  }
});

// Shopping CRUD
app.get('/api/shopping', requireAuth, async (req, res) => {
  try {
    const items = await prisma.shoppingItem.findMany({ where: { userId: req.user.id }, orderBy: { createdAt: 'desc' } });
    res.json(items);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/shopping', requireAuth, async (req, res) => {
  try {
    const { name, quantity, recipeId, recipeName, checked } = req.body;
    const item = await prisma.shoppingItem.create({ data: { userId: req.user.id, name, quantity, recipeId, recipeName, checked: !!checked } });
    res.json(item);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Server error' });
  }
});

app.put('/api/shopping/:id', requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const existing = await prisma.shoppingItem.findUnique({ where: { id } });
    if (!existing || existing.userId !== req.user.id) return res.status(404).json({ message: 'Not found' });
    const updated = await prisma.shoppingItem.update({ where: { id }, data: req.body });
    res.json(updated);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Server error' });
  }
});

app.delete('/api/shopping/:id', requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const existing = await prisma.shoppingItem.findUnique({ where: { id } });
    if (!existing || existing.userId !== req.user.id) return res.status(404).json({ message: 'Not found' });
    await prisma.shoppingItem.delete({ where: { id } });
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Server error' });
  }
});

// Recipe CRUD
// Recipe CRUD
app.get('/api/recipes', optionalAuth, async (req, res) => {
  try {
    // Public endpoint: only approved recipes. Include review ratings so cards
    // can show an average score.
    const recipes = await prisma.recipe.findMany({
      where: { status: 'approved' },
      orderBy: { createdAt: 'desc' },
      include: {
        reviews: { select: { rating: true } },
        user: { select: { id: true, name: true, email: true, avatarUrl: true } },
      },
    });

    const parsedRecipes = recipes.map(r => {
      const reviewCount = r.reviews.length;
      const rating = reviewCount
        ? Math.round((r.reviews.reduce((s, rv) => s + rv.rating, 0) / reviewCount) * 10) / 10
        : 0;
      const { reviews, price, ...rest } = r;
      return {
        ...rest,
        rating,
        reviewCount,
        ingredients: JSON.parse(r.ingredients),
        instructions: JSON.parse(r.instructions),
        id: String(r.id),
      };
    });
    res.json(parsedRecipes);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Server error' });
  }
});

// Admin only: Get pending recipes
app.get('/api/recipes/pending', requireAuth, requireAdmin, async (req, res) => {
  try {
    const recipes = await prisma.recipe.findMany({
      where: { status: 'pending' },
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { name: true, email: true } } }
    });

    const parsedRecipes = recipes.map(r => ({
      ...r,
      ingredients: JSON.parse(r.ingredients),
      instructions: JSON.parse(r.instructions),
      id: String(r.id)
    }));
    res.json(parsedRecipes);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/recipes', requireAuth, async (req, res) => {
  try {
    const { title, image, cookTime, servings, category, ingredients, instructions, youtubeUrl, orderable, orderPhone } = req.body;

    // A preview photo is mandatory — reject recipes without an image.
    if (typeof image !== 'string' || !image.trim()) {
      return res.status(400).json({ message: 'A recipe image is required', code: 'image_required' });
    }

    // Orderable recipes must carry a phone number for the call-to-order link.
    const isOrderable = !!orderable;
    const phone = isOrderable && typeof orderPhone === 'string' ? orderPhone.trim() : '';
    if (isOrderable && !phone) {
      return res.status(400).json({ message: 'A phone number is required for orderable recipes', code: 'order_phone_required' });
    }

    const recipe = await prisma.recipe.create({
      data: {
        title,
        image,
        cookTime,
        servings: Number(servings),
        category,
        youtubeUrl: youtubeUrl || null,
        orderable: isOrderable,
        orderPhone: isOrderable ? phone : null,
        ingredients: JSON.stringify(ingredients || []),
        instructions: JSON.stringify(instructions || []),
        userId: req.user.id,
        status: req.user.isAdmin ? 'approved' : 'pending'
      }
    });

    // If it's published immediately (admin), notify the author's followers.
    // Otherwise it's pending — let the site owner know a recipe needs approval.
    if (recipe.status === 'approved') notifyFollowers(req.user.id, recipe);
    else notifyOwnerOfPendingRecipe(recipe, req.user);

    res.json({
      ...recipe,
      ingredients: JSON.parse(recipe.ingredients),
      instructions: JSON.parse(recipe.instructions),
      id: String(recipe.id)
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Server error' });
  }
});

app.put('/api/recipes/:id/status', requireAuth, requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { status, isPro } = req.body; // 'approved' or 'rejected'

    const existing = await prisma.recipe.findUnique({ where: { id } });

    const data = { status };
    if (typeof isPro === 'boolean') data.isPro = isPro;

    const updated = await prisma.recipe.update({
      where: { id },
      data
    });

    // Notify the author's followers the first time a recipe is approved.
    if (status === 'approved' && existing && existing.status !== 'approved') {
      notifyFollowers(updated.userId, updated);
    }

    res.json(updated);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Server error' });
  }
});

app.put('/api/recipes/:id', requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { title, image, cookTime, servings, category, ingredients, instructions, youtubeUrl, orderable, orderPhone } = req.body;

    // Check existence and permission
    const existing = await prisma.recipe.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ message: 'Recipe not found' });

    // Allow admin or owner
    if (!req.user.isAdmin && existing.userId !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    // A preview photo stays mandatory on edit too.
    if (typeof image !== 'string' || !image.trim()) {
      return res.status(400).json({ message: 'A recipe image is required', code: 'image_required' });
    }

    const isOrderable = !!orderable;
    const phone = isOrderable && typeof orderPhone === 'string' ? orderPhone.trim() : '';
    if (isOrderable && !phone) {
      return res.status(400).json({ message: 'A phone number is required for orderable recipes', code: 'order_phone_required' });
    }

    const updated = await prisma.recipe.update({
      where: { id },
      data: {
        title,
        image,
        cookTime,
        servings: Number(servings),
        category,
        youtubeUrl: youtubeUrl || null,
        orderable: isOrderable,
        orderPhone: isOrderable ? phone : null,
        ingredients: JSON.stringify(ingredients || []),
        instructions: JSON.stringify(instructions || [])
      }
    });

    res.json({
      ...updated,
      ingredients: JSON.parse(updated.ingredients),
      instructions: JSON.parse(updated.instructions),
      id: String(updated.id)
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Server error' });
  }
});

app.delete('/api/recipes/:id', requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const existing = await prisma.recipe.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ message: 'Not found' });

    if (!req.user.isAdmin && existing.userId !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    await prisma.recipe.delete({ where: { id } });
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Server error' });
  }
});

// Favorites CRUD
app.get('/api/favorites', requireAuth, async (req, res) => {
  try {
    const favorites = await prisma.favorite.findMany({
      where: { userId: req.user.id },
      include: { recipe: true }
    });
    const parsedFavorites = favorites.map(f => ({
      ...f.recipe,
      ingredients: JSON.parse(f.recipe.ingredients),
      instructions: JSON.parse(f.recipe.instructions),
      id: String(f.recipe.id)
    }));
    res.json(parsedFavorites);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/favorites/:recipeId', requireAuth, async (req, res) => {
  try {
    const recipeId = Number(req.params.recipeId);

    // Check if recipe exists
    const recipe = await prisma.recipe.findUnique({ where: { id: recipeId } });
    if (!recipe) return res.status(404).json({ message: 'Recipe not found' });

    // Check if already favorite
    const existing = await prisma.favorite.findUnique({
      where: {
        userId_recipeId: {
          userId: req.user.id,
          recipeId
        }
      }
    });

    if (existing) return res.json({ message: 'Already favorite' });

    await prisma.favorite.create({
      data: {
        userId: req.user.id,
        recipeId
      }
    });

    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Server error' });
  }
});

app.delete('/api/favorites/:recipeId', requireAuth, async (req, res) => {
  try {
    const recipeId = Number(req.params.recipeId);

    await prisma.favorite.deleteMany({
      where: {
        userId: req.user.id,
        recipeId
      }
    });

    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/recipes/:id/reviews
// Public – anyone can read reviews for a recipe
app.get('/api/recipes/:id/reviews', async (req, res) => {
  try {
    const recipeId = Number(req.params.id);
    const reviews = await prisma.review.findMany({
      where: { recipeId },
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, name: true, email: true, avatarUrl: true } }
      }
    });
    res.json(reviews);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/recipes/:id/reviews
// Protected – logged-in users only, one review per recipe
app.post('/api/recipes/:id/reviews', requireAuth, async (req, res) => {
  try {
    const recipeId = Number(req.params.id);
    const { rating, comment, photoUrl } = req.body;

    // Validate rating
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ message: 'Rating must be between 1 and 5' });
    }

    // Check recipe exists
    const recipe = await prisma.recipe.findUnique({ where: { id: recipeId } });
    if (!recipe) return res.status(404).json({ message: 'Recipe not found' });

    // Check if user already reviewed this recipe
    const existing = await prisma.review.findUnique({
      where: { userId_recipeId: { userId: req.user.id, recipeId } }
    });
    if (existing) {
      return res.status(409).json({ message: 'You have already reviewed this recipe' });
    }

    const review = await prisma.review.create({
      data: {
        userId: req.user.id,
        recipeId,
        rating: Number(rating),
        comment: comment || null,
        photoUrl: photoUrl || null
      },
      include: {
        user: { select: { id: true, name: true, email: true, avatarUrl: true } }
      }
    });

    // Notify the recipe's author (best-effort, never blocks the response).
    notifyReview(req.user.id, recipe, Number(rating));

    res.json(review);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Server error' });
  }
});

// PUT /api/reviews/:id
// Protected – owner can update their own review
app.put('/api/reviews/:id', requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { rating, comment, photoUrl } = req.body;

    const existing = await prisma.review.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ message: 'Review not found' });
    if (existing.userId !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    if (rating && (rating < 1 || rating > 5)) {
      return res.status(400).json({ message: 'Rating must be between 1 and 5' });
    }

    const updated = await prisma.review.update({
      where: { id },
      data: {
        rating: rating ? Number(rating) : existing.rating,
        comment: comment !== undefined ? comment : existing.comment,
        photoUrl: photoUrl !== undefined ? photoUrl : existing.photoUrl
      },
      include: {
        user: { select: { id: true, name: true, email: true, avatarUrl: true } }
      }
    });

    res.json(updated);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Server error' });
  }
});

// DELETE /api/reviews/:id
// Protected – owner or admin can delete a review
app.delete('/api/reviews/:id', requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const existing = await prisma.review.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ message: 'Review not found' });
    if (existing.userId !== req.user.id && !req.user.isAdmin) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    await prisma.review.delete({ where: { id } });
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/recipes/:id/reviews/me
// Protected – get current user's review for this recipe (to pre-fill the form)
app.get('/api/recipes/:id/reviews/me', requireAuth, async (req, res) => {
  try {
    const recipeId = Number(req.params.id);
    const review = await prisma.review.findUnique({
      where: { userId_recipeId: { userId: req.user.id, recipeId } }
    });
    res.json(review || null);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Server error' });
  }
});

// Only the recipe's author (or an admin) may reply to a review on it.
const reviewReplySelect = { user: { select: { id: true, name: true, email: true, avatarUrl: true } } };
async function loadReviewForReply(id, user) {
  if (!Number.isInteger(id)) return { error: 'Review not found', status: 404 };
  const review = await prisma.review.findUnique({
    where: { id },
    include: { recipe: { select: { userId: true } } },
  });
  if (!review) return { error: 'Review not found', status: 404 };
  if (!user.isAdmin && review.recipe.userId !== user.id) {
    return { error: 'Only the recipe author can reply', status: 403, code: 'not_recipe_author' };
  }
  return { review };
}

// POST /api/reviews/:id/reply — add or update the author's reply.
app.post('/api/reviews/:id/reply', requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const reply = typeof req.body?.reply === 'string' ? req.body.reply.trim() : '';
    if (!reply) return res.status(400).json({ message: 'Reply cannot be empty', code: 'reply_required' });
    const { error, status, code } = await loadReviewForReply(id, req.user);
    if (error) return res.status(status).json({ message: error, code });
    const updated = await prisma.review.update({
      where: { id },
      data: { reply, repliedAt: new Date() },
      include: reviewReplySelect,
    });
    res.json(updated);
  } catch (e) {
    console.error('review reply error:', e);
    res.status(500).json({ message: 'Server error' });
  }
});

// DELETE /api/reviews/:id/reply — remove the author's reply.
app.delete('/api/reviews/:id/reply', requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { error, status, code } = await loadReviewForReply(id, req.user);
    if (error) return res.status(status).json({ message: error, code });
    const updated = await prisma.review.update({
      where: { id },
      data: { reply: null, repliedAt: null },
      include: reviewReplySelect,
    });
    res.json(updated);
  } catch (e) {
    console.error('review reply delete error:', e);
    res.status(500).json({ message: 'Server error' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// CHEF PROFILE & FOLLOW ROUTES
// Paste these into server/index.js before the app.listen() call
// ─────────────────────────────────────────────────────────────────────────────

// Compute aggregate stats for a set of users: approved-recipe count, follower
// count, and overall rating/review count across all their approved recipes.
// Batched (a few queries total) so it scales for the leaderboard.
async function getChefStats(userIds) {
  const stats = {};
  for (const id of userIds) {
    stats[id] = { recipeCount: 0, reviewCount: 0, followerCount: 0, ratingSum: 0 };
  }
  if (userIds.length === 0) return stats;

  const [recipeGroups, followGroups, reviews] = await Promise.all([
    prisma.recipe.groupBy({
      by: ['userId'],
      where: { userId: { in: userIds }, status: 'approved' },
      _count: { _all: true },
    }),
    prisma.follow.groupBy({
      by: ['followingId'],
      where: { followingId: { in: userIds } },
      _count: { _all: true },
    }),
    prisma.review.findMany({
      where: { recipe: { userId: { in: userIds }, status: 'approved' } },
      select: { rating: true, recipe: { select: { userId: true } } },
    }),
  ]);

  for (const g of recipeGroups) if (stats[g.userId]) stats[g.userId].recipeCount = g._count._all;
  for (const g of followGroups) if (stats[g.followingId]) stats[g.followingId].followerCount = g._count._all;
  for (const rv of reviews) {
    const uid = rv.recipe?.userId;
    if (stats[uid]) { stats[uid].reviewCount += 1; stats[uid].ratingSum += rv.rating; }
  }

  const out = {};
  for (const id of userIds) {
    const s = stats[id];
    out[id] = {
      recipeCount: s.recipeCount,
      reviewCount: s.reviewCount,
      followerCount: s.followerCount,
      avgRating: s.reviewCount ? Math.round((s.ratingSum / s.reviewCount) * 10) / 10 : 0,
    };
  }
  return out;
}

// GET /api/chefs  —  public leaderboard of all chefs (every user) with stats.
// ?sort=recipes (default) | rating | followers
app.get('/api/chefs', async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, name: true, email: true, avatarUrl: true, bio: true, isPro: true },
    });
    const stats = await getChefStats(users.map(u => u.id));
    const list = users.map(u => ({ ...u, ...stats[u.id] }));

    const sort = req.query.sort;
    if (sort === 'rating') {
      list.sort((a, b) => b.avgRating - a.avgRating || b.reviewCount - a.reviewCount || b.recipeCount - a.recipeCount);
    } else if (sort === 'followers') {
      list.sort((a, b) => b.followerCount - a.followerCount || b.recipeCount - a.recipeCount);
    } else {
      list.sort((a, b) => b.recipeCount - a.recipeCount || b.avgRating - a.avgRating || b.followerCount - a.followerCount);
    }
    res.json(list);
  } catch (e) {
    console.error('chefs leaderboard error:', e);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/chefs/:id/stats  —  lightweight aggregate stats for a single chef
// (used by the recipe modal to show the author's overall rating).
app.get('/api/chefs/:id/stats', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ message: 'Invalid id' });
    const stats = await getChefStats([id]);
    res.json(stats[id]);
  } catch (e) {
    console.error('chef stats error:', e);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/chefs/:id  —  public chef profile with stats
app.get('/api/chefs/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const chef = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        bio: true,
        avatarUrl: true,
        socialLinks: true,
        isPro: true,
        createdAt: true,
        recipes: {
          where: { status: 'approved' },
          orderBy: { createdAt: 'desc' },
          select: {
            id: true, title: true, image: true,
            cookTime: true, servings: true, category: true,
            ingredients: true, instructions: true,
            youtubeUrl: true, isPro: true, createdAt: true,
            orderable: true, orderPhone: true,
            reviews: { select: { rating: true } }
          }
        },
        _count: {
          select: {
            followers: true,
            following: true,
            recipes: { where: { status: 'approved' } }
          }
        }
      }
    });

    if (!chef) return res.status(404).json({ message: 'Chef not found' });

    // Parse recipe JSON fields and calculate avg ratings; also aggregate the
    // chef's overall rating across every approved recipe they published.
    let ratingSum = 0;
    let reviewTotal = 0;
    const recipes = chef.recipes.map(r => {
      const sum = r.reviews.reduce((s, rv) => s + rv.rating, 0);
      ratingSum += sum;
      reviewTotal += r.reviews.length;
      const avg = r.reviews.length ? sum / r.reviews.length : null;
      return {
        ...r,
        id: String(r.id),
        ingredients: JSON.parse(r.ingredients),
        instructions: JSON.parse(r.instructions),
        reviewCount: r.reviews.length,
        avgRating: avg
      };
    });
    const overallRating = reviewTotal ? Math.round((ratingSum / reviewTotal) * 10) / 10 : 0;

    res.json({
      id: chef.id,
      name: chef.name,
      email: chef.email,
      bio: chef.bio,
      avatarUrl: chef.avatarUrl,
      socialLinks: parseSocial(chef.socialLinks),
      isPro: chef.isPro,
      createdAt: chef.createdAt,
      recipes,
      followerCount: chef._count.followers,
      followingCount: chef._count.following,
      recipeCount: chef._count.recipes,
      avgRating: overallRating,
      reviewCount: reviewTotal
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/chefs/:id/follow-status  —  is current user following this chef?
app.get('/api/chefs/:id/follow-status', requireAuth, async (req, res) => {
  try {
    const followingId = Number(req.params.id);
    const existing = await prisma.follow.findUnique({
      where: { followerId_followingId: { followerId: req.user.id, followingId } }
    });
    res.json({ isFollowing: !!existing });
  } catch (e) {
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/chefs/:id/follow  —  follow a chef
app.post('/api/chefs/:id/follow', requireAuth, async (req, res) => {
  try {
    const followingId = Number(req.params.id);
    if (followingId === req.user.id) {
      return res.status(400).json({ message: 'Cannot follow yourself' });
    }
    const chef = await prisma.user.findUnique({ where: { id: followingId } });
    if (!chef) return res.status(404).json({ message: 'Chef not found' });

    // Create the follow only if it doesn't exist yet, so we notify exactly once
    // (re-following is a harmless no-op and won't re-send a notification).
    const already = await prisma.follow.findUnique({
      where: { followerId_followingId: { followerId: req.user.id, followingId } }
    });
    if (!already) {
      await prisma.follow.create({ data: { followerId: req.user.id, followingId } });
      notifyNewFollower(req.user.id, followingId); // best-effort, never blocks the response
    }

    const count = await prisma.follow.count({ where: { followingId } });
    res.json({ ok: true, followerCount: count });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Server error' });
  }
});

// DELETE /api/chefs/:id/follow  —  unfollow a chef
app.delete('/api/chefs/:id/follow', requireAuth, async (req, res) => {
  try {
    const followingId = Number(req.params.id);
    await prisma.follow.deleteMany({
      where: { followerId: req.user.id, followingId }
    });
    const count = await prisma.follow.count({ where: { followingId } });
    res.json({ ok: true, followerCount: count });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Server error' });
  }
});

// Annotate a list of users with whether the current viewer follows each of them.
async function annotateFollowing(users, viewer) {
  if (!viewer || users.length === 0) {
    return users.map(u => ({ ...u, isFollowing: false, isSelf: false }));
  }
  const ids = users.map(u => u.id);
  const mine = await prisma.follow.findMany({
    where: { followerId: viewer.id, followingId: { in: ids } },
    select: { followingId: true },
  });
  const followingSet = new Set(mine.map(m => m.followingId));
  return users.map(u => ({
    ...u,
    isFollowing: followingSet.has(u.id),
    isSelf: u.id === viewer.id,
  }));
}

const userListSelect = { id: true, name: true, email: true, avatarUrl: true, bio: true };

// GET /api/chefs/:id/followers — users who follow this chef
app.get('/api/chefs/:id/followers', optionalAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const rows = await prisma.follow.findMany({
      where: { followingId: id },
      orderBy: { createdAt: 'desc' },
      select: { follower: { select: userListSelect } },
    });
    res.json(await annotateFollowing(rows.map(r => r.follower), req.user));
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/chefs/:id/following — users this chef follows
app.get('/api/chefs/:id/following', optionalAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const rows = await prisma.follow.findMany({
      where: { followerId: id },
      orderBy: { createdAt: 'desc' },
      select: { following: { select: userListSelect } },
    });
    res.json(await annotateFollowing(rows.map(r => r.following), req.user));
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Server error' });
  }
});

// Allowed social platforms and a light sanitizer for their values.
const SOCIAL_PLATFORMS = ['instagram', 'telegram', 'youtube', 'tiktok', 'facebook', 'website'];
function sanitizeSocial(input) {
  if (!input || typeof input !== 'object') return {};
  const out = {};
  for (const key of SOCIAL_PLATFORMS) {
    let v = input[key];
    if (typeof v !== 'string') continue;
    v = v.trim().slice(0, 300);
    if (v) out[key] = v;
  }
  return out;
}

// PUT /api/profile  —  update own bio, avatar, name and social links
app.put('/api/profile', requireAuth, async (req, res) => {
  try {
    const { bio, avatarUrl, name, socialLinks } = req.body;
    const updated = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        ...(name !== undefined && { name }),
        ...(bio !== undefined && { bio }),
        ...(avatarUrl !== undefined && { avatarUrl }),
        ...(socialLinks !== undefined && { socialLinks: JSON.stringify(sanitizeSocial(socialLinks)) })
      }
    });
    res.json({
      id: updated.id, name: updated.name, email: updated.email,
      bio: updated.bio, avatarUrl: updated.avatarUrl,
      socialLinks: parseSocial(updated.socialLinks), isPro: updated.isPro
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete the current user's account and all of their data.
app.delete('/api/account', requireAuth, async (req, res) => {
  try {
    const uid = req.user.id;
    await prisma.$transaction(async (tx) => {
      // The user's own activity
      await tx.pantryItem.deleteMany({ where: { userId: uid } });
      await tx.shoppingItem.deleteMany({ where: { userId: uid } });
      await tx.favorite.deleteMany({ where: { userId: uid } });
      await tx.review.deleteMany({ where: { userId: uid } });
      await tx.recipeLike.deleteMany({ where: { userId: uid } });
      await tx.notification.deleteMany({ where: { OR: [{ userId: uid }, { actorId: uid }] } });
      await tx.follow.deleteMany({ where: { OR: [{ followerId: uid }, { followingId: uid }] } });
      // Prod has a legacy "Order" table (not in the Prisma schema) with a
      // creatorId FK to User (RESTRICT), so clear the user's orders before
      // deleting their recipes/account, or the user delete fails. Raw SQL,
      // Postgres-only, and only if the table actually exists (the
      // information_schema check never aborts the transaction).
      if ((process.env.DATABASE_URL || '').includes('postgres')) {
        const hasOrder = await tx.$queryRawUnsafe(
          `SELECT 1 FROM information_schema.tables WHERE table_name = 'Order' LIMIT 1`
        );
        if (Array.isArray(hasOrder) && hasOrder.length > 0) {
          await tx.$executeRawUnsafe('DELETE FROM "Order" WHERE "creatorId" = $1', uid);
        }
      }
      // The user's recipes (cascades their favorites/reviews/views/likes)
      await tx.recipe.deleteMany({ where: { userId: uid } });
      // Finally the account
      await tx.user.delete({ where: { id: uid } });
    });
    res.json({ ok: true });
  } catch (e) {
    console.error('delete account error:', e);
    res.status(500).json({ message: 'Failed to delete account' });
  }
});

// ── Like / Dislike ────────────────────────────────────────────────────────────

// GET /api/recipes/:id/likes  — public, returns { likes, dislikes, userVote }
app.get('/api/recipes/:id/likes', async (req, res) => {
  try {
    const recipeId = Number(req.params.id);

    const [likes, dislikes] = await Promise.all([
      prisma.recipeLike.count({ where: { recipeId, type: 'like' } }),
      prisma.recipeLike.count({ where: { recipeId, type: 'dislike' } }),
    ]);

    // Optionally return the current user's vote if they're logged in
    let userVote = null;
    const auth = req.headers.authorization;
    if (auth) {
      try {
        const token = auth.split(' ')[1];
        const payload = jwt.verify(token, JWT_SECRET);
        const existing = await prisma.recipeLike.findUnique({
          where: { userId_recipeId: { userId: payload.id, recipeId } }
        });
        userVote = existing ? existing.type : null;
      } catch (_) {}
    }

    res.json({ likes, dislikes, userVote });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/recipes/:id/vote  — toggle like or dislike (requireAuth)
// body: { type: 'like' | 'dislike' }
app.post('/api/recipes/:id/vote', requireAuth, async (req, res) => {
  try {
    const recipeId = Number(req.params.id);
    const { type } = req.body;

    if (type !== 'like' && type !== 'dislike') {
      return res.status(400).json({ message: 'type must be "like" or "dislike"' });
    }

    const existing = await prisma.recipeLike.findUnique({
      where: { userId_recipeId: { userId: req.user.id, recipeId } }
    });

    if (existing && existing.type === type) {
      // Same vote again → remove (toggle off)
      await prisma.recipeLike.delete({ where: { id: existing.id } });
    } else if (existing) {
      // Switching vote
      await prisma.recipeLike.update({ where: { id: existing.id }, data: { type } });
    } else {
      await prisma.recipeLike.create({ data: { userId: req.user.id, recipeId, type } });
    }

    const [likes, dislikes] = await Promise.all([
      prisma.recipeLike.count({ where: { recipeId, type: 'like' } }),
      prisma.recipeLike.count({ where: { recipeId, type: 'dislike' } }),
    ]);

    const userVote = existing && existing.type === type ? null : type;

    res.json({ likes, dislikes, userVote });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/recipes/:id/view  — record a view (called when modal opens)
app.post('/api/recipes/:id/view', async (req, res) => {
  try {
    const recipeId = Number(req.params.id);
    await prisma.recipeView.create({ data: { recipeId } });
    res.json({ ok: true });
  } catch (e) {
    // Silently fail — don't break the UX for a view count
    res.json({ ok: false });
  }
});

// GET /api/analytics/my  — chef's full analytics dashboard data
app.get('/api/analytics/my', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;

    // Get all approved recipes by this chef
    const recipes = await prisma.recipe.findMany({
      where: { userId, status: 'approved' },
      select: {
        id: true,
        title: true,
        image: true,
        category: true,
        createdAt: true,
        isPro: true,
        _count: {
          select: {
            views: true,
            favorites: true,
            reviews: true,
          },
        },
        reviews: {
          select: { rating: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Get follower count
    const followerCount = await prisma.follow.count({
      where: { followingId: userId },
    });

    // Get views over last 30 days (for chart)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recipeIds = recipes.map(r => r.id);

    const recentViews = recipeIds.length
      ? await prisma.recipeView.findMany({
        where: {
          recipeId: { in: recipeIds },
          viewedAt: { gte: thirtyDaysAgo },
        },
        select: { viewedAt: true },
        orderBy: { viewedAt: 'asc' },
      })
      : [];

    // Group views by day for chart
    const viewsByDay = {};
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10); // "2025-06-01"
      viewsByDay[key] = 0;
    }
    recentViews.forEach(v => {
      const key = v.viewedAt.toISOString().slice(0, 10);
      if (viewsByDay[key] !== undefined) viewsByDay[key]++;
    });

    const viewsChart = Object.entries(viewsByDay).map(([date, count]) => ({
      date,
      views: count,
    }));

    // Build per-recipe stats
    const recipeStats = recipes.map(r => {
      const avgRating = r.reviews.length
        ? r.reviews.reduce((s, rv) => s + rv.rating, 0) / r.reviews.length
        : null;
      return {
        id: r.id,
        title: r.title,
        image: r.image,
        category: r.category,
        isPro: r.isPro,
        createdAt: r.createdAt,
        views: r._count.views,
        saves: r._count.favorites,
        reviews: r._count.reviews,
        avgRating,
      };
    });

    // Totals
    const totalViews = recipeStats.reduce((s, r) => s + r.views, 0);
    const totalSaves = recipeStats.reduce((s, r) => s + r.saves, 0);
    const totalReviews = recipeStats.reduce((s, r) => s + r.reviews, 0);
    const totalRecipes = recipeStats.length;

    // Top recipe by views
    const topRecipe = [...recipeStats].sort((a, b) => b.views - a.views)[0] || null;

    res.json({
      summary: { totalViews, totalSaves, totalReviews, totalRecipes, followerCount },
      topRecipe,
      recipeStats,
      viewsChart,
    });
  } catch (e) {
    console.error('analytics error:', e);
    res.status(500).json({ message: 'Server error' });
  }
});


// ── Notifications ─────────────────────────────────────────────────────────────

// Create a "new recipe" notification for every follower of the author.
async function notifyFollowers(authorId, recipe) {
  try {
    const [author, follows] = await Promise.all([
      prisma.user.findUnique({ where: { id: authorId }, select: { name: true } }),
      prisma.follow.findMany({
        where: { followingId: authorId },
        select: { follower: { select: { id: true, email: true, telegramId: true } } },
      }),
    ]);
    if (follows.length === 0) return;
    const authorName = author?.name || 'A chef you follow';

    // In-app notifications
    await Promise.all(
      follows.map(f =>
        prisma.notification.create({
          data: {
            userId: f.follower.id,
            type: 'new_recipe',
            actorId: authorId,
            actorName: author?.name || null,
            recipeId: recipe.id,
            recipeTitle: recipe.title,
          },
        })
      )
    );

    // Best-effort email notifications (never block or throw the request).
    const appUrl = process.env.APP_URL || 'https://dasturkhon.vercel.app';
    for (const f of follows) {
      if (!f.follower.email) continue;
      sendMail({
        to: f.follower.email,
        subject: `${authorName} published a new recipe: ${recipe.title}`,
        text: `${authorName} just published "${recipe.title}" on Dasturkhon. Open the app to see it: ${appUrl}`,
        html: `<div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:0 auto;padding:8px">
          <h2 style="color:#4A7C7E;margin:0 0 12px">New recipe from ${authorName}</h2>
          <p style="font-size:16px;color:#2C3E50;margin:0 0 16px"><strong>${recipe.title}</strong> was just published.</p>
          <p style="margin:0 0 20px"><a href="${appUrl}" style="display:inline-block;background:#4A7C7E;color:#fff;padding:11px 22px;border-radius:12px;text-decoration:none;font-weight:600">View on Dasturkhon</a></p>
          <p style="color:#7A8B99;font-size:12px;margin:0">You receive this because you follow ${authorName} on Dasturkhon.</p>
        </div>`,
      }).catch(err => console.error('follower email failed:', err?.message || err));
    }

    // Best-effort Telegram bot notifications (for followers who opened the Mini App).
    const tgText = `🍽 ${authorName} published a new recipe: "${recipe.title}"\n${appUrl}`;
    for (const f of follows) {
      if (f.follower.telegramId) sendTelegramMessage(f.follower.telegramId, tgText);
    }
  } catch (e) {
    console.error('notifyFollowers error:', e);
  }
}

// Best-effort out-of-app delivery to a single recipient. The in-app bell row is
// created by the caller; this only handles email + Telegram and never throws.
// A user registered via email/Google has an `email` (gets an email); a user
// registered via the Telegram widget has a `telegramId` (gets a bot message).
function deliverExternalAlert(recipient, { subject, text, html, tgText }) {
  if (!recipient) return;
  if (recipient.email && subject) {
    sendMail({ to: recipient.email, subject, text, html })
      .catch(err => console.error('alert email failed:', err?.message || err));
  }
  if (recipient.telegramId && tgText) {
    sendTelegramMessage(recipient.telegramId, tgText);
  }
}

// Notify a user that someone started following them (bell + email/Telegram).
async function notifyNewFollower(followerId, followedId) {
  try {
    if (followerId === followedId) return;
    const [follower, followed] = await Promise.all([
      prisma.user.findUnique({ where: { id: followerId }, select: { name: true } }),
      prisma.user.findUnique({ where: { id: followedId }, select: { id: true, email: true, telegramId: true } }),
    ]);
    if (!followed) return;
    const followerName = follower?.name || 'Someone';

    await prisma.notification.create({
      data: {
        userId: followedId,
        type: 'follow',
        actorId: followerId,
        actorName: follower?.name || null,
      },
    });

    const appUrl = process.env.APP_URL || 'https://dasturkhon.vercel.app';
    deliverExternalAlert(followed, {
      subject: `${followerName} started following you on Dasturkhon`,
      text: `${followerName} started following you on Dasturkhon. Open the app: ${appUrl}`,
      html: `<div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:0 auto;padding:8px">
        <h2 style="color:#4A7C7E;margin:0 0 12px">New follower</h2>
        <p style="font-size:16px;color:#2C3E50;margin:0 0 16px"><strong>${followerName}</strong> started following you.</p>
        <p style="margin:0 0 20px"><a href="${appUrl}" style="display:inline-block;background:#4A7C7E;color:#fff;padding:11px 22px;border-radius:12px;text-decoration:none;font-weight:600">Open Dasturkhon</a></p>
        <p style="color:#7A8B99;font-size:12px;margin:0">You receive this because you have an account on Dasturkhon.</p>
      </div>`,
      tgText: `👤 ${followerName} started following you on Dasturkhon.\n${appUrl}`,
    });
  } catch (e) {
    console.error('notifyNewFollower error:', e);
  }
}

// Notify a recipe's author that someone reviewed it (bell + email/Telegram).
async function notifyReview(reviewerId, recipe, rating) {
  try {
    const authorId = recipe.userId;
    if (!authorId || authorId === reviewerId) return; // don't notify self-reviews
    const [reviewer, author] = await Promise.all([
      prisma.user.findUnique({ where: { id: reviewerId }, select: { name: true } }),
      prisma.user.findUnique({ where: { id: authorId }, select: { id: true, email: true, telegramId: true } }),
    ]);
    if (!author) return;
    const reviewerName = reviewer?.name || 'Someone';

    await prisma.notification.create({
      data: {
        userId: authorId,
        type: 'review',
        actorId: reviewerId,
        actorName: reviewer?.name || null,
        recipeId: recipe.id,
        recipeTitle: recipe.title,
      },
    });

    const appUrl = process.env.APP_URL || 'https://dasturkhon.vercel.app';
    const stars = '⭐'.repeat(Math.max(1, Math.min(5, Number(rating) || 0)));
    deliverExternalAlert(author, {
      subject: `${reviewerName} reviewed your recipe: ${recipe.title}`,
      text: `${reviewerName} left a ${rating}-star review on "${recipe.title}". Open the app: ${appUrl}`,
      html: `<div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:0 auto;padding:8px">
        <h2 style="color:#4A7C7E;margin:0 0 12px">New review</h2>
        <p style="font-size:16px;color:#2C3E50;margin:0 0 8px"><strong>${reviewerName}</strong> reviewed <strong>${recipe.title}</strong>.</p>
        <p style="font-size:16px;margin:0 0 16px">${stars}</p>
        <p style="margin:0 0 20px"><a href="${appUrl}" style="display:inline-block;background:#4A7C7E;color:#fff;padding:11px 22px;border-radius:12px;text-decoration:none;font-weight:600">View on Dasturkhon</a></p>
        <p style="color:#7A8B99;font-size:12px;margin:0">You receive this because you published this recipe on Dasturkhon.</p>
      </div>`,
      tgText: `${stars} ${reviewerName} reviewed your recipe "${recipe.title}".\n${appUrl}`,
    });
  } catch (e) {
    console.error('notifyReview error:', e);
  }
}

// Email the site owner whenever a new recipe is submitted and awaits approval.
// Recipient is OWNER_EMAIL (falls back to the project owner's address).
const OWNER_EMAIL = process.env.OWNER_EMAIL || 'asadbekxayitov2010@gmail.com';
function notifyOwnerOfPendingRecipe(recipe, author) {
  try {
    if (!OWNER_EMAIL) return;
    const who = author?.name || author?.email || `user #${author?.id}`;
    const appUrl = process.env.APP_URL || 'https://dasturkhon.vercel.app';
    sendMail({
      to: OWNER_EMAIL,
      subject: `New recipe pending approval: ${recipe.title}`,
      text: `${who} submitted "${recipe.title}" for approval on Dasturkhon. Review it in the admin panel: ${appUrl}/admin`,
      html: `<div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:0 auto;padding:8px">
        <h2 style="color:#4A7C7E;margin:0 0 12px">Recipe awaiting approval</h2>
        <p style="font-size:16px;color:#2C3E50;margin:0 0 8px"><strong>${who}</strong> submitted a new recipe:</p>
        <p style="font-size:18px;color:#2C3E50;margin:0 0 16px"><strong>${recipe.title}</strong></p>
        <p style="margin:0 0 20px"><a href="${appUrl}/admin" style="display:inline-block;background:#4A7C7E;color:#fff;padding:11px 22px;border-radius:12px;text-decoration:none;font-weight:600">Review in admin panel</a></p>
        <p style="color:#7A8B99;font-size:12px;margin:0">You receive this because you are the site owner of Dasturkhon.</p>
      </div>`,
    }).catch(err => console.error('owner pending-recipe email failed:', err?.message || err));
  } catch (e) {
    console.error('notifyOwnerOfPendingRecipe error:', e);
  }
}

app.get('/api/notifications', requireAuth, async (req, res) => {
  try {
    const items = await prisma.notification.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });
    const unread = await prisma.notification.count({ where: { userId: req.user.id, read: false } });
    res.json({ items, unread });
  } catch (e) {
    console.error('notifications error:', e);
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/notifications/read', requireAuth, async (req, res) => {
  try {
    await prisma.notification.updateMany({
      where: { userId: req.user.id, read: false },
      data: { read: true },
    });
    res.json({ ok: true });
  } catch (e) {
    console.error('notifications read error:', e);
    res.status(500).json({ message: 'Server error' });
  }
});

// Admin: view the most recent errors from the log file.
app.get('/api/admin/logs', requireAuth, requireAdmin, (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 200, 1000);
  res.json({ lines: getRecentLogs(limit) });
});

// Global error handler — catches anything thrown in a route and logs it.
// (Express 4 identifies error handlers by the 4-arg signature.)
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  logError(`express ${req.method} ${req.originalUrl}`, err);
  if (res.headersSent) return;
  res.status(500).json({ message: 'Server error' });
});

// Additive, idempotent schema guards applied at boot on Postgres (prod).
// We deliberately do NOT use `prisma db push` on deploy: the prod DB carries
// tables/columns that aren't in the Prisma schema (legacy `Order` table, a
// `price` column), so `db push` would try to drop them — aborting the boot
// (without --accept-data-loss) or destroying data (with it). These targeted
// `ADD COLUMN IF NOT EXISTS` statements only ever ADD, never drop, so they are
// safe with drift and let new columns reach prod automatically on deploy.
async function ensureSchema() {
  const stmts = [
    'ALTER TABLE "Recipe" ADD COLUMN IF NOT EXISTS "orderable" BOOLEAN NOT NULL DEFAULT false',
    'ALTER TABLE "Recipe" ADD COLUMN IF NOT EXISTS "orderPhone" TEXT',
    'ALTER TABLE "Review" ADD COLUMN IF NOT EXISTS "reply" TEXT',
    'ALTER TABLE "Review" ADD COLUMN IF NOT EXISTS "repliedAt" TIMESTAMP(3)',
  ];
  for (const sql of stmts) {
    try {
      await prisma.$executeRawUnsafe(sql);
    } catch (e) {
      console.error('ensureSchema failed for:', sql, '-', e?.message || e);
    }
  }
}

async function start() {
  // Only Postgres (prod) needs this; dev uses sqlite via `prisma db push`.
  if ((process.env.DATABASE_URL || '').includes('postgres')) {
    await ensureSchema();
  }
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on port ${PORT}`);
  });
}

start().catch((e) => {
  console.error('startup error:', e);
  process.exit(1);
});

export default app;
