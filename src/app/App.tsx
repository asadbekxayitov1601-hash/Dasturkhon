import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { Toaster } from 'sonner';
import { Header } from './components/Header';
import { LoginPage } from './pages/LoginPage';
import { SignupPage } from './pages/SignupPage';
import { Footer } from './components/Footer';
import { HomePage } from './pages/HomePage';
import { RecipesPage } from './pages/RecipesPage';
import { PantryPage } from './pages/PantryPage';
import { ShoppingListPage } from './pages/ShoppingListPage';
import { FavoritesPage } from './pages/FavoritesPage';
import { ProfilePage } from './pages/ProfilePage';
import { AdminPage } from './pages/AdminPage';
import { ChefProfilePage } from './pages/ChefProfilePage';
import { ProtectedRoute } from './auth/ProtectedRoute';
import '../i18n/config';

import { useAuth } from './auth/AuthProvider';
import { PanLoader } from './components/PanLoader';

// Wraps the routed pages so each navigation fades/slides in for a modern feel.
function AnimatedRoutes({ dailyCalories }: { dailyCalories: number }) {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      >
        <Routes location={location}>
          <Route path="/" element={<HomePage dailyCalories={dailyCalories} />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/chef/:id" element={<ChefProfilePage />} />
          <Route path="/admin" element={<ProtectedRoute><AdminPage /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
          <Route path="/recipes" element={<RecipesPage />} />
          <Route path="/pantry" element={<ProtectedRoute><PantryPage /></ProtectedRoute>} />
          <Route path="/shopping" element={<ProtectedRoute><ShoppingListPage /></ProtectedRoute>} />
          <Route path="/favorites" element={<ProtectedRoute><FavoritesPage /></ProtectedRoute>} />
        </Routes>
      </motion.div>
    </AnimatePresence>
  );
}

function App() {
  const { loading } = useAuth();
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
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#FFFDF5]">
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
        <div className="min-h-screen" style={{ backgroundColor: '#FFFDF5' }}>
          <Header />
          {/* NewsTicker removed per request */}

          <AnimatedRoutes dailyCalories={dailyCalories} />

          <Footer />

          {/* QR sync removed */}
          <Toaster position="top-right" richColors />
        </div>
      </DndProvider>
    </BrowserRouter>
  );
}

export default App;
