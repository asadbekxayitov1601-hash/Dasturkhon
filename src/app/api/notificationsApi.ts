import { authFetch } from '../auth/authFetch';

export interface AppNotification {
  id: number;
  type: string;
  actorId: number;
  actorName?: string | null;
  recipeId?: number | null;
  recipeTitle?: string | null;
  read: boolean;
  createdAt: string;
}

export async function getNotifications(): Promise<{ items: AppNotification[]; unread: number }> {
  const res = await authFetch('/api/notifications');
  if (!res.ok) throw new Error('Failed to load notifications');
  return res.json();
}

export async function markNotificationsRead(): Promise<void> {
  await authFetch('/api/notifications/read', { method: 'POST' });
}
