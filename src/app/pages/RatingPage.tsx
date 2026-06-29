// src/app/pages/RatingPage.tsx
// Public leaderboard of every chef on Dasturkhon. Default order is by the number
// of published recipes; viewers can re-sort by overall rating or follower count.

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'motion/react';
import { BookOpen, Star, Users, Trophy, User as UserIcon } from 'lucide-react';
import { ChefLeaderboardEntry, ChefSort, getChefLeaderboard } from '../api/chefApi';
import { PanLoader } from '../components/PanLoader';

const SORTS: { key: ChefSort; labelKey: string; icon: React.ReactNode }[] = [
  { key: 'recipes', labelKey: 'rating_page.sort_recipes', icon: <BookOpen className="w-4 h-4" /> },
  { key: 'rating', labelKey: 'rating_page.sort_rating', icon: <Star className="w-4 h-4" /> },
  { key: 'followers', labelKey: 'rating_page.sort_followers', icon: <Users className="w-4 h-4" /> },
];

function rankColor(rank: number): string {
  if (rank === 1) return '#E6B566';            // gold
  if (rank === 2) return '#B8C0C2';            // silver
  if (rank === 3) return '#C8895A';            // bronze
  return 'var(--muted-foreground)';
}

function ChefRow({ chef, rank, sort, onClick }: { chef: ChefLeaderboardEntry; rank: number; sort: ChefSort; onClick: () => void }) {
  const { t } = useTranslation();
  const name = chef.name || chef.email?.split('@')[0] || t('chef.anonymous');
  const initials = (chef.name || chef.email || 'C').slice(0, 2).toUpperCase();

  // The metric matching the active sort is highlighted.
  const stat = (active: boolean) => ({
    color: active ? 'var(--foreground)' : 'var(--muted-foreground)',
    fontWeight: active ? 700 : 500,
  });

  return (
    <motion.button
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={onClick}
      className="w-full flex items-center gap-3 sm:gap-4 px-3 sm:px-5 py-3 rounded-[20px] bg-card text-left hover:shadow-md active:scale-[0.99] transition-all"
      style={{ border: '1px solid rgba(74,124,126,0.12)' }}
    >
      {/* Rank */}
      <div className="w-7 sm:w-9 flex-shrink-0 flex items-center justify-center">
        {rank <= 3 ? (
          <Trophy className="w-5 h-5 sm:w-6 sm:h-6" style={{ color: rankColor(rank) }} />
        ) : (
          <span className="text-sm font-bold" style={{ color: 'var(--muted-foreground)' }}>{rank}</span>
        )}
      </div>

      {/* Avatar */}
      {chef.avatarUrl ? (
        <img src={chef.avatarUrl} alt="" className="w-11 h-11 rounded-full object-cover ring-2 ring-white shadow flex-shrink-0" />
      ) : (
        <div
          className="w-11 h-11 rounded-full flex items-center justify-center text-white text-sm font-bold ring-2 ring-white shadow flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, var(--primary), #5A9FA3)' }}
        >
          {initials || <UserIcon className="w-5 h-5" />}
        </div>
      )}

      {/* Name + bio */}
      <div className="min-w-0 flex-1">
        <p className="text-sm sm:text-base font-semibold truncate" style={{ color: 'var(--foreground)' }}>{name}</p>
        {chef.bio && <p className="text-xs truncate" style={{ color: 'var(--muted-foreground)' }}>{chef.bio}</p>}
      </div>

      {/* Stats */}
      <div className="flex items-center gap-3 sm:gap-6 flex-shrink-0">
        <div className="flex flex-col items-center min-w-[2.5rem]" style={stat(sort === 'recipes')}>
          <span className="flex items-center gap-1 text-sm"><BookOpen className="w-3.5 h-3.5" style={{ color: 'var(--primary)' }} />{chef.recipeCount}</span>
          <span className="text-[10px] font-medium" style={{ color: 'var(--muted-foreground)' }}>{t('rating_page.recipes')}</span>
        </div>
        <div className="flex flex-col items-center min-w-[2.5rem]" style={stat(sort === 'rating')}>
          <span className="flex items-center gap-1 text-sm">
            <Star className="w-3.5 h-3.5" fill="var(--accent)" stroke="var(--accent)" />
            {chef.reviewCount > 0 ? chef.avgRating.toFixed(1) : '—'}
          </span>
          <span className="text-[10px] font-medium" style={{ color: 'var(--muted-foreground)' }}>{t('rating_page.rating')}</span>
        </div>
        <div className="flex flex-col items-center min-w-[2.5rem]" style={stat(sort === 'followers')}>
          <span className="flex items-center gap-1 text-sm"><Users className="w-3.5 h-3.5" style={{ color: 'var(--primary)' }} />{chef.followerCount}</span>
          <span className="text-[10px] font-medium" style={{ color: 'var(--muted-foreground)' }}>{t('rating_page.followers')}</span>
        </div>
      </div>
    </motion.button>
  );
}

export function RatingPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [sort, setSort] = useState<ChefSort>('recipes');
  const [chefs, setChefs] = useState<ChefLeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getChefLeaderboard(sort)
      .then((list) => { if (!cancelled) setChefs(list); })
      .catch(() => { if (!cancelled) setChefs([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [sort]);

  return (
    <div className="min-h-screen py-8 px-4" style={{ background: 'var(--background)' }}>
      <div className="max-w-3xl mx-auto space-y-6">

        {/* Header */}
        <div className="text-center sm:text-left">
          <h1 className="text-3xl sm:text-4xl font-bold mb-2" style={{ color: 'var(--foreground)' }}>{t('rating_page.title')}</h1>
          <p style={{ color: 'var(--muted-foreground)' }}>{t('rating_page.subtitle')}</p>
        </div>

        {/* Sort toggle */}
        <div className="flex flex-wrap gap-2">
          {SORTS.map((s) => {
            const active = sort === s.key;
            return (
              <button
                key={s.key}
                onClick={() => setSort(s.key)}
                className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all"
                style={
                  active
                    ? { background: 'var(--primary)', color: '#fff', boxShadow: '0 4px 12px rgba(74,124,126,0.25)' }
                    : { background: 'var(--card)', color: 'var(--foreground)', border: '1px solid rgba(74,124,126,0.2)' }
                }
              >
                {s.icon}
                {t(s.labelKey)}
              </button>
            );
          })}
        </div>

        {/* List */}
        {loading ? (
          <div className="flex justify-center py-20"><PanLoader /></div>
        ) : chefs.length === 0 ? (
          <div className="text-center py-16" style={{ color: 'var(--muted-foreground)' }}>
            <Trophy className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">{t('rating_page.empty')}</p>
          </div>
        ) : (
          <motion.div layout className="space-y-2.5">
            {chefs.map((chef, i) => (
              <ChefRow
                key={chef.id}
                chef={chef}
                rank={i + 1}
                sort={sort}
                onClick={() => navigate(`/chef/${chef.id}`)}
              />
            ))}
          </motion.div>
        )}
      </div>
    </div>
  );
}
