// src/app/pages/ProfilePage.tsx
// Updated: added bio/avatar editing + AnalyticsDashboard tab

import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { authFetch } from '../auth/authFetch';
import { toast } from 'sonner';
import { Crown, User as UserIcon, LogOut, CreditCard, TrendingUp, Settings, Camera } from 'lucide-react';
import { AnalyticsDashboard } from '../components/AnalyticsDashboard';
import { updateProfile } from '../api/chefApi';

type Tab = 'account' | 'analytics';

export function ProfilePage() {
  const { user, refresh, logout } = useAuth();
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<Tab>('account');

  // Edit profile fields
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user?.name || '');
  const [bio, setBio] = useState('');
  const [avatarPreview, setAvatarPreview] = useState<string | undefined>();

  const handleCancelSubscription = async () => {
    if (!confirm('Are you sure you want to cancel your Pro subscription?')) return;
    setLoading(true);
    try {
      const res = await authFetch('/api/subscribe/cancel', { method: 'POST' });
      if (!res.ok) throw new Error('Failed to cancel');
      await refresh();
      toast.success('Subscription cancelled');
    } catch (e: any) {
      toast.error(e.message || 'Error cancelling subscription');
    } finally {
      setLoading(false);
    }
  };

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
        <div
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
            {user.isPro && (
              <div className="absolute -top-1 -right-1 bg-gradient-to-r from-amber-400 to-amber-600 rounded-full p-1.5 border-2 border-white shadow">
                <Crown className="w-4 h-4 text-white fill-current" />
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
                <div className="flex flex-wrap gap-2 justify-center sm:justify-start mb-3">
                  {user.isAdmin && (
                    <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium">Admin</span>
                  )}
                  {user.isPro ? (
                    <span className="px-3 py-1 bg-amber-50 text-amber-700 rounded-full text-xs font-bold border border-amber-200 flex items-center gap-1.5">
                      <Crown className="w-3 h-3 fill-current" /> Pro Member
                    </span>
                  ) : (
                    <span className="px-3 py-1 bg-gray-50 text-gray-500 rounded-full text-xs border">Free Plan</span>
                  )}
                </div>
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
        </div>

        {/* Tab switcher */}
        <div
          className="flex rounded-[20px] p-1 gap-1"
          style={{ background: 'rgba(74,124,126,0.07)' }}
        >
          {([
            { key: 'account' as Tab, label: 'Account & Billing', icon: <CreditCard className="w-4 h-4" /> },
            { key: 'analytics' as Tab, label: 'My Analytics', icon: <TrendingUp className="w-4 h-4" /> },
          ]).map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-[16px] text-sm font-medium transition-all"
              style={{
                background: tab === t.key ? '#fff' : 'transparent',
                color: tab === t.key ? '#4A7C7E' : '#7A8B99',
                boxShadow: tab === t.key ? '0 1px 4px rgba(74,124,126,0.12)' : 'none',
              }}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>

        {/* Account tab */}
        {tab === 'account' && (
          <div
            className="rounded-[28px] overflow-hidden"
            style={{ background: '#fff', border: '1px solid rgba(74,124,126,0.12)' }}
          >
            <div className="p-6 border-b" style={{ borderColor: 'rgba(74,124,126,0.1)' }}>
              <h2 className="text-lg font-semibold" style={{ color: '#2C3E50' }}>Subscription & Billing</h2>
            </div>
            <div className="p-6 space-y-5">
              {user.isPro ? (
                <div
                  className="flex items-center justify-between p-4 rounded-[16px]"
                  style={{ background: 'rgba(230,181,102,0.08)', border: '1px solid rgba(230,181,102,0.2)' }}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full flex items-center justify-center"
                      style={{ background: 'rgba(230,181,102,0.15)' }}>
                      <Crown className="w-6 h-6 text-amber-500 fill-current" />
                    </div>
                    <div>
                      <h3 className="font-semibold" style={{ color: '#2C3E50' }}>Pro Subscription Active</h3>
                      <p className="text-sm" style={{ color: '#E6B566' }}>Full access to all features</p>
                    </div>
                  </div>
                  <button
                    onClick={handleCancelSubscription}
                    disabled={loading}
                    className="px-4 py-2 text-sm font-medium rounded-[10px] border transition-colors disabled:opacity-50"
                    style={{ color: '#D17A52', borderColor: '#D17A52' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(209,122,82,0.06)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    {loading ? 'Cancelling...' : 'Cancel'}
                  </button>
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-sm mb-2" style={{ color: '#7A8B99' }}>You are on the free plan.</p>
                  <p className="text-xs" style={{ color: '#C4B49A' }}>Upgrade to Pro to unlock all recipes.</p>
                </div>
              )}

              {user.cardLast4 && (
                <div
                  className="flex items-center gap-4 p-4 rounded-[16px]"
                  style={{ background: 'rgba(74,124,126,0.04)', border: '1px solid rgba(74,124,126,0.1)' }}
                >
                  <CreditCard className="w-5 h-5 flex-shrink-0" style={{ color: '#4A7C7E' }} />
                  <div>
                    <p className="font-mono font-medium" style={{ color: '#2C3E50' }}>
                      •••• •••• •••• {user.cardLast4}
                    </p>
                    <p className="text-xs" style={{ color: '#7A8B99' }}>Linked card for payments</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Analytics tab */}
        {tab === 'analytics' && <AnalyticsDashboard />}

      </div>
    </div>
  );
}
