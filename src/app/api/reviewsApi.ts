import { authFetch } from '../auth/authFetch';
import { config } from '../config';

const API = config.apiBaseUrl;

export interface Review {
  id: number;
  userId: number;
  recipeId: number;
  rating: number;
  comment?: string | null;
  photoUrl?: string | null;
  createdAt: string;
  user: {
    id: number;
    name?: string | null;
    email: string;
  };
}

export interface CreateReviewPayload {
  rating: number;
  comment?: string;
  photoUrl?: string;
}

// Public — no auth needed, but uses full base URL
export async function getRecipeReviews(recipeId: string | number): Promise<Review[]> {
  const res = await fetch(`${API}/api/recipes/${recipeId}/reviews`);
  if (!res.ok) throw new Error('Failed to load reviews');
  return res.json();
}

// Requires auth
export async function getMyReview(recipeId: string | number): Promise<Review | null> {
  const res = await authFetch(`/api/recipes/${recipeId}/reviews/me`);
  if (!res.ok) return null;
  return res.json();
}

export async function createReview(
  recipeId: string | number,
  payload: CreateReviewPayload
): Promise<Review> {
  const res = await authFetch(`/api/recipes/${recipeId}/reviews`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to submit review');
  return data;
}

export async function updateReview(
  reviewId: number,
  payload: Partial<CreateReviewPayload>
): Promise<Review> {
  const res = await authFetch(`/api/reviews/${reviewId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to update review');
  return data;
}

export async function deleteReview(reviewId: number): Promise<void> {
  const res = await authFetch(`/api/reviews/${reviewId}`, { method: 'DELETE' });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.message || 'Failed to delete review');
  }
}

export function averageRating(reviews: Review[]): number {
  if (!reviews.length) return 0;
  return reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
}
