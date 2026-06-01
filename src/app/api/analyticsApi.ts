// src/app/api/analyticsApi.ts

import { authFetch } from '../auth/authFetch';
import { config } from '../config';

const API = config.apiBaseUrl;

export interface RecipeStat {
  id: number;
  title: string;
  image: string;
  category: string;
  isPro: boolean;
  createdAt: string;
  views: number;
  saves: number;
  reviews: number;
  avgRating: number | null;
}

export interface ViewsDataPoint {
  date: string;   // "2025-06-01"
  views: number;
}

export interface AnalyticsSummary {
  totalViews: number;
  totalSaves: number;
  totalReviews: number;
  totalRecipes: number;
  followerCount: number;
}

export interface AnalyticsData {
  summary: AnalyticsSummary;
  topRecipe: RecipeStat | null;
  recipeStats: RecipeStat[];
  viewsChart: ViewsDataPoint[];
}

export async function getMyAnalytics(): Promise<AnalyticsData> {
  const res = await authFetch('/api/analytics/my');
  if (!res.ok) throw new Error('Failed to load analytics');
  return res.json();
}

// Call this when a recipe modal opens — fire-and-forget, never throws
export async function recordView(recipeId: string | number): Promise<void> {
  try {
    await fetch(`${API}/api/recipes/${recipeId}/view`, { method: 'POST' });
  } catch (_) {}
}
