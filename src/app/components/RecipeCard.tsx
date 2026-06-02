// src/app/components/RecipeCard.tsx
// Clickable chef name links to /chef/:userId. Free recipes open directly;
// paid recipes show a price and an unlock button.

import { motion } from 'motion/react';
import { Clock, Plus, Heart, ChefHat, Lock } from 'lucide-react';
import { Recipe } from '../types/kitchen';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '../auth/AuthProvider';
import { buyRecipe, formatSom } from '../api/earningsApi';

interface RecipeCardProps {
  recipe: Recipe;
  isFavorite?: boolean;
  onAddToShoppingList: (recipe: Recipe) => void;
  onViewRecipe: (recipe: Recipe) => void;
  onToggleFavorite?: (recipe: Recipe) => void;
  onUnlocked?: (recipe: Recipe) => void;
}

export function RecipeCard({ recipe, isFavorite, onAddToShoppingList, onViewRecipe, onToggleFavorite, onUnlocked }: RecipeCardProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [buying, setBuying] = useState(false);
  const isLocked = !!recipe.locked;

  const handleUnlock = async () => {
    if (!user) { toast.error('Please sign in to unlock this recipe'); navigate('/login'); return; }
    if (!confirm(`Unlock "${recipe.title}" for ${formatSom(recipe.price || 0)}?`)) return;
    setBuying(true);
    try {
      const { recipe: unlocked } = await buyRecipe(recipe.id);
      toast.success('Recipe unlocked! Enjoy cooking.');
      onUnlocked?.(unlocked);
      onViewRecipe(unlocked);
    } catch (e: any) {
      toast.error(e.message || 'Failed to unlock recipe');
    } finally {
      setBuying(false);
    }
  };

  const handleClick = () => {
    if (isLocked) handleUnlock();
    else onViewRecipe(recipe);
  };

  const handleAddToShopping = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isLocked) handleUnlock();
    else onAddToShoppingList(recipe);
  };

  const handleChefClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (recipe.userId) navigate(`/chef/${recipe.userId}`);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -6 }}
      transition={{ type: 'spring', stiffness: 300, damping: 24 }}
      className="group cursor-pointer relative h-full w-full"
      onClick={handleClick}
    >
      <div className="h-full flex flex-col rounded-3xl overflow-hidden bg-white border border-gray-100 shadow-sm hover:shadow-xl hover:border-primary/20 transition-all duration-300 relative">

        {/* Price badge */}
        {(recipe.price ?? 0) > 0 && (
          <div className="absolute top-3 left-3 z-20 flex items-center gap-1.5 bg-white/95 text-primary text-xs font-bold px-2.5 py-1 rounded-full shadow border border-primary/10">
            {isLocked && <Lock className="w-3 h-3" />}
            {formatSom(recipe.price || 0)}
          </div>
        )}

        <div className="relative aspect-video w-full overflow-hidden bg-gray-100">
          <ImageWithFallback
            src={recipe.image}
            alt={recipe.title}
            className={`w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ${isLocked ? 'grayscale-[0.4]' : ''}`}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-white/90 via-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-60 group-hover:opacity-0 transition-opacity duration-300" />

          {isLocked && (
            <div className="absolute inset-0 bg-black/20 flex items-center justify-center backdrop-blur-[1px]">
              <div className="bg-black/60 p-3 rounded-full text-white shadow-xl border border-white/10">
                <Lock className="w-6 h-6" />
              </div>
            </div>
          )}

          {onToggleFavorite && (
            <motion.button
              onClick={(e) => { e.stopPropagation(); onToggleFavorite(recipe); }}
              whileTap={{ scale: 0.8 }}
              className="absolute top-3 right-3 p-2.5 rounded-full bg-white/90 shadow-sm backdrop-blur-sm hover:bg-white transition-all z-10 group/btn"
              title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
              aria-pressed={isFavorite}
            >
              <motion.span
                key={isFavorite ? 'liked' : 'unliked'}
                initial={{ scale: 0.4 }}
                animate={{ scale: [0.4, 1.35, 1] }}
                transition={{ duration: 0.35, ease: 'easeOut' }}
                className="block"
              >
                <Heart className={`w-5 h-5 transition-colors ${isFavorite ? 'fill-red-500 text-red-500' : 'text-gray-400 group-hover/btn:text-red-500'}`} />
              </motion.span>
            </motion.button>
          )}

          <div className="absolute bottom-3 left-3 flex gap-2 group-hover:translate-y-1 transition-transform duration-300">
            {recipe.cookTime && (
              <div className="flex items-center gap-1.5 bg-white/90 backdrop-blur-md rounded-full px-3 py-1 text-gray-700 text-xs font-medium border border-white/20 shadow-sm">
                <Clock className="w-3.5 h-3.5 text-primary" />
                <span>{recipe.cookTime}</span>
              </div>
            )}
          </div>
        </div>

        <div className="p-5 flex-1 flex flex-col">
          <div className="flex items-start justify-between gap-4 mb-2">
            <h3 className="text-lg font-bold text-gray-900 leading-tight group-hover:text-primary transition-colors line-clamp-2 capitalize">
              {recipe.title}
            </h3>
          </div>

          {/* ── Clickable chef name ── */}
          {recipe.user && (
            <button
              onClick={handleChefClick}
              className="flex items-center gap-1.5 mb-3 w-fit"
              style={{ color: '#7A8B99' }}
              onMouseEnter={e => (e.currentTarget.style.color = '#4A7C7E')}
              onMouseLeave={e => (e.currentTarget.style.color = '#7A8B99')}
            >
              <ChefHat className="w-3.5 h-3.5" />
              <span className="text-xs font-medium">
                {recipe.user.name || recipe.user.email?.split('@')[0] || 'Chef'}
              </span>
            </button>
          )}

          <div className="mb-6">
            {recipe.category && (
              <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-orange-50 text-orange-700 text-xs font-semibold uppercase tracking-wide border border-orange-100">
                {recipe.category}
              </span>
            )}
          </div>

          <div className="mt-auto pt-4 border-t border-gray-50 flex items-center gap-2">
            <button
              onClick={handleAddToShopping}
              disabled={buying}
              className={`w-full flex items-center justify-center gap-2 bg-gradient-to-r ${isLocked ? 'from-secondary to-secondary/80' : 'from-primary to-primary/80'} text-white rounded-xl px-4 py-3 hover:shadow-lg transition-all duration-300 group/add disabled:opacity-60`}
            >
              {isLocked ? <Lock className="w-4 h-4" /> : <Plus className="w-4 h-4 group-hover/add:rotate-90 transition-transform" />}
              <span className="font-medium text-sm">
                {isLocked ? (buying ? 'Unlocking…' : `Unlock for ${formatSom(recipe.price || 0)}`) : 'Add Ingredients'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
