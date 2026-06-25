// src/app/api/chefApi.ts

import { authFetch } from '../auth/authFetch';
import { config } from '../config';

const API = config.apiBaseUrl;

export interface SocialLinks {
  instagram?: string;
  telegram?: string;
  youtube?: string;
  tiktok?: string;
  facebook?: string;
  website?: string;
}

export interface ChefProfile {
  id: number;
  name: string | null;
  email: string;
  bio: string | null;
  avatarUrl: string | null;
  socialLinks?: SocialLinks;
  isPro: boolean;
  createdAt: string;
  recipes: ChefRecipe[];
  followerCount: number;
  followingCount: number;
  recipeCount: number;
  avgRating: number;   // chef's overall rating across all approved recipes (0 if none)
  reviewCount: number; // total reviews across all approved recipes
}

export interface ChefRecipe {
  id: string;
  title: string;
  image: string;
  cookTime: string;
  servings: number;
  category: string;
  ingredients: string[];
  instructions: string[];
  youtubeUrl?: string | null;
  isPro: boolean;
  orderable?: boolean;
  orderPhone?: string | null;
  createdAt: string;
  reviewCount: number;
  avgRating: number | null;
}

// Aggregate stats for a single chef (used by the recipe modal).
export interface ChefStats {
  recipeCount: number;
  reviewCount: number;
  followerCount: number;
  avgRating: number;
}

// One row of the chefs leaderboard / rating page.
export interface ChefLeaderboardEntry {
  id: number;
  name: string | null;
  email: string;
  avatarUrl: string | null;
  bio: string | null;
  isPro: boolean;
  recipeCount: number;
  reviewCount: number;
  followerCount: number;
  avgRating: number;
}

export type ChefSort = 'recipes' | 'rating' | 'followers';

export async function getChefLeaderboard(sort: ChefSort = 'recipes'): Promise<ChefLeaderboardEntry[]> {
  const res = await fetch(`${API}/api/chefs?sort=${encodeURIComponent(sort)}`);
  if (!res.ok) throw new Error('Failed to load chefs');
  return res.json();
}

export async function getChefStats(chefId: number | string): Promise<ChefStats> {
  const res = await fetch(`${API}/api/chefs/${chefId}/stats`);
  if (!res.ok) throw new Error('Failed to load chef stats');
  return res.json();
}

export interface UserLite {
  id: number;
  name: string | null;
  email: string;
  avatarUrl: string | null;
  bio: string | null;
  isFollowing: boolean;
  isSelf: boolean;
}

export async function getFollowers(chefId: number | string): Promise<UserLite[]> {
  const res = await authFetch(`/api/chefs/${chefId}/followers`);
  if (!res.ok) throw new Error('Failed to load followers');
  return res.json();
}

export async function getFollowing(chefId: number | string): Promise<UserLite[]> {
  const res = await authFetch(`/api/chefs/${chefId}/following`);
  if (!res.ok) throw new Error('Failed to load following');
  return res.json();
}

export async function getChefProfile(chefId: number | string): Promise<ChefProfile> {
  const res = await fetch(`${API}/api/chefs/${chefId}`);
  if (!res.ok) throw new Error('Chef not found');
  return res.json();
}

export async function getFollowStatus(chefId: number | string): Promise<boolean> {
  const res = await authFetch(`/api/chefs/${chefId}/follow-status`);
  if (!res.ok) return false;
  const data = await res.json();
  return data.isFollowing;
}

export async function followChef(chefId: number | string): Promise<number> {
  const res = await authFetch(`/api/chefs/${chefId}/follow`, { method: 'POST' });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message);
  return data.followerCount;
}

export async function unfollowChef(chefId: number | string): Promise<number> {
  const res = await authFetch(`/api/chefs/${chefId}/follow`, { method: 'DELETE' });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message);
  return data.followerCount;
}

export async function deleteAccount(): Promise<void> {
  const res = await authFetch('/api/account', { method: 'DELETE' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Failed to delete account');
  }
}

export async function updateProfile(data: {
  name?: string;
  bio?: string;
  avatarUrl?: string;
  socialLinks?: SocialLinks;
}): Promise<void> {
  const res = await authFetch('/api/profile', {
    method: 'PUT',
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message || 'Failed to update profile');
  }
}
