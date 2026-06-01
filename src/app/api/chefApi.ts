// src/app/api/chefApi.ts

import { authFetch } from '../auth/authFetch';
import { config } from '../config';

const API = config.apiBaseUrl;

export interface ChefProfile {
  id: number;
  name: string | null;
  email: string;
  bio: string | null;
  avatarUrl: string | null;
  isPro: boolean;
  createdAt: string;
  recipes: ChefRecipe[];
  followerCount: number;
  followingCount: number;
  recipeCount: number;
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
  createdAt: string;
  reviewCount: number;
  avgRating: number | null;
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

export async function updateProfile(data: {
  name?: string;
  bio?: string;
  avatarUrl?: string;
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
