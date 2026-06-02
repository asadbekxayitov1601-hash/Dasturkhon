import { authFetch } from '../auth/authFetch';
import { Recipe } from '../types/kitchen';

export interface EarningRow {
  id: number;
  type: 'purchase' | 'tip';
  amount: number;
  recipeTitle: string | null;
  from: string;
  date: string;
}

export interface Payout {
  id: number;
  creatorId: number;
  amount: number;
  status: 'requested' | 'paid' | 'rejected';
  note?: string | null;
  requestedAt: string;
  paidAt?: string | null;
  creator?: { id: number; name?: string | null; email: string };
}

export interface EarningsSummary {
  balance: number;
  totalEarned: number;
  totalPaidOut: number;
  pending: number;
  earnings: EarningRow[];
  payouts: Payout[];
}

export async function getEarnings(): Promise<EarningsSummary> {
  const res = await authFetch('/api/me/earnings');
  if (!res.ok) throw new Error('Failed to load earnings');
  return res.json();
}

export async function requestPayout(amount: number, note?: string): Promise<Payout> {
  const res = await authFetch('/api/payouts/request', {
    method: 'POST',
    body: JSON.stringify({ amount, note }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to request payout');
  return data;
}

// ── Buy / tip ────────────────────────────────────────────────────────────────

export async function buyRecipe(recipeId: string): Promise<{ access: boolean; recipe: Recipe }> {
  const res = await authFetch(`/api/recipes/${recipeId}/buy`, { method: 'POST' });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to unlock recipe');
  return data;
}

export async function tipRecipe(recipeId: string, amount: number): Promise<void> {
  const res = await authFetch(`/api/recipes/${recipeId}/tip`, {
    method: 'POST',
    body: JSON.stringify({ amount }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || 'Failed to send tip');
}

// ── Admin payouts ─────────────────────────────────────────────────────────────

export async function getAdminPayouts(): Promise<Payout[]> {
  const res = await authFetch('/api/admin/payouts');
  if (!res.ok) throw new Error('Failed to load payouts');
  return res.json();
}

export async function updatePayout(id: number, action: 'mark-paid' | 'reject'): Promise<Payout> {
  const res = await authFetch(`/api/admin/payouts/${id}/${action}`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to update payout');
  return res.json();
}

// Format so'm with thousands separators, e.g. 25000 -> "25 000 so'm".
export function formatSom(amount: number): string {
  return `${(amount || 0).toLocaleString('ru-RU').replace(/,/g, ' ')} so'm`;
}
