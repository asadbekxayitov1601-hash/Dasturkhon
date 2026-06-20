// src/app/pages/ChefProfilePage.tsx
// New file — drop into src/app/pages/

import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChefHat, Users, BookOpen, Star, UserPlus, UserCheck, ArrowLeft, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { motion } from 'motion/react';
import { useAuth } from '../auth/AuthProvider';
import { RecipeDetailModal } from '../components/RecipeDetailModal';
import { FollowListModal } from '../components/FollowListModal';
import { SocialLinksDisplay } from '../components/SocialLinks';
import { ImageWithFallback } from '../components/figma/ImageWithFallback';
import {
  ChefProfile,
  ChefRecipe,
  UserLite,
  getChefProfile,
  getFollowStatus,
  followChef,
  unfollowChef,
  getFollowers,
  getFollowing,
} from '../api/chefApi';
import { Recipe } from '../types/kitchen';

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } }
};

// ─── Stat card ────────────────────────────────────────────────────────────────
function StatCard({ icon, value, label, onClick }: { icon: React.ReactNode; value: number | string; label: string; onClick?: () => void }) {
  return (
    <motion.div
      variants={itemVariants}
      onClick={onClick}
      className={`flex flex-col items-center gap-1 px-6 py-4 rounded-[20px] bg-card ${onClick ? 'cursor-pointer hover:shadow-md active:scale-95 transition-all' : ''}`}
      style={{ border: '1px solid rgba(74,124,126,0.12)' }}
    >
      <div style={{ color: 'var(--primary)' }}>{icon}</div>
      <div className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>{value}</div>
      <div className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{label}</div>
    </motion.div>
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
  const { t } = useTranslation();
  const stars = recipe.avgRating ? Math.round(recipe.avgRating) : 0;

  return (
    <motion.div
      onClick={onClick}
      variants={itemVariants}
      className="group cursor-pointer rounded-[20px] overflow-hidden bg-card shadow-sm hover:shadow-md transition-all duration-300"
      style={{ border: '1px solid rgba(74,124,126,0.1)' }}
    >
      <div className="relative aspect-video overflow-hidden bg-muted">
        <ImageWithFallback
          src={recipe.image}
          alt={recipe.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
      </div>
      <div className="p-4">
        <h4 className="font-semibold text-sm leading-tight mb-1 group-hover:text-[var(--primary)] transition-colors line-clamp-2"
          style={{ color: 'var(--foreground)' }}>
          {recipe.title}
        </h4>
        <div className="flex items-center justify-between mt-2">
          <span className="text-xs px-2 py-0.5 rounded-md font-medium capitalize"
            style={{ background: 'rgba(74,124,126,0.08)', color: 'var(--primary)' }}>
            {t(`categories.${recipe.category}`, recipe.category)}
          </span>
          {recipe.reviewCount > 0 && (
            <div className="flex items-center gap-1">
              <Star className="w-3 h-3" fill="var(--accent)" stroke="var(--accent)" />
              <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                {recipe.avgRating?.toFixed(1)} ({recipe.reviewCount})
              </span>
            </div>
          )}
        </div>
      </div>
    </motion.div>
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

  // Followers / following list modal
  const [listOpen, setListOpen] = useState(false);
  const [listType, setListType] = useState<'followers' | 'following'>('followers');
  const [listUsers, setListUsers] = useState<UserLite[]>([]);
  const [listLoading, setListLoading] = useState(false);

  const isOwnProfile = user && chef && Number(user.id) === chef.id;

  const openList = async (type: 'followers' | 'following') => {
    if (!chef) return;
    setListType(type);
    setListUsers([]);
    setListLoading(true);
    setListOpen(true);
    try {
      const users = type === 'followers' ? await getFollowers(chef.id) : await getFollowing(chef.id);
      setListUsers(users);
    } catch {
      /* ignore */
    } finally {
      setListLoading(false);
    }
  };

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
      <div className="min-h-screen py-12 px-4" style={{ background: 'var(--background)' }}>
        <div className="max-w-4xl mx-auto space-y-6 animate-pulse">
          <div className="h-10 w-24 rounded-full" style={{ background: 'var(--muted)' }} />
          <div className="rounded-[28px] p-8" style={{ background: 'var(--muted)', height: 200 }} />
          <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3].map(i => <div key={i} className="rounded-[20px] h-24" style={{ background: 'var(--muted)' }} />)}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="rounded-[20px] h-48" style={{ background: 'var(--muted)' }} />)}
          </div>
        </div>
      </div>
    );
  }

  if (!chef) return null;

  return (
    <div className="min-h-screen py-8 px-4" style={{ background: 'var(--background)' }}>
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Back button */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-sm transition-colors"
          style={{ color: 'var(--muted-foreground)' }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--primary)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--muted-foreground)')}
        >
          <ArrowLeft className="w-4 h-4" />
          {t('common.back')}
        </button>

        {/* Profile header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="rounded-[28px] p-6 sm:p-8"
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
                  style={{ background: 'linear-gradient(135deg, var(--primary), #5A9FA3)' }}
                >
                  {initials}
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 text-center sm:text-left">
              <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--foreground)' }}>
                {chef.name || t('chef.anonymous')}
              </h1>
              <div className="flex items-center justify-center sm:justify-start gap-1.5 mb-3"
                style={{ color: 'var(--muted-foreground)' }}>
                <Calendar className="w-3.5 h-3.5" />
                <span className="text-sm">{t('chef.joined')} {joinDate}</span>
              </div>
              {chef.bio ? (
                <p className="text-sm leading-relaxed max-w-md" style={{ color: 'var(--foreground)' }}>
                  {chef.bio}
                </p>
              ) : (
                isOwnProfile && (
                  <p className="text-sm italic" style={{ color: 'var(--muted-foreground)' }}>
                    {t('chef.no_bio')}
                  </p>
                )
              )}
              {chef.socialLinks && (
                <div className="mt-3 flex justify-center sm:justify-start">
                  <SocialLinksDisplay links={chef.socialLinks} />
                </div>
              )}
            </div>

            {/* Follow / Edit button */}
            <div className="flex-shrink-0">
              {isOwnProfile ? (
                <button
                  onClick={() => navigate('/profile')}
                  className="px-5 py-2.5 rounded-full text-sm font-medium transition-colors"
                  style={{ border: '1.5px solid var(--primary)', color: 'var(--primary)' }}
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
                  style={{ background: isFollowing ? '#5A9FA3' : 'var(--primary)' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#3d696b')}
                  onMouseLeave={e => (e.currentTarget.style.background = isFollowing ? '#5A9FA3' : 'var(--primary)')}
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
        </motion.div>

        {/* Stats row */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={{
            hidden: {},
            visible: {
              transition: {
                staggerChildren: 0.08
              }
            }
          }}
          className="grid grid-cols-3 gap-3"
        >
          <StatCard
            icon={<BookOpen className="w-5 h-5" />}
            value={chef.recipeCount}
            label={t('chef.recipes')}
          />
          <StatCard
            icon={<Users className="w-5 h-5" />}
            value={followerCount}
            label={t('chef.followers')}
            onClick={() => openList('followers')}
          />
          <StatCard
            icon={<ChefHat className="w-5 h-5" />}
            value={chef.followingCount}
            label={t('chef.following_count')}
            onClick={() => openList('following')}
          />
        </motion.div>

        {/* Recipes grid */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        >
          <h2 className="text-xl font-semibold mb-4" style={{ color: 'var(--foreground)' }}>
            {t('chef.recipes_by', { name: chef.name || t('chef.this_chef') })}
          </h2>

          {chef.recipes.length === 0 ? (
            <div className="text-center py-16" style={{ color: 'var(--muted-foreground)' }}>
              <ChefHat className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">{t('chef.no_recipes_yet')}</p>
            </div>
          ) : (
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={{
                hidden: {},
                visible: {
                  transition: {
                    staggerChildren: 0.08
                  }
                }
              }}
              className="grid grid-cols-2 sm:grid-cols-3 gap-4"
            >
              {chef.recipes.map(recipe => (
                <MiniRecipeCard
                  key={recipe.id}
                  recipe={recipe}
                  onClick={() => setSelectedRecipe(toRecipe(recipe))}
                />
              ))}
            </motion.div>
          )}
        </motion.div>
      </div>

      {/* Recipe detail modal */}
      <RecipeDetailModal
        recipe={selectedRecipe}
        isOpen={!!selectedRecipe}
        onClose={() => setSelectedRecipe(null)}
        onEdited={loadChef}
      />

      <FollowListModal
        open={listOpen}
        title={listType === 'followers' ? t('chef.followers') : t('chef.following_count')}
        users={listUsers}
        loading={listLoading}
        emptyText={listType === 'followers' ? t('chef.no_followers') : t('chef.no_following')}
        onClose={() => setListOpen(false)}
      />
    </div>
  );
}
