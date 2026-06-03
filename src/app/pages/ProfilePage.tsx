// src/app/pages/ProfilePage.tsx
// Updated: added bio/avatar editing + AnalyticsDashboard tab

import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { useAuth } from '../auth/AuthProvider';
import { toast } from 'sonner';
import { LogOut, Settings, Camera } from 'lucide-react';
import { AnalyticsDashboard } from '../components/AnalyticsDashboard';
import { EarningsDashboard } from '../components/EarningsDashboard';
import { updateProfile } from '../api/chefApi';

export function ProfilePage() {
  const { user, refresh, logout } = useAuth();
  const [loading, setLoading] = useState(false);

  // Edit profile fields
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user?.name || '');
  const [bio, setBio] = useState('');
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
      await updateProfile({ name, bio, avatarUrl: avatarPreview });
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

  const initials = user.name ? user.name.slice(0, 2).toUpperCase() : user.email.slice(0, 2).toUpperCase();

  return (
    <div className="min-h-screen py-12 px-4" style={{ background: '#FFFDF5' }}>
      <div className="max-w-3xl mx-auto space-y-6">

        {/* Profile Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="rounded-[28px] p-6 sm:p-8 flex flex-col sm:flex-row items-center gap-6 text-center sm:text-left"
          style={{ background: '#fff', border: '1px solid rgba(74,124,126,0.12)', boxShadow: '0 2px 16px rgba(74,124,126,0.06)' }}
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
                style={{ background: 'linear-gradient(135deg, #4A7C7E, #5A9FA3)' }}
              >
                {initials}
              </div>
            )}
            {editing && (
              <label
                className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-white shadow-md flex items-center justify-center cursor-pointer"
                style={{ border: '1.5px solid rgba(74,124,126,0.3)' }}
              >
                <Camera className="w-3.5 h-3.5" style={{ color: '#4A7C7E' }} />
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
                  style={{ borderColor: 'rgba(74,124,126,0.3)', color: '#2C3E50' }}
                />
                <textarea
                  value={bio}
                  onChange={e => setBio(e.target.value)}
                  placeholder="Tell people about yourself as a cook..."
                  className="w-full px-3 py-2 rounded-[10px] text-sm border focus:outline-none resize-none"
                  style={{ borderColor: 'rgba(74,124,126,0.3)', color: '#2C3E50' }}
                  rows={2}
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveProfile}
                    disabled={loading}
                    className="px-4 py-2 rounded-full text-sm font-medium text-white disabled:opacity-60"
                    style={{ background: '#4A7C7E' }}
                  >
                    {loading ? 'Saving...' : 'Save'}
                  </button>
                  <button
                    onClick={() => setEditing(false)}
                    className="px-4 py-2 rounded-full text-sm"
                    style={{ color: '#7A8B99' }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <h1 className="text-2xl font-bold mb-1" style={{ color: '#2C3E50' }}>{user.name || 'Your Name'}</h1>
                <p className="text-sm mb-1" style={{ color: '#7A8B99' }}>{user.email}</p>
                {user.bio && <p className="text-sm mb-3" style={{ color: '#2C3E50' }}>{user.bio}</p>}
                {user.isAdmin && (
                  <div className="flex flex-wrap gap-2 justify-center sm:justify-start mb-3">
                    <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium">Admin</span>
                  </div>
                )}
                <button
                  onClick={() => { setEditing(true); setName(user.name || ''); setBio(user.bio || ''); }}
                  className="text-xs flex items-center gap-1.5 transition-colors"
                  style={{ color: '#7A8B99' }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#4A7C7E')}
                  onMouseLeave={e => (e.currentTarget.style.color = '#7A8B99')}
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
            onMouseEnter={e => (e.currentTarget.style.color = '#D17A52')}
            onMouseLeave={e => (e.currentTarget.style.color = '#C4B49A')}
            title="Logout"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </motion.div>

        {/* Earnings (cards animate individually) */}
        <EarningsDashboard />

        {/* Analytics (cards animate individually) */}
        <AnalyticsDashboard />

      </div>
    </div>
  );
}
