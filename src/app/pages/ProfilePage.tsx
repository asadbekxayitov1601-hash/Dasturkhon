// src/app/pages/ProfilePage.tsx
// Updated: added bio/avatar editing + AnalyticsDashboard tab

import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/AuthProvider';
import { toast } from 'sonner';
import { LogOut, Settings, Camera, Star, BookOpen, Users, ChefHat, Trash2 } from 'lucide-react';
import { AnalyticsDashboard } from '../components/AnalyticsDashboard';
import { RecipeDetailModal } from '../components/RecipeDetailModal';
import { FollowListModal } from '../components/FollowListModal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { ImageWithFallback } from '../components/figma/ImageWithFallback';
import { updateProfile, getChefProfile, getFollowers, getFollowing, deleteAccount, ChefProfile, ChefRecipe, UserLite, SocialLinks } from '../api/chefApi';
import { SocialLinksDisplay, SocialLinksEditor } from '../components/SocialLinks';
import { Recipe } from '../types/kitchen';

export function ProfilePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, refresh, logout } = useAuth();
  const [loading, setLoading] = useState(false);
  const [confirmDeleteAccount, setConfirmDeleteAccount] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  const handleDeleteAccount = async () => {
    setConfirmDeleteAccount(false);
    setDeletingAccount(true);
    try {
      await deleteAccount();
      toast.success(t('account.deleted'));
      logout();
      navigate('/');
    } catch (e: any) {
      toast.error(e.message || t('account.delete_failed'));
    } finally {
      setDeletingAccount(false);
    }
  };
  const [profile, setProfile] = useState<ChefProfile | null>(null);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);

  // Followers / following list modal
  const [listOpen, setListOpen] = useState(false);
  const [listType, setListType] = useState<'followers' | 'following'>('followers');
  const [listUsers, setListUsers] = useState<UserLite[]>([]);
  const [listLoading, setListLoading] = useState(false);

  const myRecipes: ChefRecipe[] = profile?.recipes || [];

  useEffect(() => {
    if (user) {
      getChefProfile(user.id).then(setProfile).catch(() => {});
    }
  }, [user]);

  const openList = async (type: 'followers' | 'following') => {
    if (!user) return;
    setListType(type);
    setListUsers([]);
    setListLoading(true);
    setListOpen(true);
    try {
      const users = type === 'followers' ? await getFollowers(user.id) : await getFollowing(user.id);
      setListUsers(users);
    } catch { /* ignore */ } finally {
      setListLoading(false);
    }
  };

  // Edit profile fields
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user?.name || '');
  const [bio, setBio] = useState('');
  const [social, setSocial] = useState<SocialLinks>({});
  const [avatarPreview, setAvatarPreview] = useState<string | undefined>();

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast.error('Image must be under 2MB'); return; }
    const reader = new FileReader();
    reader.onload = ev => setAvatarPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleSaveProfile = async () => {
    setLoading(true);
    try {
      await updateProfile({ name, bio, avatarUrl: avatarPreview, socialLinks: social });
      await refresh();
      setEditing(false);
      toast.success('Profile updated!');
    } catch (e: any) {
      toast.error(e.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  if (!user) return <div className="p-12 text-center">Please sign in to view profile.</div>;

  const initials = (user.name || user.email || user.phone || '?').slice(0, 2).toUpperCase();

  return (
    <div className="min-h-screen py-12 px-4" style={{ background: 'var(--background)' }}>
      <div className="max-w-3xl mx-auto space-y-6">

        {/* Profile Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="rounded-[28px] p-6 sm:p-8 flex flex-col sm:flex-row items-center gap-6 text-center sm:text-left"
          style={{ background: 'var(--card)', border: '1px solid rgba(74,124,126,0.12)', boxShadow: '0 2px 16px rgba(74,124,126,0.06)' }}
        >
          {/* Avatar */}
          <div className="relative flex-shrink-0">
            {avatarPreview || user.avatarUrl ? (
              <img
                src={avatarPreview || user.avatarUrl}
                alt={user.name || 'Profile'}
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
            {editing && (
              <label
                className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-white shadow-md flex items-center justify-center cursor-pointer"
                style={{ border: '1.5px solid rgba(74,124,126,0.3)' }}
              >
                <Camera className="w-3.5 h-3.5" style={{ color: 'var(--primary)' }} />
                <input type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
              </label>
            )}
          </div>

          <div className="flex-1">
            {editing ? (
              <div className="space-y-3 text-left">
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Your name"
                  className="w-full px-3 py-2 rounded-[10px] text-sm border focus:outline-none"
                  style={{ borderColor: 'rgba(74,124,126,0.3)', color: 'var(--foreground)' }}
                />
                <textarea
                  value={bio}
                  onChange={e => setBio(e.target.value)}
                  placeholder="Tell people about yourself as a cook..."
                  className="w-full px-3 py-2 rounded-[10px] text-sm border focus:outline-none resize-none"
                  style={{ borderColor: 'rgba(74,124,126,0.3)', color: 'var(--foreground)' }}
                  rows={2}
                />
                <div>
                  <p className="text-xs font-medium mb-1.5" style={{ color: 'var(--muted-foreground)' }}>Social media</p>
                  <SocialLinksEditor value={social} onChange={setSocial} />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveProfile}
                    disabled={loading}
                    className="px-4 py-2 rounded-full text-sm font-medium text-white disabled:opacity-60"
                    style={{ background: 'var(--primary)' }}
                  >
                    {loading ? 'Saving...' : 'Save'}
                  </button>
                  <button
                    onClick={() => setEditing(false)}
                    className="px-4 py-2 rounded-full text-sm"
                    style={{ color: 'var(--muted-foreground)' }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--foreground)' }}>{user.name || 'Your Name'}</h1>
                <p className="text-sm mb-1" style={{ color: 'var(--muted-foreground)' }}>{user.email || user.phone}</p>
                {profile && profile.reviewCount > 0 && (
                  <div className="flex items-center justify-center sm:justify-start gap-1 mb-1">
                    <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                    <span className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>{profile.avgRating.toFixed(1)}</span>
                    <span className="text-sm" style={{ color: 'var(--muted-foreground)' }}>({profile.reviewCount})</span>
                  </div>
                )}
                {user.bio && <p className="text-sm mb-3" style={{ color: 'var(--foreground)' }}>{user.bio}</p>}
                {user.socialLinks && (
                  <div className="flex justify-center sm:justify-start mb-3">
                    <SocialLinksDisplay links={user.socialLinks} />
                  </div>
                )}
                {user.isAdmin && (
                  <div className="flex flex-wrap gap-2 justify-center sm:justify-start mb-3">
                    <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium">Admin</span>
                  </div>
                )}
                <button
                  onClick={() => { setEditing(true); setName(user.name || ''); setBio(user.bio || ''); setSocial(user.socialLinks || {}); }}
                  className="text-xs flex items-center gap-1.5 transition-colors"
                  style={{ color: 'var(--muted-foreground)' }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--primary)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--muted-foreground)')}
                >
                  <Settings className="w-3.5 h-3.5" /> Edit profile
                </button>
              </>
            )}
          </div>

          <button
            onClick={logout}
            className="p-2 transition-colors flex-shrink-0"
            style={{ color: '#C4B49A' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--secondary)')}
            onMouseLeave={e => (e.currentTarget.style.color = '#C4B49A')}
            title="Logout"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </motion.div>

        {/* Stats row (like a public profile) */}
        <div className="grid grid-cols-3 gap-3 animate-fade-up">
          <div className="flex flex-col items-center gap-1 px-4 py-4 rounded-[20px] bg-white" style={{ border: '1px solid rgba(74,124,126,0.12)' }}>
            <BookOpen className="w-5 h-5" style={{ color: 'var(--primary)' }} />
            <div className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>{profile?.recipeCount ?? 0}</div>
            <div className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{t('chef.recipes')}</div>
          </div>
          <button onClick={() => openList('followers')} className="flex flex-col items-center gap-1 px-4 py-4 rounded-[20px] bg-white cursor-pointer hover:shadow-md active:scale-95 transition-all" style={{ border: '1px solid rgba(74,124,126,0.12)' }}>
            <Users className="w-5 h-5" style={{ color: 'var(--primary)' }} />
            <div className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>{profile?.followerCount ?? 0}</div>
            <div className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{t('chef.followers')}</div>
          </button>
          <button onClick={() => openList('following')} className="flex flex-col items-center gap-1 px-4 py-4 rounded-[20px] bg-white cursor-pointer hover:shadow-md active:scale-95 transition-all" style={{ border: '1px solid rgba(74,124,126,0.12)' }}>
            <ChefHat className="w-5 h-5" style={{ color: 'var(--primary)' }} />
            <div className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>{profile?.followingCount ?? 0}</div>
            <div className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{t('chef.following_count')}</div>
          </button>
        </div>

        {/* My Recipes (Instagram-style grid) */}
        {myRecipes.length > 0 && (
          <div className="animate-fade-up">
            <h2 className="text-lg font-semibold mb-3" style={{ color: 'var(--foreground)' }}>{t('chef.my_recipes')}</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {myRecipes.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setSelectedRecipe({
                    ...(r as unknown as Recipe),
                    userId: Number(user.id),
                    user: { id: Number(user.id), name: user.name, avatarUrl: user.avatarUrl, rating: profile?.avgRating, reviewCount: profile?.reviewCount },
                  })}
                  className="group relative rounded-2xl overflow-hidden aspect-square bg-gray-100"
                >
                  <ImageWithFallback src={r.image} alt={r.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-2 text-left">
                    <p className="text-white text-xs font-semibold line-clamp-2 capitalize">{r.title}</p>
                    {r.avgRating !== null && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] text-white/90 mt-0.5">
                        <Star className="w-3 h-3 fill-amber-400 text-amber-400" /> {r.avgRating.toFixed(1)}
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Analytics (cards animate individually) */}
        <AnalyticsDashboard />

        {/* Danger zone */}
        <div className="pt-4 flex justify-center">
          <button
            onClick={() => setConfirmDeleteAccount(true)}
            disabled={deletingAccount}
            className="flex items-center gap-2 text-sm font-medium text-red-500 hover:text-red-600 hover:bg-red-50 px-4 py-2 rounded-xl transition-colors disabled:opacity-60"
          >
            <Trash2 className="w-4 h-4" />
            {t('account.delete')}
          </button>
        </div>

      </div>

      <RecipeDetailModal
        recipe={selectedRecipe}
        isOpen={!!selectedRecipe}
        onClose={() => setSelectedRecipe(null)}
        onEdited={() => { if (user) getChefProfile(user.id).then(setProfile).catch(() => {}); }}
      />

      <FollowListModal
        open={listOpen}
        title={listType === 'followers' ? t('chef.followers') : t('chef.following_count')}
        users={listUsers}
        loading={listLoading}
        emptyText={listType === 'followers' ? t('chef.no_followers') : t('chef.no_following')}
        onClose={() => setListOpen(false)}
      />

      <ConfirmDialog
        open={confirmDeleteAccount}
        title={t('account.confirm_title')}
        message={t('account.confirm_message')}
        confirmLabel={t('account.delete')}
        cancelLabel={t('recipes.cancel')}
        onConfirm={handleDeleteAccount}
        onCancel={() => setConfirmDeleteAccount(false)}
      />
    </div>
  );
}
