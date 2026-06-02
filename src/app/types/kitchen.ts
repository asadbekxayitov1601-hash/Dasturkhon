export type IngredientStatus = 'in-stock' | 'low' | 'out';

export interface PantryItem {
  id: string;
  name: string;
  status: IngredientStatus;
  category: string;
  quantity?: string;
}

export interface Recipe {
  id: string;
  title: string;
  image: string;
  cookTime?: string;
  servings?: number;
  ingredients?: string[];
  instructions?: string[];
  category?: string;
  youtubeUrl?: string;
  status?: 'pending' | 'approved' | 'rejected';
  userId?: number;
  isPro?: boolean;
  price?: number;   // 0 = free, otherwise price in so'm (UZS)
  locked?: boolean; // true when paid and the current viewer hasn't unlocked it
  user?: { name?: string | null; email?: string };
  createdAt?: string;
}

export interface ShoppingListItem {
  id: string;
  name: string;
  quantity: string;
  recipeId?: string;
  recipeName?: string;
  checked: boolean;
}

export interface MarketUpdate {
  id: string;
  location: string;
  item: string;
  message: string;
}
