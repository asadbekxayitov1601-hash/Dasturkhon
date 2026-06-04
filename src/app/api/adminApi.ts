// src/app/api/adminApi.ts

import { authFetch } from '../auth/authFetch';

export interface AdminStats {
  totalUsers: number;
  onlineUsers: number;
  newToday: number;
  newThisWeek: number;
  totalRecipes: number;
  onlineWindowMinutes: number;
}

export async function getAdminStats(): Promise<AdminStats> {
  const res = await authFetch('/api/admin/stats');
  if (!res.ok) throw new Error('Failed to load admin stats');
  return res.json();
}
