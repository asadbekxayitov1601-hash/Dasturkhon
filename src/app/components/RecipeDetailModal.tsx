// src/app/components/RecipeDetailModal.tsx
// Updated: added DeliveryLinks section between instructions and reviews

import { X, Clock, ChefHat, PlayCircle, ThumbsUp, ThumbsDown } from 'lucide-react';
import { Star } from 'lucide-react';
import { Recipe } from '../types/kitchen';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ReviewSection } from './ReviewSection';
import { DeliveryLinks } from './DeliveryLinks'; // NEW
import { getRecipeReviews, averageRating } from '../api/reviewsApi';
import { recordView } from '../api/analyticsApi';
import { getLikes, voteRecipe, LikesData } from '../api/likesApi';
import { useAuth } from '../auth/AuthProvider';

interface RecipeDetailModalProps {
  recipe: Recipe | null;
  isOpen: boolean;
  onClose: () => void;
}

// Predict the new like/dislike state when the user clicks a vote, matching the
// server's toggle behaviour (clicking the same vote removes it; clicking the
// other switches). Used for instant, optimistic UI feedback.
function computeOptimisticVote(current: LikesData, type: 'like' | 'dislike'): LikesData {
  let { likes, dislikes, userVote } = current;
  if (userVote === 'like') likes -= 1;
  if (userVote === 'dislike') dislikes -= 1;
  const nextVote = userVote === type ? null : type;
  if (nextVote === 'like') likes += 1;
  if (nextVote === 'dislike') dislikes += 1;
  return { likes, dislikes, userVote: nextVote };
}

