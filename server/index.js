import 'dotenv/config';
import crypto from 'crypto';
import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import { verifyCard, confirmOtp, chargeCard, removeCard, PLAN_AMOUNTS } from './services/payme.js';

const app = express();
const PORT = process.env.PORT || 4000;
const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

const allowedOrigins = [
  process.env.FRONTEND_URL               // your Vercel URL (set in Railway env vars)
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, Postman)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true,
}));

app.use(express.json({ limit: '50mb' }));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use(express.urlencoded({ limit: '50mb', extended: true }));

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

app.post('/api/signup', async (req, res) => {
  const { name, email, password, isAdmin } = req.body;
  if (!email || !password) return res.status(400).json({ message: 'Missing email or password' });
  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(409).json({ message: 'Email already registered' });
    const passwordHash = await bcrypt.hash(password, 10);
    // Allow setting isAdmin for dev/demo purposes
    const user = await prisma.user.create({
      data: {
        name: name || '',
        email,
        passwordHash,
        isAdmin: !!isAdmin
      }
    });
    const token = jwt.sign({ id: user.id, email: user.email, name: user.name, isAdmin: user.isAdmin, isPro: user.isPro }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user.id, email: user.email, name: user.name, isAdmin: user.isAdmin, isPro: user.isPro } });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ message: 'Missing email or password' });
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(401).json({ message: 'Invalid credentials' });
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ message: 'Invalid credentials' });
    const token = jwt.sign({ id: user.id, email: user.email, name: user.name, isAdmin: user.isAdmin, isPro: user.isPro }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user.id, email: user.email, name: user.name, isAdmin: user.isAdmin, isPro: user.isPro } });
  } catch (e) {
    console.error(e);
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
      res.json({ user: { id: user.id, email: user.email, name: user.name, isAdmin: user.isAdmin, isPro: user.isPro } });
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
app.get('/api/recipes', async (req, res) => {
  try {
    const { status } = req.query;
    const where = {};

    // If asking for pending/rejected, must be admin (but we can't easily check auth in a public endpoint without middleware)
    // So let's make the default behavior "approved only".
    // If a special header or query param is passed AND the user is admin, allow it.
    // However, simplest is: This public endpoint returns APPROVED recipes.
    // We'll add a separate protected endpoint for admin to get pending recipes.

    where.status = 'approved';

    const recipes = await prisma.recipe.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    });

    // Parse JSON strings back to arrays
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
    const { title, image, cookTime, servings, category, ingredients, instructions, youtubeUrl } = req.body;

    const recipe = await prisma.recipe.create({
      data: {
        title,
        image,
        cookTime,
        servings: Number(servings),
        category,
        youtubeUrl: youtubeUrl || null,
        ingredients: JSON.stringify(ingredients || []),
        instructions: JSON.stringify(instructions || []),
        userId: req.user.id,
        status: req.user.isAdmin ? 'approved' : 'pending'
      }
    });

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

    const data = { status };
    if (typeof isPro === 'boolean') data.isPro = isPro;

    const updated = await prisma.recipe.update({
      where: { id },
      data
    });

    res.json(updated);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Server error' });
  }
});

app.put('/api/recipes/:id', requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { title, image, cookTime, servings, category, ingredients, instructions, youtubeUrl } = req.body;

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

// PUT /api/profile  —  update own bio and avatar
app.put('/api/profile', requireAuth, async (req, res) => {
  try {
    const { bio, avatarUrl, name } = req.body;
    const updated = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        ...(name !== undefined && { name }),
        ...(bio !== undefined && { bio }),
        ...(avatarUrl !== undefined && { avatarUrl })
      }
    });
    res.json({
      id: updated.id, name: updated.name, email: updated.email,
      bio: updated.bio, avatarUrl: updated.avatarUrl, isPro: updated.isPro
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Server error' });
  }
});

// ── In-memory OTP session store (use Redis in production) ─────────────────────
// Stores { token, plan } keyed by a sessionId
const otpSessions = new Map();

// POST /api/payment/verify-card
// Step 1: Validate card → Payme sends OTP SMS to cardholder
app.post('/api/payment/verify-card', requireAuth, async (req, res) => {
  try {
    const { cardNumber, expiry, plan } = req.body;

    if (!cardNumber || cardNumber.replace(/\s/g, '').length !== 16) {
      return res.status(400).json({ message: 'Card number must be 16 digits' });
    }
    if (!expiry || expiry.length < 4) {
      return res.status(400).json({ message: 'Invalid expiry date' });
    }
    if (!plan || !PLAN_AMOUNTS[plan]) {
      return res.status(400).json({ message: 'Invalid plan selected' });
    }

    const { token, phone } = await verifyCard(cardNumber, expiry);

    // Store token + plan in memory session
    const sessionId = crypto.randomUUID();
    otpSessions.set(sessionId, {
      token,
      plan,
      userId: req.user.id,
      cardLast4: cardNumber.replace(/\s/g, '').slice(-4),
      createdAt: Date.now(),
    });

    // Auto-expire session after 10 minutes
    setTimeout(() => otpSessions.delete(sessionId), 10 * 60 * 1000);

    res.json({
      sessionId,
      phone,    // masked phone shown to user: "+998 ** *** 45 67"
      message: `Verification code sent to ${phone}`,
    });
  } catch (e) {
    console.error('verify-card error:', e);
    res.status(400).json({ message: e.message || 'Card verification failed' });
  }
});

