import { lazy, Suspense, useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { Toaster } from 'sonner';
import { Header } from './components/Header';
import { Celebration } from './components/Celebration';
import { Footer } from './components/Footer';
import { ProtectedRoute } from './auth/ProtectedRoute';
import '../i18n/config';

import { useAuth } from './auth/AuthProvider';
import { useScrollReveal } from './hooks/useScrollReveal';
import { PanLoader } from './components/PanLoader';

// Lazy-loaded pages
const HomePage = lazy(() => import('./pages/HomePage').then(m => ({ default: m.HomePage })));
const LoginPage = lazy(() => import('./pages/LoginPage').then(m => ({ default: m.LoginPage })));
const SignupPage = lazy(() => import('./pages/SignupPage').then(m => ({ default: m.SignupPage })));
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage').then(m => ({ default: m.ForgotPasswordPage })));
const RecipesPage = lazy(() => import('./pages/RecipesPage').then(m => ({ default: m.RecipesPage })));
const PantryPage = lazy(() => import('./pages/PantryPage').then(m => ({ default: m.PantryPage })));
const ShoppingListPage = lazy(() => import('./pages/ShoppingListPage').then(m => ({ default: m.ShoppingListPage })));
const FavoritesPage = lazy(() => import('./pages/FavoritesPage').then(m => ({ default: m.FavoritesPage })));
const ProfilePage = lazy(() => import('./pages/ProfilePage').then(m => ({ default: m.ProfilePage })));
const AdminPage = lazy(() => import('./pages/AdminPage').then(m => ({ default: m.AdminPage })));
const ChefProfilePage = lazy(() => import('./pages/ChefProfilePage').then(m => ({ default: m.ChefProfilePage })));
const RatingPage = lazy(() => import('./pages/RatingPage').then(m => ({ default: m.RatingPage })));

// Wraps the routed pages so each navigation fades/slides in for a modern feel.
// Routes that require a logged-in user. Everything else (notably "/") is public.
const PROTECTED_PREFIXES = ['/pantry', '/shopping', '/favorites', '/profile', '/admin', '/chef'];

function AnimatedRoutes({ dailyCalories }: { dailyCalories: number }) {
  const location = useLocation();
  const { user } = useAuth();

  // Gate protected routes here, OUTSIDE the AnimatePresence. Redirecting from
  // inside the keyed/animated subtree deadlocks framer-motion's mode="wait".
  const requiresAuth = PROTECTED_PREFIXES.some(
    (p) => location.pathname === p || location.pathname.startsWith(p + '/')
  );
  if (!user && requiresAuth) {
    try { sessionStorage.setItem('redirectAfterLogin', location.pathname); } catch { /* ignore */ }
    return <Navigate to="/login" replace />;
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      >
        <Suspense fallback={
          <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4 py-12">
            <PanLoader />
            <p className="text-gray-400 text-sm animate-pulse font-medium">Yuklanmoqda...</p>
          </div>
        }>
          <Routes location={location}>
            <Route path="/" element={<HomePage dailyCalories={dailyCalories} />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/forgot" element={<ForgotPasswordPage />} />
            <Route path="/chef/:id" element={<ProtectedRoute><ChefProfilePage /></ProtectedRoute>} />
            <Route path="/admin" element={<ProtectedRoute><AdminPage /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
            <Route path="/recipes" element={<RecipesPage />} />
            <Route path="/rating" element={<RatingPage />} />
            <Route path="/pantry" element={<ProtectedRoute><PantryPage /></ProtectedRoute>} />
            <Route path="/shopping" element={<ProtectedRoute><ShoppingListPage /></ProtectedRoute>} />
            <Route path="/favorites" element={<ProtectedRoute><FavoritesPage /></ProtectedRoute>} />
          </Routes>
        </Suspense>
      </motion.div>
    </AnimatePresence>
  );
}

function App() {
  const { loading } = useAuth();
  useScrollReveal();
  const [dailyCalories, setDailyCalories] = useState<number>(() => {
    const saved = localStorage.getItem('dasturxon-daily-calories');
    const savedDate = localStorage.getItem('dasturxon-calories-date');
    const today = new Date().toDateString();

    if (savedDate === today && saved) {
      return JSON.parse(saved);
    }
    return 0;
  });

  useEffect(() => {
    const today = new Date().toDateString();
    localStorage.setItem('dasturxon-daily-calories', JSON.stringify(dailyCalories));
    localStorage.setItem('dasturxon-calories-date', today);
  }, [dailyCalories]);

  const addCalories = (calories: number) => {
    setDailyCalories(prev => prev + calories);
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-6">
          <PanLoader />
          <p className="text-gray-500 font-medium animate-pulse">Loading Dasturkhon...</p>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <DndProvider backend={HTML5Backend}>
        <div className="min-h-screen" style={{ backgroundColor: 'var(--background)' }}>
          <Header />
          {/* NewsTicker removed per request */}

          <AnimatedRoutes dailyCalories={dailyCalories} />

          <Footer />

          {/* QR sync removed */}
          <Toaster position="top-right" richColors duration={3000} />
          <Celebration />
        </div>
      </DndProvider>
    </BrowserRouter>
  );
}

export default App;
