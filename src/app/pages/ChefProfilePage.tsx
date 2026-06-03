// src/app/pages/ChefProfilePage.tsx
// New file — drop into src/app/pages/

import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChefHat, Users, BookOpen, Star, UserPlus, UserCheck, ArrowLeft, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/AuthProvider';
import { RecipeDetailModal } from '../components/RecipeDetailModal';
import { ImageWithFallback } from '../components/figma/ImageWithFallback';
import {
  ChefProfile,
  ChefRecipe,
  getChefProfile,
  getFollowStatus,
  followChef,
  unfollowChef,
} from '../api/chefApi';
import { Recipe } from '../types/kitchen';

// ─── Stat card ────────────────────────────────────────────────────────────────
function StatCard({ icon, value, label }: { icon: React.ReactNode; value: number | string; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1 px-6 py-4 rounded-[20px] bg-white"
      style={{ border: '1px solid rgba(74,124,126,0.12)' }}>
      <div style={{ color: '#4A7C7E' }}>{icon}</div>
      <div className="text-2xl font-bold" style={{ color: '#2C3E50' }}>{value}</div>
      <div className="text-xs" style={{ color: '#7A8B99' }}>{label}</div>
    </div>
  );
}

// ─── Mini recipe card ─────────────────────────────────────────────────────────
function MiniRecipeCard({
  recipe,
  onClick,
}: {
  recipe: ChefRecipe;
  onClick: () => void;
}) {
  const stars = recipe.avgRating ? Math.round(recipe.avgRating) : 0;

  return (
    <div
      onClick={onClick}
      className="group cursor-pointer rounded-[20px] overflow-hidden bg-white shadow-sm hover:shadow-md transition-all duration-300"
      style={{ border: '1px solid rgba(74,124,126,0.1)' }}
    >
      <div className="relative aspect-video overflow-hidden bg-gray-100">
        <ImageWithFallback
          src={recipe.image}
          alt={recipe.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
      </div>
      <div className="p-4">
        <h4 className="font-semibold text-sm leading-tight mb-1 group-hover:text-[#4A7C7E] transition-colors line-clamp-2"
          style={{ color: '#2C3E50' }}>
          {recipe.title}
        </h4>
        <div className="flex items-center justify-between mt-2">
          <span className="text-xs px-2 py-0.5 rounded-md font-medium capitalize"
            style={{ background: 'rgba(74,124,126,0.08)', color: '#4A7C7E' }}>
            {recipe.category}
          </span>
          {recipe.reviewCount > 0 && (
            <div className="flex items-center gap-1">
              <Star className="w-3 h-3" fill="#E6B566" stroke="#E6B566" />
              <span className="text-xs" style={{ color: '#7A8B99' }}>
                {recipe.avgRating?.toFixed(1)} ({recipe.reviewCount})
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────
export function ChefProfilePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useTranslation();

  const [chef, setChef] = useState<ChefProfile | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [followLoading, setFollowLoading] = useState(false);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);

  const isOwnProfile = user && chef && Number(user.id) === chef.id;

  useEffect(() => {
    if (!id) return;
    loadChef();
  }, [id]);

  async function loadChef() {
    setLoading(true);
    try {
      const profile = await getChefProfile(id!);
      setChef(profile);
      setFollowerCount(profile.followerCount);
      if (user && Number(user.id) !== profile.id) {
        const status = await getFollowStatus(id!);
        setIsFollowing(status);
      }
    } catch (e) {
      toast.error('Chef not found');
      navigate('/recipes');
    } finally {
      setLoading(false);
    }
  }

  async function handleFollow() {
    if (!user) { toast.error(t('chef.login_to_follow')); return; }
    setFollowLoading(true);
    try {
      if (isFollowing) {
        const count = await unfollowChef(id!);
        setIsFollowing(false);
        setFollowerCount(count);
        toast.success(t('chef.unfollowed'));
      } else {
        const count = await followChef(id!);
        setIsFollowing(true);
        setFollowerCount(count);
        toast.success(t('chef.followed'));
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setFollowLoading(false);
    }
  }

  // Convert ChefRecipe to Recipe type for modal
  function toRecipe(r: ChefRecipe): Recipe {
    return {
      id: r.id,
      title: r.title,
      image: r.image,
      cookTime: r.cookTime,
      servings: r.servings,
      category: r.category,
      ingredients: r.ingredients,
      instructions: r.instructions,
      youtubeUrl: r.youtubeUrl || undefined,
      isPro: r.isPro,
    };
  }

  const initials = chef?.name
    ? chef.name.slice(0, 2).toUpperCase()
    : chef?.email.slice(0, 2).toUpperCase() || '??';

  const joinDate = chef?.createdAt
    ? new Date(chef.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long' })
    : '';

  // ── Loading skeleton ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen py-12 px-4" style={{ background: '#FFFDF5' }}>
        <div className="max-w-4xl mx-auto space-y-6 animate-pulse">
          <div className="h-10 w-24 rounded-full" style={{ background: '#F5E6D3' }} />
          <div className="rounded-[28px] p-8" style={{ background: '#F5E6D3', height: 200 }} />
          <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3].map(i => <div key={i} className="rounded-[20px] h-24" style={{ background: '#F5E6D3' }} />)}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="rounded-[20px] h-48" style={{ background: '#F5E6D3' }} />)}
          </div>
        </div>
      </div>
    );
  }

  if (!chef) return null;

  return (
    <div className="min-h-screen py-8 px-4" style={{ background: '#FFFDF5' }}>
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Back button */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-sm transition-colors"
          style={{ color: '#7A8B99' }}
          onMouseEnter={e => (e.currentTarget.style.color = '#4A7C7E')}
          onMouseLeave={e => (e.currentTarget.style.color = '#7A8B99')}
        >
          <ArrowLeft className="w-4 h-4" />
          {t('common.back')}
        </button>

        {/* Profile header */}
        <div
          className="rounded-[28px] p-6 sm:p-8 animate-fade-up"
          style={{
            background: 'linear-gradient(135deg, rgba(74,124,126,0.08), rgba(230,181,102,0.08))',
            border: '1px solid rgba(74,124,126,0.15)'
          }}
        >
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
            {/* Avatar */}
            <div className="relative flex-shrink-0">
              {chef.avatarUrl ? (
                <img
                  src={chef.avatarUrl}
                  alt={chef.name || 'Chef'}
                  className="w-24 h-24 rounded-full object-cover ring-4 ring-white shadow-lg"
                />
              ) : (
                <div
                  className="w-24 h-24 rounded-full flex items-center justify-center text-white text-2xl font-bold ring-4 ring-white shadow-lg"
                  style={{ background: 'linear-gradient(135deg, #4A7C7E, #5A9FA3)' }}
                >
                  {initials}
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 text-center sm:text-left">
              <h1 className="text-2xl font-bold mb-1" style={{ color: '#2C3E50' }}>
                {chef.name || t('chef.anonymous')}
              </h1>
              <div className="flex items-center justify-center sm:justify-start gap-1.5 mb-3"
                style={{ color: '#7A8B99' }}>
                <Calendar className="w-3.5 h-3.5" />
                <span className="text-sm">{t('chef.joined')} {joinDate}</span>
              </div>
              {chef.bio ? (
                <p className="text-sm leading-relaxed max-w-md" style={{ color: '#2C3E50' }}>
                  {chef.bio}
                </p>
              ) : (
                isOwnProfile && (
                  <p className="text-sm italic" style={{ color: '#7A8B99' }}>
                    {t('chef.no_bio')}
                  </p>
                )
              )}
            </div>

            {/* Follow / Edit button */}
            <div className="flex-shrink-0">
              {isOwnProfile ? (
                <button
                  onClick={() => navigate('/profile')}
                  className="px-5 py-2.5 rounded-full text-sm font-medium transition-colors"
                  style={{ border: '1.5px solid #4A7C7E', color: '#4A7C7E' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(74,124,126,0.08)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  {t('chef.edit_profile')}
                </button>
              ) : (
                <button
                  onClick={handleFollow}
                  disabled={followLoading}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium text-white transition-colors disabled:opacity-60"
                  style={{ background: isFollowing ? '#5A9FA3' : '#4A7C7E' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#3d696b')}
                  onMouseLeave={e => (e.currentTarget.style.background = isFollowing ? '#5A9FA3' : '#4A7C7E')}
                >
                  {isFollowing ? (
                    <><UserCheck className="w-4 h-4" />{t('chef.following')}</>
                  ) : (
                    <><UserPlus className="w-4 h-4" />{t('chef.follow')}</>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3 animate-fade-up stagger-2">
          <StatCard
            icon={<BookOpen className="w-5 h-5" />}
            value={chef.recipeCount}
            label={t('chef.recipes')}
          />
          <StatCard
            icon={<Users className="w-5 h-5" />}
            value={followerCount}
            label={t('chef.followers')}
          />
          <StatCard
            icon={<ChefHat className="w-5 h-5" />}
            value={chef.followingCount}
            label={t('chef.following_count')}
          />
        </div>

        {/* Recipes grid */}
        <div className="animate-fade-up stagger-3">
          <h2 className="text-xl font-semibold mb-4" style={{ color: '#2C3E50' }}>
            {t('chef.recipes_by', { name: chef.name || t('chef.this_chef') })}
          </h2>

          {chef.recipes.length === 0 ? (
            <div className="text-center py-16" style={{ color: '#7A8B99' }}>
              <ChefHat className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">{t('chef.no_recipes_yet')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {chef.recipes.map(recipe => (
                <MiniRecipeCard
                  key={recipe.id}
                  recipe={recipe}
                  onClick={() => setSelectedRecipe(toRecipe(recipe))}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recipe detail modal */}
      <RecipeDetailModal
        recipe={selectedRecipe}
        isOpen={!!selectedRecipe}
        onClose={() => setSelectedRecipe(null)}
      />
    </div>
  );
}
