// src/app/components/RecipeDetailModal.tsx
// Updated: added DeliveryLinks section between instructions and reviews

import { X, Clock, ChefHat, PlayCircle, Heart, User as UserIcon } from 'lucide-react';
import { Star } from 'lucide-react';
import { Recipe } from '../types/kitchen';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { ReviewSection } from './ReviewSection';
import { DeliveryLinks } from './DeliveryLinks'; // NEW
import { getRecipeReviews, averageRating } from '../api/reviewsApi';
import { recordView } from '../api/analyticsApi';
import { useAuth } from '../auth/AuthProvider';
import { tipRecipe, formatSom } from '../api/earningsApi';
import { getFollowStatus, followChef, unfollowChef } from '../api/chefApi';

const TIP_PRESETS = [5000, 10000, 25000];

interface RecipeDetailModalProps {
  recipe: Recipe | null;
  isOpen: boolean;
  onClose: () => void;
}

export function RecipeDetailModal({ recipe, isOpen, onClose }: RecipeDetailModalProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [avgRating, setAvgRating] = useState(0);
  const [reviewCount, setReviewCount] = useState(0);
  const [tipping, setTipping] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);

  const authorId = recipe?.user?.id ?? recipe?.userId;
  const isOwnRecipe = !!user && Number(user.id) === Number(authorId);

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

      // Follow status for the publisher
      setIsFollowing(false);
      if (user && authorId && !isOwnRecipe) {
        getFollowStatus(authorId).then(setIsFollowing).catch(() => {});
      }
    }
  }, [recipe]);

  const toggleFollow = async () => {
    if (!authorId) return;
    if (!user) { toast.error(t('earnings.sign_in_tip')); return; }
    const cur = isFollowing;
    setIsFollowing(!cur);
    setFollowBusy(true);
    try {
      if (cur) await unfollowChef(authorId);
      else await followChef(authorId);
    } catch {
      setIsFollowing(cur);
    } finally {
      setFollowBusy(false);
    }
  };

  const goToChef = () => { if (authorId) { onClose(); navigate(`/chef/${authorId}`); } };

  const sendTip = async (amount: number) => {
    if (!recipe) return;
    if (!user) { toast.error(t('earnings.sign_in_tip')); return; }
    setTipping(true);
    try {
      await tipRecipe(recipe.id, amount);
      toast.success(t('earnings.tip_sent', { amount: formatSom(amount) }));
    } catch (e: any) {
      toast.error(e.message || t('earnings.tip_failed'));
    } finally {
      setTipping(false);
    }
  };

  if (!isOpen || !recipe) return null;

  // Show the tip control to logged-in users who aren't the recipe's author.
  const canTip = !!user && Number(user.id) !== Number(recipe.userId);

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
                  <span className="text-white text-sm capitalize">{t(`categories.${recipe.category}`, recipe.category)}</span>
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

          {/* Publisher (Instagram-style author row) */}
          {recipe.user && authorId && (
            <div className="flex items-center gap-3 mb-6">
              <button onClick={goToChef} className="flex items-center gap-3 flex-1 min-w-0 text-left">
                {recipe.user.avatarUrl ? (
                  <img src={recipe.user.avatarUrl} alt="" className="w-11 h-11 rounded-full object-cover ring-2 ring-white shadow" />
                ) : (
                  <div className="w-11 h-11 rounded-full flex items-center justify-center text-white text-sm font-bold ring-2 ring-white shadow" style={{ background: 'linear-gradient(135deg, #4A7C7E, #5A9FA3)' }}>
                    {(recipe.user.name || recipe.user.email || 'C').slice(0, 2).toUpperCase() || <UserIcon className="w-5 h-5" />}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: '#2C3E50' }}>
                    {recipe.user.name || recipe.user.email?.split('@')[0] || t('chef.anonymous')}
                  </p>
                  <p className="text-xs" style={{ color: '#7A8B99' }}>{t('chef.view_profile')}</p>
                </div>
              </button>
              {!isOwnRecipe && (
                <button
                  onClick={toggleFollow}
                  disabled={followBusy}
                  className={`shrink-0 px-5 py-2 rounded-full text-sm font-semibold transition-colors disabled:opacity-60 ${
                    isFollowing ? 'bg-gray-100 text-gray-700 hover:bg-gray-200' : 'bg-primary text-white hover:bg-primary/90'
                  }`}
                >
                  {isFollowing ? t('chef.following') : t('chef.follow')}
                </button>
              )}
            </div>
          )}

          {/* Tip the chef */}
          {canTip && (
            <div
              className="mb-8 p-5 rounded-[24px]"
              style={{
                background: 'linear-gradient(135deg, rgba(209,122,82,0.06), rgba(230,181,102,0.10))',
                border: '1px solid rgba(209,122,82,0.18)',
              }}
            >
              <div className="flex items-center gap-2 mb-3">
                <Heart className="w-4 h-4" style={{ color: '#D17A52' }} />
                <p className="text-sm font-semibold" style={{ color: '#2C3E50' }}>
                  {t('earnings.tip_prompt')}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {TIP_PRESETS.map((amt) => (
                  <button
                    key={amt}
                    onClick={() => sendTip(amt)}
                    disabled={tipping}
                    className="px-4 py-2 rounded-full text-sm font-medium text-white shadow-sm transition-all hover:shadow-md active:scale-95 disabled:opacity-60"
                    style={{ background: 'linear-gradient(135deg, #D17A52, #E6B566)' }}
                  >
                    {formatSom(amt)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Watch video */}
          {recipe.youtubeUrl && (
            <div
              className="mb-8 p-6 rounded-[24px] flex flex-wrap items-center justify-between gap-6"
              style={{
                background: 'linear-gradient(135deg, rgba(74,124,126,0.05), rgba(230,181,102,0.06))',
                border: '1px solid rgba(74,124,126,0.12)',
              }}
            >
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
            </div>
          )}

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
