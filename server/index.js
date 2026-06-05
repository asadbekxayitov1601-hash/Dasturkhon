import 'dotenv/config';
import crypto from 'crypto';
import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import { OAuth2Client } from 'google-auth-library';
import { sendMail, getEmailStatus } from './services/email.js';

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
  if (!entry) return { error: 'No pending request. Please start again.', status: 400 };
  if (entry.expiresAt.getTime() < Date.now()) {
    await prisma.verificationCode.delete({ where: { id: entry.id } });
    return { error: 'Code expired. Please start again.', status: 400 };
  }
  if (entry.attempts >= 5) {
    await prisma.verificationCode.delete({ where: { id: entry.id } });
    return { error: 'Too many attempts. Please start again.', status: 429 };
  }
  if (String(code || '').trim() !== entry.code) {
    await prisma.verificationCode.update({ where: { id: entry.id }, data: { attempts: entry.attempts + 1 } });
    return { error: 'Invalid code', status: 400 };
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
    // *.vercel.app deployment (covers preview deployments too).
    if (allowedOrigins.includes(normalized) || /\.vercel\.app$/.test(normalized)) {
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

// Payment mode: "test" confirms orders instantly without charging (no gateway
// wired yet). Switch to a real provider (Uzum) later by confirming orders from
// its webhook instead. confirmOrderPaid is the single place an order becomes
// "paid" and starts counting toward a creator's balance.
const PAYMENTS_MODE = process.env.PAYMENTS_MODE || 'test';

async function confirmOrderPaid(orderId) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order || order.status === 'paid') return order;
  return prisma.order.update({
    where: { id: orderId },
    data: { status: 'paid', paidAt: new Date() },
  });
}

