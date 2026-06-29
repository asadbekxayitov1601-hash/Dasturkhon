// src/app/components/AnalyticsDashboard.tsx
// Drop into src/app/components/
// Embed inside ProfilePage for chefs

import { useEffect, useState } from 'react';
import { Eye, Heart, Star, BookOpen, Users, TrendingUp, ChefHat, Trophy } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { motion } from 'motion/react';
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend,
} from 'recharts';
import { getMyAnalytics, AnalyticsData, RecipeStat } from '../api/analyticsApi';

const cardVariants = {
  hidden: { opacity: 0, y: 15 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } }
};

const chartTooltipStyle = {
  borderRadius: 12,
  border: '1px solid rgba(74,124,126,0.15)',
  boxShadow: '0 6px 20px rgba(74,124,126,0.15)',
  fontSize: 12,
};

// ── Views over time (area chart) ─────────────────────────────────────────────
function ViewsAreaChart({ data }: { data: { date: string; views: number }[] }) {
  const { t } = useTranslation();
  const slice = data.slice(-14).map(d => ({
    views: d.views,
    label: new Date(d.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
  }));
  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={slice} margin={{ top: 5, right: 8, left: -18, bottom: 0 }}>
        <defs>
          <linearGradient id="viewsGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.35} />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(74,124,126,0.1)" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={20} />
        <YAxis tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} allowDecimals={false} width={30} />
        <Tooltip contentStyle={chartTooltipStyle} labelStyle={{ color: 'var(--foreground)', fontWeight: 600 }} />
        <Area type="monotone" dataKey="views" name={t('analytics.views')} stroke="var(--primary)" strokeWidth={2.5} fill="url(#viewsGrad)" dot={false} activeDot={{ r: 4 }} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ── Views & saves by recipe (bar chart) ──────────────────────────────────────
function RecipesBarChart({ recipes }: { recipes: RecipeStat[] }) {
  const { t } = useTranslation();
  const data = [...recipes]
    .sort((a, b) => b.views - a.views)
    .slice(0, 6)
    .map(r => ({
      name: r.title.length > 14 ? r.title.slice(0, 14) + '…' : r.title,
      views: r.views,
      saves: r.saves,
    }));
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 5, right: 8, left: -18, bottom: 0 }} barGap={2}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(74,124,126,0.1)" vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} interval={0} angle={-15} textAnchor="end" height={50} />
        <YAxis tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} allowDecimals={false} width={30} />
        <Tooltip contentStyle={chartTooltipStyle} cursor={{ fill: 'rgba(74,124,126,0.05)' }} />
        <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" />
        <Bar dataKey="views" name={t('analytics.views')} fill="var(--primary)" radius={[4, 4, 0, 0]} maxBarSize={28} />
        <Bar dataKey="saves" name={t('analytics.saves')} fill="var(--secondary)" radius={[4, 4, 0, 0]} maxBarSize={28} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Summary stat card ─────────────────────────────────────────────────────────
function SummaryCard({
  icon,
  value,
  label,
  color,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
  color: string;
}) {
  return (
    <motion.div
      variants={cardVariants}
      className="rounded-[20px] p-5 flex flex-col gap-2"
      style={{ background: `${color}10`, border: `1px solid ${color}25` }}
    >
      <div className="w-9 h-9 rounded-full flex items-center justify-center"
        style={{ background: `${color}20`, color }}>
        {icon}
      </div>
      <div className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>
        {value.toLocaleString()}
      </div>
      <div className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>{label}</div>
    </motion.div>
  );
}

