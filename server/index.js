import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';

const app = express();
const PORT = process.env.PORT || 4000;
const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

app.use(cors());
app.use(express.json({ limit: '50mb' }));
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

// Pro Subscription
app.post('/api/subscribe/pro', requireAuth, async (req, res) => {
  try {
    const { plan, cardToken } = req.body; // 'weekly', 'monthly', 'yearly'

    // If cardToken is provided, save it (simplified logic)
    if (cardToken) {
      await prisma.user.update({
        where: { id: req.user.id },
        data: { cardToken }
      });
    }

    // In a real app, charge the card here using the token!

    let endDate = new Date();
    if (plan === 'weekly') endDate.setDate(endDate.getDate() + 7);
    else if (plan === 'yearly') endDate.setFullYear(endDate.getFullYear() + 1);
    else endDate.setMonth(endDate.getMonth() + 1); // Monthly default

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        isPro: true,
        subType: plan,
        subEndDate: endDate
      }
    });

    res.json({ ok: true, user: { id: user.id, email: user.email, name: user.name, isAdmin: user.isAdmin, isPro: user.isPro, cardLast4: user.cardLast4 } });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/payment/verify-card', requireAuth, async (req, res) => {
  try {
    const { cardNumber, expiry } = req.body;
    // Mock gateway call
    // Return transaction ID for OTP step
    res.json({ transactionId: 'txn_' + Date.now(), message: 'SMS sent to linked phone number' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Gateway error' });
  }
});

app.post('/api/payment/confirm-otp', requireAuth, async (req, res) => {
  try {
    const { transactionId, otp, cardNumber } = req.body;

    if (otp !== '1111') { // Mock OTP
      return res.status(400).json({ message: 'Invalid SMS code' });
    }

    // Mock token generation
    const cardToken = 'tok_' + Math.random().toString(36).substr(2, 9);
    const cardLast4 = cardNumber.slice(-4);

    await prisma.user.update({
      where: { id: req.user.id },
      data: { cardToken, cardLast4 }
    });

    res.json({ ok: true, cardToken, cardLast4 });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Verification failed' });
  }
});

app.post('/api/subscribe/cancel', requireAuth, async (req, res) => {
  try {
    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        isPro: false, // Immediately cancel for now
        subType: null,
        subEndDate: null
      }
    });
    res.json({ ok: true, user: { id: user.id, email: user.email, name: user.name, isAdmin: user.isAdmin, isPro: user.isPro, cardLast4: user.cardLast4 } });
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

if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
  });
}

export default app;
