import { motion, AnimatePresence } from 'motion/react';
import { X, User } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { UserLite, followChef, unfollowChef } from '../api/chefApi';
import { useAuth } from '../auth/AuthProvider';

interface FollowListModalProps {
  open: boolean;
  title: string;
  users: UserLite[];
  emptyText: string;
  loading?: boolean;
  onClose: () => void;
}

export function FollowListModal({ open, title, users, emptyText, loading, onClose }: FollowListModalProps) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user } = useAuth();
  const [follows, setFollows] = useState<Record<number, boolean>>({});
  const [busy, setBusy] = useState<number | null>(null);

  const isFollowing = (u: UserLite) => follows[u.id] ?? u.isFollowing;

  const toggle = async (u: UserLite) => {
    const cur = isFollowing(u);
    setFollows((p) => ({ ...p, [u.id]: !cur }));
    setBusy(u.id);
    try {
      if (cur) await unfollowChef(u.id);
      else await followChef(u.id);
    } catch {
      setFollows((p) => ({ ...p, [u.id]: cur }));
    } finally {
      setBusy(null);
    }
  };

  const goTo = (u: UserLite) => { onClose(); navigate(`/chef/${u.id}`); };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" onClick={onClose}>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            transition={{ type: 'spring', stiffness: 300, damping: 26 }}
            onClick={(e) => e.stopPropagation()}
            className="relative bg-white rounded-[24px] shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col overflow-hidden"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="font-bold text-gray-900">{title}</h3>
              <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="overflow-y-auto p-2">
              {loading ? (
                <p className="text-center text-sm text-gray-400 py-10">…</p>
              ) : users.length === 0 ? (
                <p className="text-center text-sm text-gray-500 py-10">{emptyText}</p>
              ) : (
                users.map((u) => {
                  const name = u.name || u.email.split('@')[0];
                  const initials = name.slice(0, 2).toUpperCase();
                  const following = isFollowing(u);
                  return (
                    <div key={u.id} className="flex items-center gap-3 p-2.5 rounded-2xl hover:bg-gray-50 transition-colors">
                      <button onClick={() => goTo(u)} className="flex items-center gap-3 flex-1 min-w-0 text-left">
                        {u.avatarUrl ? (
                          <img src={u.avatarUrl} alt="" className="w-11 h-11 rounded-full object-cover" />
                        ) : (
                          <div className="w-11 h-11 rounded-full flex items-center justify-center text-white text-sm font-bold" style={{ background: 'linear-gradient(135deg, var(--primary), #5A9FA3)' }}>
                            {initials || <User className="w-5 h-5" />}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">{name}</p>
                          {u.bio && <p className="text-xs text-gray-400 truncate">{u.bio}</p>}
                        </div>
                      </button>
                      {user && !u.isSelf && (
                        <button
                          onClick={() => toggle(u)}
                          disabled={busy === u.id}
                          className={`shrink-0 px-4 py-1.5 rounded-full text-xs font-semibold transition-colors disabled:opacity-60 ${
                            following ? 'bg-gray-100 text-gray-700 hover:bg-gray-200' : 'bg-primary text-white hover:bg-primary/90'
                          }`}
                        >
                          {following ? t('chef.following') : t('chef.follow')}
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
