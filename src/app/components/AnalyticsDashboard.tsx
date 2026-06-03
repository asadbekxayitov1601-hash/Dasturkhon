// src/app/components/AnalyticsDashboard.tsx
// Drop into src/app/components/
// Embed inside ProfilePage for chefs

import { useEffect, useState } from 'react';
import { Eye, Heart, Star, BookOpen, Users, TrendingUp, ChefHat } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getMyAnalytics, AnalyticsData, RecipeStat } from '../api/analyticsApi';

// ── Tiny bar chart (pure CSS — no recharts dependency) ───────────────────────
function MiniBarChart({ data }: { data: { date: string; views: number }[] }) {
  const max = Math.max(...data.map(d => d.views), 1);
  // Show last 14 days only (less crowded)
  const slice = data.slice(-14);

  return (
    <div className="flex items-end gap-[3px] h-20 w-full">
      {slice.map((d, i) => {
        const height = Math.max((d.views / max) * 100, 2);
        const isToday = i === slice.length - 1;
        return (
          <div key={d.date} className="flex-1 flex flex-col items-center gap-1 group relative">
            {/* Tooltip */}
            <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-[10px] px-2 py-1 rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
              {d.views} views
              <br />
              {new Date(d.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
            </div>
            <div
              className="w-full rounded-t-sm transition-all duration-300"
              style={{
                height: `${height}%`,
                background: isToday
                  ? 'linear-gradient(to top, #4A7C7E, #5A9FA3)'
                  : d.views > 0
                  ? 'rgba(74,124,126,0.5)'
                  : 'rgba(74,124,126,0.12)',
              }}
            />
          </div>
        );
      })}
    </div>
  );
}

// ── Summary stat card ─────────────────────────────────────────────────────────
function SummaryCard({
  icon,
  value,
  label,
  color,
  stagger = 1,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
  color: string;
  stagger?: number;
}) {
  return (
    <div
      className={`rounded-[20px] p-5 flex flex-col gap-2 animate-fade-up stagger-${stagger}`}
      style={{ background: `${color}10`, border: `1px solid ${color}25` }}
    >
      <div className="w-9 h-9 rounded-full flex items-center justify-center"
        style={{ background: `${color}20`, color }}>
        {icon}
      </div>
      <div className="text-2xl font-bold" style={{ color: '#2C3E50' }}>
        {value.toLocaleString()}
      </div>
      <div className="text-xs font-medium" style={{ color: '#7A8B99' }}>{label}</div>
    </div>
  );
}

// ── Recipe row in the table ───────────────────────────────────────────────────
function RecipeRow({ recipe, rank }: { recipe: RecipeStat; rank: number }) {
  return (
    <div
      className="flex items-center gap-4 p-3 rounded-[16px] transition-colors hover:bg-gray-50"
      style={{ borderBottom: '1px solid rgba(74,124,126,0.08)' }}
    >
      {/* Rank */}
      <div
        className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
        style={{
          background: rank <= 3 ? 'linear-gradient(135deg, #E6B566, #D17A52)' : 'rgba(74,124,126,0.1)',
          color: rank <= 3 ? '#fff' : '#7A8B99',
        }}
      >
        {rank}
      </div>

      {/* Image */}
      <img
        src={recipe.image}
        alt={recipe.title}
        className="w-12 h-12 rounded-[10px] object-cover flex-shrink-0"
      />

      {/* Title + category */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-semibold truncate" style={{ color: '#2C3E50' }}>
            {recipe.title}
          </p>
        </div>
        <span
          className="text-xs px-1.5 py-0.5 rounded-md capitalize"
          style={{ background: 'rgba(74,124,126,0.08)', color: '#4A7C7E' }}
        >
          {recipe.category}
        </span>
      </div>

      {/* Stats */}
      <div className="flex gap-4 flex-shrink-0">
        <div className="text-center">
          <div className="text-sm font-bold" style={{ color: '#2C3E50' }}>{recipe.views}</div>
          <div className="text-[10px]" style={{ color: '#7A8B99' }}>views</div>
        </div>
        <div className="text-center hidden sm:block">
          <div className="text-sm font-bold" style={{ color: '#2C3E50' }}>{recipe.saves}</div>
          <div className="text-[10px]" style={{ color: '#7A8B99' }}>saves</div>
        </div>
        <div className="text-center hidden sm:block">
          <div className="text-sm font-bold" style={{ color: '#2C3E50' }}>{recipe.reviews}</div>
          <div className="text-[10px]" style={{ color: '#7A8B99' }}>reviews</div>
        </div>
        {recipe.avgRating !== null && (
          <div className="text-center">
            <div className="flex items-center gap-0.5">
              <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
              <span className="text-sm font-bold" style={{ color: '#2C3E50' }}>
                {recipe.avgRating.toFixed(1)}
              </span>
            </div>
            <div className="text-[10px]" style={{ color: '#7A8B99' }}>rating</div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main dashboard ────────────────────────────────────────────────────────────
export function AnalyticsDashboard() {
  const { t } = useTranslation();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sortBy, setSortBy] = useState<'views' | 'saves' | 'reviews' | 'rating'>('views');

  useEffect(() => {
    getMyAnalytics()
      .then(setData)
      .catch(() => setError('Failed to load analytics'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[1,2,3,4,5].map(i => (
            <div key={i} className="h-28 rounded-[20px]" style={{ background: '#F5E6D3' }} />
          ))}
        </div>
        <div className="h-40 rounded-[20px]" style={{ background: '#F5E6D3' }} />
        <div className="h-64 rounded-[20px]" style={{ background: '#F5E6D3' }} />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="text-center py-10 text-sm" style={{ color: '#7A8B99' }}>
        {error || 'No analytics data available'}
      </div>
    );
  }

  const { summary, recipeStats, viewsChart, topRecipe } = data;

  const sorted = [...recipeStats].sort((a, b) => {
    if (sortBy === 'rating') {
      return (b.avgRating || 0) - (a.avgRating || 0);
    }
    return b[sortBy] - a[sortBy];
  });

  const hasRecipes = recipeStats.length > 0;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-2">
        <TrendingUp className="w-5 h-5" style={{ color: '#4A7C7E' }} />
        <h2 className="text-lg font-semibold" style={{ color: '#2C3E50' }}>
          {t('analytics.title')}
        </h2>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <SummaryCard icon={<Eye className="w-4 h-4" />}    value={summary.totalViews}   label={t('analytics.total_views')}   color="#4A7C7E" stagger={1} />
        <SummaryCard icon={<Heart className="w-4 h-4" />}   value={summary.totalSaves}   label={t('analytics.total_saves')}   color="#D17A52" stagger={2} />
        <SummaryCard icon={<Star className="w-4 h-4" />}    value={summary.totalReviews} label={t('analytics.total_reviews')} color="#E6B566" stagger={3} />
        <SummaryCard icon={<BookOpen className="w-4 h-4" />} value={summary.totalRecipes} label={t('analytics.total_recipes')} color="#5A9FA3" stagger={4} />
        <SummaryCard icon={<Users className="w-4 h-4" />}   value={summary.followerCount} label={t('analytics.followers')}    color="#7A6FA3" stagger={5} />
      </div>

      {!hasRecipes ? (
        <div
          className="rounded-[20px] p-10 text-center"
          style={{ background: 'rgba(74,124,126,0.04)', border: '1px dashed rgba(74,124,126,0.2)' }}
        >
          <ChefHat className="w-10 h-10 mx-auto mb-3 opacity-30" style={{ color: '#4A7C7E' }} />
          <p className="text-sm" style={{ color: '#7A8B99' }}>{t('analytics.no_recipes')}</p>
        </div>
      ) : (
        <>
          {/* Views chart */}
          <div
            className="rounded-[20px] p-5"
            style={{ background: '#fff', border: '1px solid rgba(74,124,126,0.12)' }}
          >
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-semibold" style={{ color: '#2C3E50' }}>
                {t('analytics.views_last_14')}
              </p>
              <span className="text-xs px-2 py-1 rounded-full"
                style={{ background: 'rgba(74,124,126,0.08)', color: '#4A7C7E' }}>
                {summary.totalViews} total
              </span>
            </div>
            <MiniBarChart data={viewsChart} />
            {/* X axis labels */}
            <div className="flex justify-between mt-1">
              {[viewsChart[viewsChart.length - 14], viewsChart[viewsChart.length - 7], viewsChart[viewsChart.length - 1]]
                .filter(Boolean)
                .map(d => (
                  <span key={d.date} className="text-[10px]" style={{ color: '#7A8B99' }}>
                    {new Date(d.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </span>
                ))}
            </div>
          </div>

          {/* Top recipe highlight */}
          {topRecipe && topRecipe.views > 0 && (
            <div
              className="rounded-[20px] p-4 flex items-center gap-4"
              style={{
                background: 'linear-gradient(135deg, rgba(230,181,102,0.12), rgba(209,122,82,0.08))',
                border: '1px solid rgba(230,181,102,0.25)',
              }}
            >
              <img
                src={topRecipe.image}
                alt={topRecipe.title}
                className="w-14 h-14 rounded-[12px] object-cover flex-shrink-0"
              />
              <div className="flex-1">
                <p className="text-xs font-medium mb-0.5" style={{ color: '#D17A52' }}>
                  🏆 {t('analytics.top_recipe')}
                </p>
                <p className="font-semibold text-sm" style={{ color: '#2C3E50' }}>{topRecipe.title}</p>
                <p className="text-xs mt-0.5" style={{ color: '#7A8B99' }}>
                  {topRecipe.views} views · {topRecipe.saves} saves · {topRecipe.reviews} reviews
                </p>
              </div>
            </div>
          )}

          {/* Recipe table */}
          <div
            className="rounded-[20px] overflow-hidden"
            style={{ background: '#fff', border: '1px solid rgba(74,124,126,0.12)' }}
          >
            {/* Table header + sort */}
            <div
              className="flex items-center justify-between px-4 py-3"
              style={{ borderBottom: '1px solid rgba(74,124,126,0.1)' }}
            >
              <p className="text-sm font-semibold" style={{ color: '#2C3E50' }}>
                {t('analytics.recipe_performance')}
              </p>
              <div className="flex gap-1">
                {(['views', 'saves', 'reviews', 'rating'] as const).map(key => (
                  <button
                    key={key}
                    onClick={() => setSortBy(key)}
                    className="text-xs px-2.5 py-1 rounded-full transition-colors capitalize"
                    style={{
                      background: sortBy === key ? '#4A7C7E' : 'rgba(74,124,126,0.08)',
                      color: sortBy === key ? '#fff' : '#4A7C7E',
                    }}
                  >
                    {key}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-3 space-y-1">
              {sorted.map((recipe, i) => (
                <RecipeRow key={recipe.id} recipe={recipe} rank={i + 1} />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