export function RecipeDetailModal({ recipe, isOpen, onClose }: RecipeDetailModalProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [avgRating, setAvgRating] = useState(0);
  const [reviewCount, setReviewCount] = useState(0);
  const [likesData, setLikesData] = useState<LikesData>({ likes: 0, dislikes: 0, userVote: null });
  const [voteLoading, setVoteLoading] = useState(false);

  useEffect(() => {
    if (recipe) {
      // Record view — fire-and-forget, never blocks UI
      recordView(recipe.id);

      getRecipeReviews(recipe.id)
        .then((reviews) => {
          setAvgRating(averageRating(reviews));
          setReviewCount(reviews.length);
        })
        .catch(() => {});

      getLikes(recipe.id)
        .then(setLikesData)
        .catch(() => {});
    }
  }, [recipe]);

  const handleVote = async (type: 'like' | 'dislike') => {
    if (!user || !recipe || voteLoading) return;

    // Optimistic update: reflect the vote instantly, then reconcile with the
    // server response (and revert if it fails).
    const prev = likesData;
    setLikesData(computeOptimisticVote(prev, type));
    setVoteLoading(true);
    try {
      const updated = await voteRecipe(recipe.id, type);
      setLikesData(updated);
    } catch (_) {
      setLikesData(prev);
    } finally {
      setVoteLoading(false);
    }
  };

  if (!isOpen || !recipe) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-[32px] max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center hover:bg-white transition-colors z-10 shadow-sm"
        >
          <X className="w-5 h-5 text-gray-900" />
        </button>

        {/* Header Image */}
        <div className="relative h-64 sm:h-80 rounded-t-[32px] overflow-hidden">
          <ImageWithFallback
            src={recipe.image}
            alt={recipe.title}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
          <div className="absolute bottom-6 left-6 right-6">
            <h2 className="text-white text-2xl sm:text-3xl mb-3">{recipe.title}</h2>
            <div className="flex flex-wrap gap-3 items-center">
              {recipe.cookTime && (
                <div className="flex items-center gap-2 bg-black/30 backdrop-blur-sm rounded-full px-4 py-2">
                  <Clock className="w-4 h-4 text-white" />
                  <span className="text-white text-sm">{recipe.cookTime}</span>
                </div>
              )}
              {recipe.category && (
                <div className="flex items-center gap-2 bg-black/30 backdrop-blur-sm rounded-full px-4 py-2">
                  <span className="text-white text-sm capitalize">{recipe.category}</span>
                </div>
              )}
              {reviewCount > 0 && (
                <div className="flex items-center gap-1.5 bg-black/30 backdrop-blur-sm rounded-full px-4 py-2">
                  <Star className="w-4 h-4" fill="#E6B566" stroke="#E6B566" />
                  <span className="text-white text-sm">
                    {avgRating.toFixed(1)} ({reviewCount})
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 sm:p-8">

          {/* Like / Dislike + YouTube */}
          <div
            className="mb-8 p-6 rounded-[24px] flex flex-wrap items-center justify-between gap-6"
            style={{
              background: 'linear-gradient(135deg, rgba(74,124,126,0.05), rgba(230,181,102,0.06))',
              border: '1px solid rgba(74,124,126,0.12)',
            }}
          >
            {/* Like / Dislike */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => handleVote('like')}
                disabled={!user || voteLoading}
                title={user ? 'Like' : 'Log in to vote'}
                className={`flex items-center gap-2 px-4 py-2 rounded-full border-2 transition-all font-medium text-sm active:scale-95 ${
                  likesData.userVote === 'like'
                    ? 'bg-[#4A7C7E] border-[#4A7C7E] text-white shadow-md scale-105'
                    : 'bg-white border-[rgba(74,124,126,0.2)] text-[#4A7C7E] hover:border-[#4A7C7E]'
                } disabled:opacity-40 disabled:cursor-not-allowed`}
              >
                <ThumbsUp className={`w-4 h-4 transition-transform ${likesData.userVote === 'like' ? 'fill-current' : ''}`} />
                <span>{likesData.likes}</span>
              </button>
              <button
                onClick={() => handleVote('dislike')}
                disabled={!user || voteLoading}
                title={user ? 'Dislike' : 'Log in to vote'}
                className={`flex items-center gap-2 px-4 py-2 rounded-full border-2 transition-all font-medium text-sm active:scale-95 ${
                  likesData.userVote === 'dislike'
                    ? 'bg-red-500 border-red-500 text-white shadow-md scale-105'
                    : 'bg-white border-red-200 text-red-400 hover:border-red-400'
                } disabled:opacity-40 disabled:cursor-not-allowed`}
              >
                <ThumbsDown className={`w-4 h-4 transition-transform ${likesData.userVote === 'dislike' ? 'fill-current' : ''}`} />
                <span>{likesData.dislikes}</span>
              </button>
            </div>

            {recipe.youtubeUrl && (
              <a
                href={recipe.youtubeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-6 py-3 bg-[#FF0000] text-white rounded-full hover:bg-[#CC0000] transition-colors shadow-lg"
                style={{ boxShadow: '0 4px 12px rgba(255,0,0,0.2)' }}
              >
                <PlayCircle className="w-5 h-5" />
                <span className="font-medium">Watch Video</span>
              </a>
            )}
          </div>

          {/* Ingredients */}
          <div className="mb-8">
            <h3
              className="flex items-center gap-2 text-xl mb-4"
              style={{ color: '#2C3E50' }}
            >
              <ChefHat className="w-5 h-5" style={{ color: '#4A7C7E' }} />
              {t('recipes.key_ingredients')}
            </h3>
            <div className="grid sm:grid-cols-2 gap-3">
              {(recipe.ingredients || []).map((ingredient, index) => (
                <div
                  key={index}
                  className="flex items-center gap-3 p-4 rounded-[20px] bg-white"
                  style={{ border: '1px solid rgba(74,124,126,0.1)' }}
                >
                  <div
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ background: '#4A7C7E' }}
                  />
                  <span style={{ color: '#2C3E50' }}>{ingredient}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Instructions */}
          <div className="mb-8">
            <h3 className="text-xl mb-4" style={{ color: '#2C3E50' }}>
              {t('recipes.instructions')}
            </h3>
            <div className="space-y-4">
              {(recipe.instructions || []).map((instruction, index) => (
                <div key={index} className="flex gap-4">
                  <div
                    className="flex-shrink-0 w-8 h-8 rounded-full text-white flex items-center justify-center text-sm font-medium"
                    style={{ background: 'linear-gradient(135deg, #4A7C7E, #5A9FA3)' }}
                  >
                    {index + 1}
                  </div>
                  <p className="flex-1 pt-1" style={{ color: '#2C3E50' }}>{instruction}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ── Delivery deep links ── NEW */}
          <DeliveryLinks recipeName={recipe.title} />

          {/* Reviews */}
          <div className="border-t mt-8 pt-8" style={{ borderColor: 'rgba(74,124,126,0.1)' }}>
            <ReviewSection recipeId={recipe.id} />
          </div>
        </div>
      </div>
    </div>
  );
}