// ── Signup with email verification code ─────────────────────────────────────
// Step 1 (signup-request) validates input, stores the pending account (as a DB
// verification code with the name+passwordHash payload) and emails a 6-digit
// code. Step 2 (signup-verify) checks the code and creates the real account.
app.post('/api/auth/signup-request', async (req, res) => {
  const { name, email, password } = req.body;
  if (typeof email !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ message: 'Invalid email or password' });
  }
  const normalizedEmail = email.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalizedEmail)) {
    return res.status(400).json({ message: 'Invalid email address' });
  }
  if (password.length < 6) {
    return res.status(400).json({ message: 'Password must be at least 6 characters' });
  }
  try {
    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) return res.status(409).json({ message: 'Email already registered' });
    const passwordHash = await bcrypt.hash(password, 10);
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
      return res.status(502).json({ message: "Couldn't send the code. Please check your email address is correct." });
    }
    res.json({ ok: true });
  } catch (e) {
    console.error('signup-request error:', e);
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/auth/signup-verify', async (req, res) => {
  const normalizedEmail = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const { entry, error, status } = await consumeCode({ email: normalizedEmail, type: 'signup', code: req.body.code });
  if (error) return res.status(status).json({ message: error });
  try {
    // Guard against the email being registered between step 1 and step 2.
    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) return res.status(409).json({ message: 'Email already registered' });
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
    return res.status(400).json({ message: 'Missing email or password' });
  }
  const normalizedEmail = email.trim().toLowerCase();
  try {
    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    // Google-only accounts have no passwordHash — reject password login for them.
    if (!user || !user.passwordHash) return res.status(401).json({ message: 'Invalid credentials' });
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ message: 'Invalid credentials' });
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
      return res.status(502).json({ message: 'Could not send login code. Please try again.' });
    }
    res.json({ needsCode: true, email: normalizedEmail });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/auth/login-verify', async (req, res) => {
  const normalizedEmail = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const { entry, error, status } = await consumeCode({ email: normalizedEmail, type: 'login', code: req.body.code });
  if (error) return res.status(status).json({ message: error });
  try {
    const user = await prisma.user.findUnique({ where: { id: entry.userId } });
    if (!user) return res.status(401).json({ message: 'Invalid credentials' });
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
  if (!googleClient) return res.status(503).json({ message: 'Google sign-in is not configured' });
  const { credential } = req.body;
  if (typeof credential !== 'string') return res.status(400).json({ message: 'Missing Google credential' });
  try {
    const ticket = await googleClient.verifyIdToken({ idToken: credential, audience: GOOGLE_CLIENT_ID });
    const payload = ticket.getPayload();
    const email = (payload?.email || '').toLowerCase();
    if (!email || payload.email_verified === false) {
      return res.status(401).json({ message: 'Google account email not available' });
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
    res.status(401).json({ message: 'Invalid Google sign-in' });
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
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }
    const { error, status } = await consumeCode({ email, type: 'reset', code: req.body.code });
    if (error) return res.status(status).json({ message: error });

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

    // Which paid recipes has the viewer already unlocked?
    let ownedRecipeIds = new Set();
    if (req.user) {
      const owned = await prisma.order.findMany({
        where: { buyerId: req.user.id, type: 'purchase', status: 'paid' },
        select: { recipeId: true },
      });
      ownedRecipeIds = new Set(owned.map(o => o.recipeId));
    }

    const parsedRecipes = recipes.map(r => {
      const isOwner = req.user && req.user.id === r.userId;
      const hasAccess = r.price === 0 || isOwner || ownedRecipeIds.has(r.id);
      const locked = r.price > 0 && !hasAccess;
      const reviewCount = r.reviews.length;
      const rating = reviewCount
        ? Math.round((r.reviews.reduce((s, rv) => s + rv.rating, 0) / reviewCount) * 10) / 10
        : 0;
      const { reviews, ...rest } = r;
      return {
        ...rest,
        price: r.price,
        locked,
        rating,
        reviewCount,
        // Hide the paid content until unlocked.
        ingredients: locked ? [] : JSON.parse(r.ingredients),
        instructions: locked ? [] : JSON.parse(r.instructions),
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
    const { title, image, cookTime, servings, category, ingredients, instructions, youtubeUrl, price } = req.body;

    const recipe = await prisma.recipe.create({
      data: {
        title,
        image,
        cookTime,
        servings: Number(servings),
        category,
        youtubeUrl: youtubeUrl || null,
        price: Math.max(0, Math.round(Number(price) || 0)),
        ingredients: JSON.stringify(ingredients || []),
        instructions: JSON.stringify(instructions || []),
        userId: req.user.id,
        status: req.user.isAdmin ? 'approved' : 'pending'
      }
    });

    // If it's published immediately (admin), notify the author's followers.
    if (recipe.status === 'approved') notifyFollowers(req.user.id, recipe);

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
    const { title, image, cookTime, servings, category, ingredients, instructions, youtubeUrl, price } = req.body;

    // Check existence and permission
    const existing = await prisma.recipe.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ message: 'Recipe not found' });

    // Allow admin or owner
    if (!req.user.isAdmin && existing.userId !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized' });
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
        ...(price !== undefined && { price: Math.max(0, Math.round(Number(price) || 0)) }),
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
        user: { select: { id: true, name: true, email: true } }
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
        user: { select: { id: true, name: true, email: true } }
      }
    });

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
        user: { select: { id: true, name: true, email: true } }
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

// ─────────────────────────────────────────────────────────────────────────────
// CHEF PROFILE & FOLLOW ROUTES
// Paste these into server/index.js before the app.listen() call
// ─────────────────────────────────────────────────────────────────────────────

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

    // Parse recipe JSON fields and calculate avg ratings
    const recipes = chef.recipes.map(r => {
      const avg = r.reviews.length
        ? r.reviews.reduce((s, rv) => s + rv.rating, 0) / r.reviews.length
        : null;
      return {
        ...r,
        id: String(r.id),
        ingredients: JSON.parse(r.ingredients),
        instructions: JSON.parse(r.instructions),
        reviewCount: r.reviews.length,
        avgRating: avg
      };
    });

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
      recipeCount: chef._count.recipes
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

    await prisma.follow.upsert({
      where: { followerId_followingId: { followerId: req.user.id, followingId } },
      create: { followerId: req.user.id, followingId },
      update: {}
    });

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
      await tx.order.deleteMany({ where: { OR: [{ buyerId: uid }, { creatorId: uid }] } });
      await tx.payout.deleteMany({ where: { creatorId: uid } });
      await tx.notification.deleteMany({ where: { OR: [{ userId: uid }, { actorId: uid }] } });
      await tx.follow.deleteMany({ where: { OR: [{ followerId: uid }, { followingId: uid }] } });
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


// ── Paid recipes, tips & creator earnings ─────────────────────────────────────

// Unlock (buy) a paid recipe. In test mode the order is confirmed instantly.
app.post('/api/recipes/:id/buy', requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const recipe = await prisma.recipe.findUnique({ where: { id } });
    if (!recipe) return res.status(404).json({ message: 'Recipe not found' });

    const unlocked = () => ({
      ...recipe,
      price: recipe.price,
      locked: false,
      ingredients: JSON.parse(recipe.ingredients),
      instructions: JSON.parse(recipe.instructions),
      id: String(recipe.id),
    });

    if (recipe.userId === req.user.id || recipe.price <= 0) {
      return res.json({ access: true, recipe: unlocked() });
    }

    const already = await prisma.order.findFirst({
      where: { buyerId: req.user.id, recipeId: id, type: 'purchase', status: 'paid' },
    });
    if (already) return res.json({ access: true, recipe: unlocked() });

    const order = await prisma.order.create({
      data: {
        type: 'purchase',
        amount: recipe.price,
        buyerId: req.user.id,
        creatorId: recipe.userId,
        recipeId: id,
        provider: PAYMENTS_MODE,
      },
    });
    if (PAYMENTS_MODE === 'test') await confirmOrderPaid(order.id);

    res.json({ access: true, recipe: unlocked() });
  } catch (e) {
    console.error('buy error:', e);
    res.status(500).json({ message: 'Server error' });
  }
});

