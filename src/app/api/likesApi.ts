import { authFetch } from '../auth/authFetch';

export interface LikesData {
  likes: number;
  dislikes: number;
  userVote: 'like' | 'dislike' | null;
}

export async function getLikes(recipeId: string | number): Promise<LikesData> {
  const res = await fetch(`/api/recipes/${recipeId}/likes`);
  if (!res.ok) throw new Error('Failed to load likes');
  return res.json();
}

export async function voteRecipe(
  recipeId: string | number,
  type: 'like' | 'dislike'
): Promise<LikesData> {
  const res = await authFetch(`/api/recipes/${recipeId}/vote`, {
    method: 'POST',
    body: JSON.stringify({ type }),
  });
  if (!res.ok) throw new Error('Failed to vote');
  return res.json();
}
