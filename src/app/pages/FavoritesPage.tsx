import { useState, useEffect } from 'react';
import Masonry from 'react-responsive-masonry';
import { useTranslation } from 'react-i18next';
import { Recipe } from '../types/kitchen';
import { getFavorites, removeFavorite, deleteRecipe } from '../api/recipesApi';
import { RecipeCard } from '../components/RecipeCard';
import { RecipeDetailModal } from '../components/RecipeDetailModal';
import { toast } from 'sonner';
import { useAuth } from '../auth/AuthProvider';
import { Heart } from 'lucide-react';
import { Link } from 'react-router-dom';

export function FavoritesPage() {
    const { t } = useTranslation();
    const { user } = useAuth();
    const [recipes, setRecipes] = useState<Recipe[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
    const [isRecipeModalOpen, setIsRecipeModalOpen] = useState(false);

    useEffect(() => {
        loadFavorites();
    }, [user]);

    const loadFavorites = async () => {
        if (!user) {
            setLoading(false);
            return;
        }
        try {
            setLoading(true);
            const data = await getFavorites();
            setRecipes(data);
        } catch (e) {
            toast.error(t('favorites.load_failed'));
        } finally {
            setLoading(false);
        }
    };

    const handleToggleFavorite = async (recipe: Recipe) => {
        // Optimistic removal for instant feedback; restore on failure.
        const prev = recipes;
        setRecipes(curr => curr.filter(r => r.id !== recipe.id));
        try {
            await removeFavorite(recipe.id);
            toast.success(t('favorites.removed', { title: recipe.title }));
        } catch (e) {
            setRecipes(prev);
            toast.error(t('favorites.remove_failed'));
        }
    };

    const handleDeleteRecipe = async (recipe: Recipe) => {
        const prev = recipes;
        setRecipes(curr => curr.filter(r => r.id !== recipe.id));
        try {
            await deleteRecipe(recipe.id);
            toast.success(t('recipes.deleted'));
        } catch (e) {
            setRecipes(prev);
            toast.error(t('recipes.delete_failed'));
        }
    };

    const handleViewRecipe = (recipe: Recipe) => {
        setSelectedRecipe(recipe);
        setIsRecipeModalOpen(true);
    };

    const handleAddToShoppingList = (recipe: Recipe) => {
        const ingredientCount = recipe.ingredients?.length || 0;
        toast.success(t('favorites.ingredients_ready', { count: ingredientCount }));
    };

    if (!user) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4">
                <div className="text-center max-w-md">
                    <Heart className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">{t('favorites.login_required')}</h2>
                    <p className="text-gray-600 mb-6">{t('favorites.login_sub')}</p>
                    <Link to="/login" className="px-6 py-3 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition-colors">
                        {t('favorites.sign_in')}
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background">
            <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Page Header */}
                <div className="mb-8 animate-fade-up">
                    <h1 className="text-3xl sm:text-4xl text-gray-900 mb-3 flex items-center gap-3">
                        <Heart className="w-8 h-8 text-red-500 fill-red-500" />
                        {t('favorites.title')}
                    </h1>
                    <p className="text-gray-600">
                        {t('favorites.count', { count: recipes.length })}
                    </p>
                </div>

                {loading ? (
                    <div className="flex justify-center py-20">
                        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
                    </div>
                ) : (
                    <>
                        {/* Recipe Grid */}
                        {recipes.length > 0 ? (
                            <Masonry columnsCount={window.innerWidth < 640 ? 1 : window.innerWidth < 1024 ? 2 : 3} gutter="1.5rem">
                                {recipes.map((recipe) => (
                                    <RecipeCard
                                        key={recipe.id}
                                        recipe={recipe}
                                        isFavorite={true}
                                        onAddToShoppingList={handleAddToShoppingList}
                                        onViewRecipe={handleViewRecipe}
                                        onToggleFavorite={handleToggleFavorite}
                                        onDelete={handleDeleteRecipe}
                                    />
                                ))}
                            </Masonry>
                        ) : (
                            <div className="text-center py-16">
                                <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
                                    <Heart className="w-10 h-10 text-gray-400" />
                                </div>
                                <h3 className="text-xl text-gray-900 mb-2">{t('favorites.empty_title')}</h3>
                                <p className="text-gray-600 mb-6">{t('favorites.empty_sub')}</p>
                                <Link to="/recipes" className="px-6 py-3 bg-white border border-primary/20 text-primary rounded-lg font-medium hover:bg-primary/5 transition-colors">
                                    {t('favorites.browse')}
                                </Link>
                            </div>
                        )}
                    </>
                )}
            </div>

            <RecipeDetailModal
                recipe={selectedRecipe}
                isOpen={isRecipeModalOpen}
                onClose={() => setIsRecipeModalOpen(false)}
            />
        </div>
    );
}