// Tip a recipe's creator.
app.post('/api/recipes/:id/tip', requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const amount = Math.round(Number(req.body.amount) || 0);
    if (amount <= 0) return res.status(400).json({ message: 'Invalid tip amount' });

    const recipe = await prisma.recipe.findUnique({ where: { id } });
    if (!recipe) return res.status(404).json({ message: 'Recipe not found' });
    if (recipe.userId === req.user.id) {
      return res.status(400).json({ message: "You can't tip your own recipe" });
    }

    const order = await prisma.order.create({
      data: {
        type: 'tip',
        amount,
        buyerId: req.user.id,
        creatorId: recipe.userId,
        recipeId: id,
        provider: PAYMENTS_MODE,
      },
    });
    if (PAYMENTS_MODE === 'test') await confirmOrderPaid(order.id);

    res.json({ success: true, message: 'Thank you for supporting the chef!' });
  } catch (e) {
    console.error('tip error:', e);
    res.status(500).json({ message: 'Server error' });
  }
});

// Helper: compute a creator's earnings summary.
async function getEarnings(creatorId) {
  const [paidOrders, payouts] = await Promise.all([
    prisma.order.findMany({
      where: { creatorId, status: 'paid' },
      orderBy: { paidAt: 'desc' },
      include: { recipe: { select: { title: true } }, buyer: { select: { name: true, email: true } } },
    }),
    prisma.payout.findMany({ where: { creatorId }, orderBy: { requestedAt: 'desc' } }),
  ]);
  const totalEarned = paidOrders.reduce((s, o) => s + o.amount, 0);
  const totalPaidOut = payouts.filter(p => p.status === 'paid').reduce((s, p) => s + p.amount, 0);
  const pending = payouts.filter(p => p.status === 'requested').reduce((s, p) => s + p.amount, 0);
  return { paidOrders, payouts, totalEarned, totalPaidOut, pending, balance: totalEarned - totalPaidOut - pending };
}

// Current user's earnings dashboard data.
app.get('/api/me/earnings', requireAuth, async (req, res) => {
  try {
    const e = await getEarnings(req.user.id);
    res.json({
      balance: e.balance,
      totalEarned: e.totalEarned,
      totalPaidOut: e.totalPaidOut,
      pending: e.pending,
      earnings: e.paidOrders.map(o => ({
        id: o.id,
        type: o.type,
        amount: o.amount,
        recipeTitle: o.recipe?.title || null,
        from: o.buyer?.name || o.buyer?.email?.split('@')[0] || 'Someone',
        date: o.paidAt,
      })),
      payouts: e.payouts,
    });
  } catch (e) {
    console.error('earnings error:', e);
    res.status(500).json({ message: 'Server error' });
  }
});

// Request a payout (creator). Amount must not exceed the available balance.
app.post('/api/payouts/request', requireAuth, async (req, res) => {
  try {
    const amount = Math.round(Number(req.body.amount) || 0);
    const note = typeof req.body.note === 'string' ? req.body.note.slice(0, 500) : null;
    if (amount <= 0) return res.status(400).json({ message: 'Invalid amount' });

    const e = await getEarnings(req.user.id);
    if (amount > e.balance) {
      return res.status(400).json({ message: 'Amount exceeds your available balance' });
    }

    const payout = await prisma.payout.create({
      data: { creatorId: req.user.id, amount, note, status: 'requested' },
    });
    res.json(payout);
  } catch (e) {
    console.error('payout request error:', e);
    res.status(500).json({ message: 'Server error' });
  }
});

// Admin: list all payout requests (newest / pending first).
app.get('/api/admin/payouts', requireAuth, requireAdmin, async (req, res) => {
  try {
    const payouts = await prisma.payout.findMany({
      orderBy: [{ status: 'asc' }, { requestedAt: 'desc' }],
      include: { creator: { select: { id: true, name: true, email: true } } },
    });
    res.json(payouts);
  } catch (e) {
    console.error('admin payouts error:', e);
    res.status(500).json({ message: 'Server error' });
  }
});

// Admin: mark a payout request paid (after sending money manually) or reject it.
app.post('/api/admin/payouts/:id/:action', requireAuth, requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { action } = req.params;
    if (action !== 'mark-paid' && action !== 'reject') {
      return res.status(400).json({ message: 'Unknown action' });
    }
    const data = action === 'mark-paid'
      ? { status: 'paid', paidAt: new Date() }
      : { status: 'rejected' };
    const updated = await prisma.payout.update({ where: { id }, data });
    res.json(updated);
  } catch (e) {
    console.error('admin payout update error:', e);
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
        select: { follower: { select: { id: true, email: true } } },
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
  } catch (e) {
    console.error('notifyFollowers error:', e);
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

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server listening on port ${PORT}`);
});

export default app;