// ── Recipe row in the table ───────────────────────────────────────────────────
function RecipeRow({ recipe, rank }: { recipe: RecipeStat; rank: number }) {
  const { t } = useTranslation();
  return (
    <div
      className="flex items-center gap-4 p-3 rounded-[16px] transition-colors hover:bg-muted"
      style={{ borderBottom: '1px solid rgba(74,124,126,0.08)' }}
    >
      {/* Rank */}
      <div
        className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
        style={{
          background: rank <= 3 ? 'linear-gradient(135deg, var(--accent), var(--secondary))' : 'rgba(74,124,126,0.1)',
          color: rank <= 3 ? '#fff' : 'var(--muted-foreground)',
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
          <p className="text-sm font-semibold truncate" style={{ color: 'var(--foreground)' }}>
            {recipe.title}
          </p>
        </div>
        <span
          className="text-xs px-1.5 py-0.5 rounded-md capitalize"
          style={{ background: 'rgba(74,124,126,0.08)', color: 'var(--primary)' }}
        >
          {recipe.category}
        </span>
      </div>

      {/* Stats */}
      <div className="flex gap-4 flex-shrink-0">
        <div className="text-center">
          <div className="text-sm font-bold" style={{ color: 'var(--foreground)' }}>{recipe.views}</div>
          <div className="text-[10px]" style={{ color: 'var(--muted-foreground)' }}>{t('analytics.views')}</div>
        </div>
        <div className="text-center hidden sm:block">
          <div className="text-sm font-bold" style={{ color: 'var(--foreground)' }}>{recipe.saves}</div>
          <div className="text-[10px]" style={{ color: 'var(--muted-foreground)' }}>{t('analytics.saves')}</div>
        </div>
        <div className="text-center hidden sm:block">
          <div className="text-sm font-bold" style={{ color: 'var(--foreground)' }}>{recipe.reviews}</div>
          <div className="text-[10px]" style={{ color: 'var(--muted-foreground)' }}>{t('analytics.reviews')}</div>
        </div>
        {recipe.avgRating !== null && (
          <div className="text-center">
            <div className="flex items-center gap-0.5">
              <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
              <span className="text-sm font-bold" style={{ color: 'var(--foreground)' }}>
                {recipe.avgRating.toFixed(1)}
              </span>
            </div>
            <div className="text-[10px]" style={{ color: 'var(--muted-foreground)' }}>{t('analytics.rating')}</div>
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
      .catch(() => setError('1'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[1,2,3,4,5].map(i => (
            <div key={i} className="h-28 rounded-[20px]" style={{ background: 'var(--muted)' }} />
          ))}
        </div>
        <div className="h-40 rounded-[20px]" style={{ background: 'var(--muted)' }} />
        <div className="h-64 rounded-[20px]" style={{ background: 'var(--muted)' }} />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="text-center py-10 text-sm" style={{ color: 'var(--muted-foreground)' }}>
        {error ? t('analytics.load_failed') : t('analytics.no_data')}
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
        <TrendingUp className="w-5 h-5" style={{ color: 'var(--primary)' }} />
        <h2 className="text-lg font-semibold" style={{ color: 'var(--foreground)' }}>
          {t('analytics.title')}
        </h2>
      </div>

      {/* Summary cards */}
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
        className="grid grid-cols-2 sm:grid-cols-5 gap-3"
      >
        <SummaryCard icon={<Eye className="w-4 h-4" />}    value={summary.totalViews}   label={t('analytics.total_views')}   color="var(--primary)" />
        <SummaryCard icon={<Heart className="w-4 h-4" />}   value={summary.totalSaves}   label={t('analytics.total_saves')}   color="var(--secondary)" />
        <SummaryCard icon={<Star className="w-4 h-4" />}    value={summary.totalReviews} label={t('analytics.total_reviews')} color="var(--accent)" />
        <SummaryCard icon={<BookOpen className="w-4 h-4" />} value={summary.totalRecipes} label={t('analytics.total_recipes')} color="#5A9FA3" />
        <SummaryCard icon={<Users className="w-4 h-4" />}   value={summary.followerCount} label={t('analytics.followers')}    color="#7A6FA3" />
      </motion.div>

      {!hasRecipes ? (
        <div
          className="rounded-[20px] p-10 text-center"
          style={{ background: 'rgba(74,124,126,0.04)', border: '1px dashed rgba(74,124,126,0.2)' }}
        >
          <ChefHat className="w-10 h-10 mx-auto mb-3 opacity-30" style={{ color: 'var(--primary)' }} />
          <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>{t('analytics.no_recipes')}</p>
        </div>
      ) : (
        <>
          {/* Views chart */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="rounded-[20px] p-5"
            style={{ background: 'var(--card)', border: '1px solid rgba(74,124,126,0.12)' }}
          >
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                {t('analytics.views_last_14')}
              </p>
              <span className="text-xs px-2 py-1 rounded-full"
                style={{ background: 'rgba(74,124,126,0.08)', color: 'var(--primary)' }}>
                {summary.totalViews} {t('analytics.total')}
              </span>
            </div>
            <ViewsAreaChart data={viewsChart} />
          </motion.div>

          {/* Top recipe highlight */}
          {topRecipe && topRecipe.views > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 35 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
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
                <p className="flex items-center gap-1.5 text-xs font-medium mb-0.5" style={{ color: 'var(--secondary)' }}>
                  <Trophy className="w-3.5 h-3.5" />
                  {t('analytics.top_recipe')}
                </p>
                <p className="font-semibold text-sm" style={{ color: 'var(--foreground)' }}>{topRecipe.title}</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                  {topRecipe.views} {t('analytics.views')} · {topRecipe.saves} {t('analytics.saves')} · {topRecipe.reviews} {t('analytics.reviews')}
                </p>
              </div>
            </motion.div>
          )}

          {/* Recipe table */}
          <motion.div
            initial={{ opacity: 0, y: 35 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="rounded-[20px] overflow-hidden"
            style={{ background: 'var(--card)', border: '1px solid rgba(74,124,126,0.12)' }}
          >
            {/* Table header + sort */}
            <div
              className="flex items-center justify-between px-4 py-3"
              style={{ borderBottom: '1px solid rgba(74,124,126,0.1)' }}
            >
              <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                {t('analytics.recipe_performance')}
              </p>
              <div className="flex gap-1">
                {(['views', 'saves', 'reviews', 'rating'] as const).map(key => (
                  <button
                    key={key}
                    onClick={() => setSortBy(key)}
                    className="text-xs px-2.5 py-1 rounded-full transition-colors capitalize"
                    style={{
                      background: sortBy === key ? 'var(--primary)' : 'rgba(74,124,126,0.08)',
                      color: sortBy === key ? '#fff' : 'var(--primary)',
                    }}
                  >
                    {t(`analytics.${key}`)}
                  </button>
                ))}
              </div>
            </div>

            {/* Comparison bar chart */}
            <div className="px-4 pt-4">
              <RecipesBarChart recipes={recipeStats} />
            </div>

            <div className="p-3 space-y-1">
              {sorted.map((recipe, i) => (
                <RecipeRow key={recipe.id} recipe={recipe} rank={i + 1} />
              ))}
            </div>
          </motion.div>
        </>
      )}
    </div>
  );
}
