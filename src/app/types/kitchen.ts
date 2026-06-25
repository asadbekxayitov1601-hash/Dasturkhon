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
  orderable?: boolean;   // chef takes direct orders for this dish
  orderPhone?: string | null; // phone for the call-to-order link (orderable only)
  rating?: number;       // average review rating (0 if none)
  reviewCount?: number;  // number of reviews
  user?: { id?: number; name?: string | null; email?: string; avatarUrl?: string | null; rating?: number; reviewCount?: number };
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