// POST /api/payment/confirm-otp
// Step 2: Confirm OTP → charge card → activate Pro
app.post('/api/payment/confirm-otp', requireAuth, async (req, res) => {
  try {
    const { sessionId, otp } = req.body;

    if (!sessionId || !otp) {
      return res.status(400).json({ message: 'Session ID and OTP are required' });
    }

    const session = otpSessions.get(sessionId);
    if (!session) {
      return res.status(400).json({ message: 'Session expired. Please start again.' });
    }
    if (session.userId !== req.user.id) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    // Step 2a: Verify OTP with Payme → get permanent card token
    const { token: permanentToken, verified } = await confirmOtp(session.token, otp);
    if (!verified) {
      return res.status(400).json({ message: 'Invalid verification code' });
    }

    // Step 2b: Charge the card
    const amount = PLAN_AMOUNTS[session.plan];
    const orderId = `dasturkhon_${req.user.id}_${Date.now()}`;
    const description = `Dasturkhon Pro - ${session.plan} plan`;

    await chargeCard(permanentToken, amount, orderId, description);

    // Step 2c: Calculate subscription end date
    const endDate = new Date();
    if (session.plan === 'weekly') endDate.setDate(endDate.getDate() + 7);
    if (session.plan === 'monthly') endDate.setMonth(endDate.getMonth() + 1);
    if (session.plan === 'yearly') endDate.setFullYear(endDate.getFullYear() + 1);

    // Step 2d: Save to database
    await prisma.user.update({
      where: { id: req.user.id },
      data: {
        isPro: true,
        subType: session.plan,
        subEndDate: endDate,
        cardToken: permanentToken,
        cardLast4: session.cardLast4,
      },
    });

    // Clean up session
    otpSessions.delete(sessionId);

    res.json({
      success: true,
      message: `Successfully subscribed to ${session.plan} plan!`,
      subEndDate: endDate,
    });
  } catch (e) {
    console.error('confirm-otp error:', e);
    res.status(400).json({ message: e.message || 'Payment failed' });
  }
});

// POST /api/payment/use-saved-card
// One-click subscribe with previously saved card token
app.post('/api/payment/use-saved-card', requireAuth, async (req, res) => {
  try {
    const { plan } = req.body;

    if (!plan || !PLAN_AMOUNTS[plan]) {
      return res.status(400).json({ message: 'Invalid plan' });
    }

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user?.cardToken) {
      return res.status(400).json({ message: 'No saved card found' });
    }

    const amount = PLAN_AMOUNTS[plan];
    const orderId = `dasturkhon_${req.user.id}_${Date.now()}`;
    const description = `Dasturkhon Pro - ${plan} plan`;

    await chargeCard(user.cardToken, amount, orderId, description);

    const endDate = new Date();
    if (plan === 'weekly') endDate.setDate(endDate.getDate() + 7);
    if (plan === 'monthly') endDate.setMonth(endDate.getMonth() + 1);
    if (plan === 'yearly') endDate.setFullYear(endDate.getFullYear() + 1);

    await prisma.user.update({
      where: { id: req.user.id },
      data: { isPro: true, subType: plan, subEndDate: endDate },
    });

    res.json({
      success: true,
      message: `Successfully subscribed to ${plan} plan!`,
      subEndDate: endDate,
    });
  } catch (e) {
    console.error('use-saved-card error:', e);
    res.status(400).json({ message: e.message || 'Payment failed' });
  }
});

// POST /api/subscribe/cancel
// Cancel Pro subscription and remove saved card
app.post('/api/subscribe/cancel', requireAuth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });

    // Remove card token from Payme if exists
    if (user?.cardToken) {
      try { await removeCard(user.cardToken); } catch (_) { }
    }

    await prisma.user.update({
      where: { id: req.user.id },
      data: {
        isPro: false,
        subType: null,
        subEndDate: null,
        cardToken: null,
        cardLast4: null,
      },
    });

    res.json({ success: true, message: 'Subscription cancelled' });
  } catch (e) {
    console.error('cancel error:', e);
    res.status(500).json({ message: 'Failed to cancel subscription' });
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


app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server listening on port ${PORT}`);
});

export default app;
