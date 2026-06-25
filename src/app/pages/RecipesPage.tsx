import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Filter, Plus, Clock, ChefHat } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Recipe } from '../types/kitchen';
import { getRecipes, getFavorites, addFavorite, removeFavorite, deleteRecipe } from '../api/recipesApi';
import { RecipeCard } from '../components/RecipeCard';
import { RecipeDetailModal } from '../components/RecipeDetailModal';
import { SubmitRecipeModal } from '../components/SubmitRecipeModal';
import { PanLoader } from '../components/PanLoader';
import { toast } from 'sonner';
import { useAuth } from '../auth/AuthProvider';
import { motion } from 'framer-motion';

export function RecipesPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();

  // The Add Recipe button is always visible; logged-out users are sent to the
  // login page (and returned here afterwards) instead of opening the form.
  const handleAddRecipe = () => {
    if (!user) {
      try { sessionStorage.setItem('redirectAfterLogin', '/recipes'); } catch { /* ignore */ }
      navigate('/login');
      return;
    }
    setIsSubmitModalOpen(true);
  };
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [isRecipeModalOpen, setIsRecipeModalOpen] = useState(false);
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);

  useEffect(() => {
    loadData();
  }, [user]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [recipesData, favoritesData] = await Promise.all([
        getRecipes(),
        user ? getFavorites() : Promise.resolve([])
      ]);
      setRecipes(recipesData);
      setFavorites(new Set(favoritesData.map(r => r.id)));
    } catch (e) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleFavorite = async (recipe: Recipe) => {
    if (!user) {
      toast.error('Please login to save favorites');
      return;
    }

    const wasFavorite = favorites.has(recipe.id);
    // Optimistic update: flip the heart immediately for instant feedback.
    setFavorites((prev) => {
      const next = new Set(prev);
      if (wasFavorite) next.delete(recipe.id);
      else next.add(recipe.id);
      return next;
    });

    try {
      if (wasFavorite) {
        await removeFavorite(recipe.id);
        toast.success(`Removed "${recipe.title}" from favorites`);
      } else {
        await addFavorite(recipe.id);
        toast.success(`Added "${recipe.title}" to favorites`);
      }
    } catch (e) {
      // Revert on failure.
      setFavorites((prev) => {
        const next = new Set(prev);
        if (wasFavorite) next.add(recipe.id);
        else next.delete(recipe.id);
        return next;
      });
      toast.error('Failed to update favorite');
    }
  };

  const handleDeleteRecipe = async (recipe: Recipe) => {
    const prev = recipes;
    setRecipes((curr) => curr.filter((r) => r.id !== recipe.id));
    try {
      await deleteRecipe(recipe.id);
      toast.success(t('recipes.deleted'));
    } catch (e) {
      setRecipes(prev);
      toast.error(t('recipes.delete_failed'));
    }
  };

  const categories = ['all', ...Array.from(new Set(recipes.map((r) => r.category).filter((c): c is string => !!c)))];

  const filteredRecipes = recipes.filter((recipe) => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      q === '' ||
      recipe.title.toLowerCase().includes(q) ||
      (recipe.category?.toLowerCase() || '').includes(q) ||
      (recipe.user?.name?.toLowerCase() || '').includes(q) ||
      (recipe.ingredients || []).some((ing) => ing.toLowerCase().includes(q));

    const matchesCategory = selectedCategory === 'all' || recipe.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  const recentRecipes = recipes.slice(0, 4);

  const handleViewRecipe = (recipe: Recipe) => {
    setSelectedRecipe(recipe);
    setIsRecipeModalOpen(true);
  };

  const handleAddToShoppingList = (recipe: Recipe) => {
    // TODO: Implement adding recipe ingredients to shopping list via API
    const ingredientCount = recipe.ingredients?.length || 0;
    toast.success(`${ingredientCount} ingredients from "${recipe.title}" ready to add`, {
      description: 'Go to Shopping List to add them',
    });
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 animate-fade-up">
          <div>
            <h1 className="text-3xl sm:text-4xl text-foreground mb-2">{t('recipes.title')}</h1>
            <p className="text-muted-foreground">
              {t('recipes.subtitle')}
            </p>
          </div>

          <button
            onClick={handleAddRecipe}
            className="flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-xl hover:bg-primary/90 transition-colors shadow-lg hover:shadow-xl transform hover:-translate-y-1"
          >
            <Plus className="w-5 h-5" />
            <span>{t('recipes.add', 'Add Recipe')}</span>
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <PanLoader />
          </div>
        ) : (
          <>
            {/* Recent Recipes Section */}
            {recentRecipes.length > 0 && searchQuery === '' && selectedCategory === 'all' && (
              <div className="mb-12">
                <div className="flex items-center gap-2 mb-6">
                  <Clock className="w-5 h-5 text-secondary" />
                  <h2 className="text-xl font-semibold text-foreground">{t('recipes.new_arrivals')}</h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  {recentRecipes.map((recipe, idx) => (
                    <motion.div
                      key={`recent-${recipe.id}`}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.1 }}
                    >
                      <RecipeCard
                        recipe={recipe}
                        isFavorite={favorites.has(recipe.id)}
                        onAddToShoppingList={handleAddToShoppingList}
                        onViewRecipe={handleViewRecipe}
                        onToggleFavorite={handleToggleFavorite}
                        onDelete={handleDeleteRecipe}
                      />
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {/* Search and Filters */}
            <div className="mb-8 space-y-4 animate-fade-up stagger-2">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder={t('recipes.search_placeholder')}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 rounded-[20px] bg-card text-foreground border border-primary/20 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>
                <button className="flex items-center justify-center gap-2 px-5 py-3 rounded-[16px] bg-card border border-primary/20 hover:bg-primary/5 transition-colors sm:w-auto">
                  <Filter className="w-4 h-4 text-primary" />
                  <span className="text-sm text-foreground">{t('recipes.filters')}</span>
                </button>
              </div>

              {/* Category Pills */}
              <div className="flex flex-wrap gap-2">
                {categories.map((category) => (
                  <button
                    key={category}
                    onClick={() => setSelectedCategory(category)}
                    className={`px-4 py-2 rounded-[16px] text-sm transition-all ${selectedCategory === category
                      ? 'bg-gradient-to-r from-primary to-primary/80 text-white shadow-md'
                      : 'bg-card border border-primary/20 text-foreground hover:bg-primary/5'
                      }`}
                  >
                    {t(`categories.${category}`, category.charAt(0).toUpperCase() + category.slice(1))}
                  </button>
                ))}
              </div>
            </div>

            {/* Results Count */}
            <div className="mb-6">
              <p className="text-sm text-muted-foreground">
                {t('recipes.showing')} {filteredRecipes.length} {filteredRecipes.length === 1 ? t('recipes.recipe') : t('recipes.recipes')}
              </p>
            </div>

            {/* Recipe Grid */}
            {filteredRecipes.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                {filteredRecipes.map((recipe) => (
                  <RecipeCard
                    key={recipe.id}
                    recipe={recipe}
                    isFavorite={favorites.has(recipe.id)}
                    onAddToShoppingList={handleAddToShoppingList}
                    onViewRecipe={handleViewRecipe}
                    onToggleFavorite={handleToggleFavorite}
                    onDelete={handleDeleteRecipe}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-16">
                <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
                  <Search className="w-10 h-10 text-muted-foreground" />
                </div>
                <h3 className="text-xl text-foreground mb-2">{t('recipes.no_recipes')}</h3>
                <p className="text-muted-foreground">{t('recipes.adjust_search')}</p>
              </div>
            )}
          </>
        )}
      </div>

      <RecipeDetailModal
        recipe={selectedRecipe}
        isOpen={isRecipeModalOpen}
        onClose={() => setIsRecipeModalOpen(false)}
        onEdited={loadData}
      />

      <SubmitRecipeModal
        isOpen={isSubmitModalOpen}
        onClose={() => setIsSubmitModalOpen(false)}
        onSuccess={loadData}
      />
    </div>
  );
}
