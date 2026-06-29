// src/app/components/RecipeDetailModal.tsx
// Updated: added DeliveryLinks section between instructions and reviews

import { X, Clock, ChefHat, PlayCircle, Pencil, User as UserIcon, Phone } from 'lucide-react';
import { Star } from 'lucide-react';
import { Recipe } from '../types/kitchen';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { ReviewSection } from './ReviewSection';
import { DeliveryLinks } from './DeliveryLinks'; // NEW
import { SubmitRecipeModal } from './SubmitRecipeModal';
import { formatCookTime } from '../lib/cookTime';
import { getRecipeReviews, averageRating } from '../api/reviewsApi';
import { recordView } from '../api/analyticsApi';
import { useAuth } from '../auth/AuthProvider';
import { getFollowStatus, followChef, unfollowChef, getChefStats } from '../api/chefApi';

interface RecipeDetailModalProps {
  recipe: Recipe | null;
  isOpen: boolean;
  onClose: () => void;
  onEdited?: () => void;
}

export function RecipeDetailModal({ recipe, isOpen, onClose, onEdited }: RecipeDetailModalProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [avgRating, setAvgRating] = useState(0);
  const [reviewCount, setReviewCount] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [chefRating, setChefRating] = useState(0);
  const [chefReviewCount, setChefReviewCount] = useState(0);

  const authorId = recipe?.user?.id ?? recipe?.userId;
  const isOwnRecipe = !!user && Number(user.id) === Number(authorId);
  const canEdit = !!user && (user.isAdmin || isOwnRecipe);

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

      // Chef's overall rating, shown next to their profile logo.
      setChefRating(0);
      setChefReviewCount(0);
      if (authorId) {
        getChefStats(authorId)
          .then((s) => { setChefRating(s.avgRating || 0); setChefReviewCount(s.reviewCount || 0); })
          .catch(() => {});
      }
    }
  }, [recipe]);

  const toggleFollow = async () => {
    if (!authorId) return;
    if (!user) { toast.error(t('chef.login_to_follow')); return; }
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

  if (!isOpen || !recipe) return null;

  return (
    <>
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
            width={896}
            height={320}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
          <div className="absolute bottom-6 left-6 right-6">
            <h2 className="text-white text-2xl sm:text-3xl mb-3">{recipe.title}</h2>
            <div className="flex flex-wrap gap-3 items-center">
              {recipe.cookTime && (
                <div className="flex items-center gap-2 bg-black/30 backdrop-blur-sm rounded-full px-4 py-2">
                  <Clock className="w-4 h-4 text-white" />
                  <span className="text-white text-sm">{formatCookTime(recipe.cookTime, t)}</span>
                </div>
              )}
              {recipe.category && (
                <div className="flex items-center gap-2 bg-black/30 backdrop-blur-sm rounded-full px-4 py-2">
                  <span className="text-white text-sm capitalize">{t(`categories.${recipe.category}`, recipe.category)}</span>
                </div>
              )}
              {reviewCount > 0 && (
                <div className="flex items-center gap-1.5 bg-black/30 backdrop-blur-sm rounded-full px-4 py-2">
                  <Star className="w-4 h-4" fill="var(--accent)" stroke="var(--accent)" />
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
          {authorId && (
            <div className="flex items-center flex-wrap gap-3 mb-6">
              <button onClick={goToChef} className="flex items-center gap-3 flex-1 min-w-0 text-left">
                {recipe.user?.avatarUrl ? (
                  <img src={recipe.user.avatarUrl} alt="" width={44} height={44} className="w-11 h-11 rounded-full object-cover ring-2 ring-white shadow" />
                ) : (
                  <div className="w-11 h-11 rounded-full flex items-center justify-center text-white text-sm font-bold ring-2 ring-white shadow" style={{ background: 'linear-gradient(135deg, var(--primary), #5A9FA3)' }}>
                    {(recipe.user?.name || recipe.user?.email || 'C').slice(0, 2).toUpperCase() || <UserIcon className="w-5 h-5" />}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: 'var(--foreground)' }}>
                    {recipe.user?.name || recipe.user?.email?.split('@')[0] || t('chef.anonymous')}
                  </p>
                  {chefReviewCount > 0 ? (
                    <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--muted-foreground)' }}>
                      <Star className="w-3.5 h-3.5" fill="var(--accent)" stroke="var(--accent)" />
                      <span className="font-medium" style={{ color: 'var(--foreground)' }}>{chefRating.toFixed(1)}</span>
                      <span>· {t('chef.view_profile')}</span>
                    </span>
                  ) : (
                    <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{t('chef.view_profile')}</p>
                  )}
                </div>
              </button>

              {/* Call-to-order: the site is not involved — the buyer phones the chef directly. */}
              {recipe.orderable && recipe.orderPhone && (
                <a
                  href={`tel:${recipe.orderPhone}`}
                  className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold bg-accent/15 text-foreground hover:bg-accent/25 transition-colors shrink-0"
                  style={{ color: 'var(--foreground)' }}
                  title={t('order.call_hint')}
                >
                  <Phone className="w-4 h-4" style={{ color: 'var(--primary)' }} />
                  <span>{t('order.order')}</span>
                  <span className="font-normal" style={{ color: 'var(--muted-foreground)' }}>{recipe.orderPhone}</span>
                </a>
              )}

              <div className="flex items-center gap-2 shrink-0">
                {canEdit && (
                  <button
                    onClick={() => setEditing(true)}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold bg-secondary/10 text-secondary hover:bg-secondary/20 transition-colors"
                  >
                    <Pencil className="w-4 h-4" /> {t('recipes.edit')}
                  </button>
                )}
                {!isOwnRecipe && (
                  <button
                    onClick={toggleFollow}
                    disabled={followBusy}
                    className={`px-5 py-2 rounded-full text-sm font-semibold transition-colors disabled:opacity-60 ${
                      isFollowing ? 'bg-gray-100 text-gray-700 hover:bg-gray-200' : 'bg-primary text-white hover:bg-primary/90'
                    }`}
                  >
                    {isFollowing ? t('chef.following') : t('chef.follow')}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Watch video — uploaded clips play inline; external links open in a new tab */}
          {recipe.youtubeUrl && (
            recipe.youtubeUrl.startsWith('data:') ? (
              <div className="mb-8 rounded-[24px] overflow-hidden bg-black border" style={{ borderColor: 'rgba(74,124,126,0.12)' }}>
                <video src={recipe.youtubeUrl} controls className="w-full max-h-[28rem]" />
              </div>
            ) : (
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
                  <span className="font-medium">{t('recipes.watch_video')}</span>
                </a>
              </div>
            )
          )}

          {/* Ingredients */}
          <div className="mb-8">
            <h3
              className="flex items-center gap-2 text-xl mb-4"
              style={{ color: 'var(--foreground)' }}
            >
              <ChefHat className="w-5 h-5" style={{ color: 'var(--primary)' }} />
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
                    style={{ background: 'var(--primary)' }}
                  />
                  <span style={{ color: 'var(--foreground)' }}>{ingredient}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Instructions */}
          <div className="mb-8">
            <h3 className="text-xl mb-4" style={{ color: 'var(--foreground)' }}>
              {t('recipes.instructions')}
            </h3>
            <div className="space-y-4">
              {(recipe.instructions || []).map((instruction, index) => (
                <div key={index} className="flex gap-4">
                  <div
                    className="flex-shrink-0 w-8 h-8 rounded-full text-white flex items-center justify-center text-sm font-medium"
                    style={{ background: 'linear-gradient(135deg, var(--primary), #5A9FA3)' }}
                  >
                    {index + 1}
                  </div>
                  <p className="flex-1 pt-1" style={{ color: 'var(--foreground)' }}>{instruction}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ── Delivery deep links ── NEW */}
          <DeliveryLinks recipeName={recipe.title} />

          {/* Reviews */}
          <div className="border-t mt-8 pt-8" style={{ borderColor: 'rgba(74,124,126,0.1)' }}>
            <ReviewSection recipeId={recipe.id} recipeAuthorId={authorId == null ? undefined : Number(authorId)} />
          </div>
        </div>
      </div>
    </div>

    {editing && (
      <SubmitRecipeModal
        isOpen={editing}
        editRecipe={recipe}
        onClose={() => setEditing(false)}
        onSuccess={() => { setEditing(false); onEdited?.(); onClose(); }}
      />
    )}
    </>
  );
}
