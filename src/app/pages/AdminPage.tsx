import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { PanLoader } from '../components/PanLoader';
import { useAuth } from '../auth/AuthProvider';
import { getRecipes, createRecipe, deleteRecipe, getPendingRecipes, updateRecipeStatus } from '../api/recipesApi';
import { getAdminPayouts, updatePayout, formatSom, Payout } from '../api/earningsApi';
import { Recipe } from '../types/kitchen';
import { Trash2, Plus, LogOut, Check, X as XIcon, Clock, Wallet } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

export function AdminPage() {
    const { t } = useTranslation();
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [recipes, setRecipes] = useState<Recipe[]>([]);
    const [pendingRecipes, setPendingRecipes] = useState<Recipe[]>([]);
    const [payouts, setPayouts] = useState<Payout[]>([]);
    const [loading, setLoading] = useState(true);

    // Form State
    const [formData, setFormData] = useState({
        title: '',
        image: '',
        cookTime: '',
        servings: 4,
        category: 'main',
        youtubeUrl: '',
        ingredientsStr: '',
        instructionsStr: '',
        isPro: false
    });

    useEffect(() => {
        if (!user?.isAdmin) {
            // redirect handled by protected route usually, but here for safety
            navigate('/');
        } else {
            loadData();
        }
    }, [user]);

    const loadData = async () => {
        try {
            setLoading(true);
            const [allRecipes, pending, payoutList] = await Promise.all([
                getRecipes(),
                getPendingRecipes(),
                getAdminPayouts().catch(() => []),
            ]);
            setRecipes(allRecipes);
            setPendingRecipes(pending);
            setPayouts(payoutList);
        } catch (e: any) {
            toast.error('Failed to load data');
        } finally {
            setLoading(false);
        }
    };

    const handlePayout = async (id: number, action: 'mark-paid' | 'reject') => {
        try {
            await updatePayout(id, action);
            setPayouts(prev => prev.map(p => p.id === id ? { ...p, status: action === 'mark-paid' ? 'paid' : 'rejected' } : p));
            toast.success(action === 'mark-paid' ? t('earnings.marked_paid') : t('earnings.request_rejected'));
        } catch (e: any) {
            toast.error('Failed to update payout');
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const ingredients = formData.ingredientsStr.split('\n').filter(s => s.trim());
            const instructions = formData.instructionsStr.split('\n').filter(s => s.trim());

            await createRecipe({
                ...formData,
                ingredients,
                instructions,
                isPro: formData.isPro
            });

            toast.success('Recipe created!');
            setFormData({
                title: '',
                image: '',
                cookTime: '',
                servings: 4,
                category: 'main',
                youtubeUrl: '',
                ingredientsStr: '',
                instructionsStr: '',
                isPro: false
            });
            loadData();
        } catch (e: any) {
            toast.error(e.message || 'Failed to create recipe');
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this recipe?')) return;
        try {
            await deleteRecipe(id);
            setRecipes(recipes.filter(r => r.id !== id));
            toast.success('Recipe deleted');
        } catch (e: any) {
            toast.error('Failed to delete recipe');
        }
    };

    const handleApprove = async (id: string, isPro: boolean) => {
        try {
            await updateRecipeStatus(id, 'approved', isPro);
            toast.success(`Recipe approved as ${isPro ? 'Pro' : 'Free'}`);
            loadData();
        } catch (e: any) {
            toast.error('Failed to approve recipe');
        }
    };

    const handleReject = async (id: string) => {
        if (!confirm('Are you sure you want to reject this recipe?')) return;
        try {
            await updateRecipeStatus(id, 'rejected');
            toast.success('Recipe rejected');
            loadData();
        } catch (e: any) {
            toast.error('Failed to reject recipe');
        }
    };

    if (!user || !user.isAdmin) {
        return null; // or redirect
    }

    return (
        <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
            <div className="max-w-7xl mx-auto">
                <div className="flex justify-between items-center mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
                        <p className="text-gray-500">Manage recipes and approvals</p>
                    </div>
                    <div className="flex gap-4">
                        <button onClick={() => navigate('/')} className="text-gray-600 hover:text-gray-900 font-medium">Back to Site</button>
                        <button onClick={logout} className="flex items-center gap-2 text-red-600 hover:text-red-700 bg-red-50 px-4 py-2 rounded-lg transition-colors">
                            <LogOut className="w-4 h-4" /> Logout
                        </button>
                    </div>
                </div>

                {/* Payout Requests Section */}
                <div className="mb-12">
                    <h2 className="text-xl font-semibold mb-4 flex items-center gap-2 text-primary">
                        <Wallet className="w-5 h-5" /> {t('earnings.payout_requests')}
                        {payouts.filter(p => p.status === 'requested').length > 0 && (
                            <span className="text-sm font-normal text-gray-500">
                                ({payouts.filter(p => p.status === 'requested').length} {t('earnings.pending').toLowerCase()})
                            </span>
                        )}
                    </h2>
                    {payouts.length === 0 ? (
                        <p className="text-gray-500 text-sm bg-white rounded-xl border border-gray-100 p-6">{t('earnings.no_payout_requests')}</p>
                    ) : (
                        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden divide-y divide-gray-50">
                            {payouts.map(p => (
                                <div key={p.id} className="flex flex-wrap items-center gap-3 p-4">
                                    <div className="flex-1 min-w-0">
                                        <p className="font-semibold text-gray-900">{formatSom(p.amount)}</p>
                                        <p className="text-sm text-gray-500 truncate">
                                            {p.creator?.name || p.creator?.email || `User #${p.creatorId}`}
                                            {p.creator?.email && p.creator?.name ? ` · ${p.creator.email}` : ''}
                                            {' · '}{new Date(p.requestedAt).toLocaleDateString()}
                                        </p>
                                    </div>
                                    {p.status === 'requested' ? (
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => handlePayout(p.id, 'mark-paid')}
                                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-50 text-green-700 hover:bg-green-100 text-sm font-medium transition-colors"
                                            >
                                                <Check className="w-4 h-4" /> {t('earnings.mark_paid')}
                                            </button>
                                            <button
                                                onClick={() => handlePayout(p.id, 'reject')}
                                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 text-sm font-medium transition-colors"
                                            >
                                                <XIcon className="w-4 h-4" /> {t('earnings.reject')}
                                            </button>
                                        </div>
                                    ) : (
                                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${p.status === 'paid' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                            {p.status === 'paid' ? t('earnings.status_paid') : t('earnings.status_rejected')}
                                        </span>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Pending Approvals Section */}
                {pendingRecipes.length > 0 && (
                    <div className="mb-12">
                        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2 text-orange-600">
                            <Clock className="w-5 h-5" /> Pending Approvals ({pendingRecipes.length})
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            <AnimatePresence>
                                {pendingRecipes.map(recipe => (
                                    <motion.div
                                        layout
                                        initial={{ opacity: 0, scale: 0.9 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.9 }}
                                        key={recipe.id}
                                        className="bg-white rounded-xl shadow-sm border border-orange-100 overflow-hidden flex flex-col relative"
                                    >
                                        <div className="absolute top-2 left-2 bg-orange-100 text-orange-700 px-2 py-1 rounded text-xs font-bold uppercase tracking-wider z-10">
                                            Pending
                                        </div>
                                        <div className="h-48 overflow-hidden relative">
                                            <img src={recipe.image} alt={recipe.title} className="w-full h-full object-cover" />
                                            <div className="absolute top-2 right-2 bg-white/90 backdrop-blur px-2 py-1 rounded text-xs font-medium uppercase tracking-wider text-gray-700">
                                                {recipe.category}
                                            </div>
                                        </div>
                                        <div className="p-4 flex-1 flex flex-col">
                                            <h3 className="font-semibold text-lg text-gray-900 mb-1">{recipe.title}</h3>
                                            <div className="text-sm text-gray-500 mb-4 flex items-center gap-3">
                                                <span>{recipe.cookTime}</span>
                                            </div>

                                            {recipe.user && (
                                                <div className="text-xs text-gray-400 mb-4">
                                                    Submitted by: {(recipe as any).user.name || 'Unknown'}
                                                </div>
                                            )}

                                            <div className="mt-auto flex flex-col gap-2">
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => handleApprove(recipe.id, false)}
                                                        className="flex-1 py-1.5 bg-green-50 text-green-700 rounded hover:bg-green-100 text-xs font-medium border border-green-200"
                                                    >
                                                        Free
                                                    </button>
                                                    <button
                                                        onClick={() => handleApprove(recipe.id, true)}
                                                        className="flex-1 py-1.5 bg-purple-50 text-purple-700 rounded hover:bg-purple-100 text-xs font-medium border border-purple-200"
                                                    >
                                                        Pro
                                                    </button>
                                                </div>
                                                <button
                                                    onClick={() => handleReject(recipe.id)}
                                                    className="flex-1 flex items-center justify-center gap-2 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors font-medium"
                                                >
                                                    <XIcon className="w-4 h-4" /> Reject
                                                </button>
                                            </div>
                                        </div>
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Create Form */}
                    <div className="lg:col-span-1">
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 sticky top-8">
                            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                                <Plus className="w-5 h-5 text-primary" /> Quick Add Recipe
                            </h2>
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                                    <input
                                        required
                                        type="text"
                                        value={formData.title}
                                        onChange={e => setFormData({ ...formData, title: e.target.value })}
                                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Image URL</label>
                                    <input
                                        required
                                        type="url"
                                        value={formData.image}
                                        onChange={e => setFormData({ ...formData, image: e.target.value })}
                                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Cook Time</label>
                                    <input
                                        required
                                        type="text"
                                        placeholder="e.g. 45 min"
                                        value={formData.cookTime}
                                        onChange={e => setFormData({ ...formData, cookTime: e.target.value })}
                                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                                    <select
                                        value={formData.category}
                                        onChange={e => setFormData({ ...formData, category: e.target.value })}
                                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none"
                                    >
                                        <option value="main">Main</option>
                                        <option value="breakfast">Breakfast</option>
                                        <option value="appetizer">Appetizer</option>
                                        <option value="soup">Soup</option>
                                        <option value="dessert">Dessert</option>
                                        <option value="salad">Salad</option>
                                        <option value="bread">Bread</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">YouTube URL (optional)</label>
                                    <input
                                        type="url"
                                        placeholder="https://youtube.com/..."
                                        value={formData.youtubeUrl}
                                        onChange={e => setFormData({ ...formData, youtubeUrl: e.target.value })}
                                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none"
                                    />
                                </div>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        id="isPro"
                                        checked={formData.isPro}
                                        onChange={e => setFormData({ ...formData, isPro: e.target.checked })}
                                        className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
                                    />
                                    <label htmlFor="isPro" className="text-sm font-medium text-gray-700">Pro Recipe</label>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Ingredients (one per line)</label>
                                    <textarea
                                        required
                                        rows={5}
                                        value={formData.ingredientsStr}
                                        onChange={e => setFormData({ ...formData, ingredientsStr: e.target.value })}
                                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none font-mono text-sm"
                                        placeholder="2 cups Rice&#10;1 Onion"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Instructions (one per line)</label>
                                    <textarea
                                        required
                                        rows={5}
                                        value={formData.instructionsStr}
                                        onChange={e => setFormData({ ...formData, instructionsStr: e.target.value })}
                                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none font-mono text-sm"
                                        placeholder="Chop onions...&#10;Fry meat..."
                                    />
                                </div>
                                <button type="submit" className="w-full py-3 bg-gradient-to-r from-primary to-primary/80 text-white rounded-lg hover:shadow-lg transition-all font-medium">
                                    Create Recipe
                                </button>
                            </form>
                        </div>
                    </div>

                    {/* Recipe List */}
                    <div className="lg:col-span-2 space-y-6">
                        <div className="flex items-center justify-between">
                            <h2 className="text-xl font-semibold">Published Recipes ({recipes.length})</h2>
                        </div>
                        {loading ? (
                            <div className="flex justify-center py-12">
                                <PanLoader />
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {recipes.map(recipe => (
                                    <motion.div
                                        key={recipe.id}
                                        layout
                                        className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col"
                                    >
                                        <div className="h-48 overflow-hidden relative">
                                            <img src={recipe.image} alt={recipe.title} className="w-full h-full object-cover" />
                                            <div className="absolute top-2 right-2 bg-white/90 backdrop-blur px-2 py-1 rounded text-xs font-medium uppercase tracking-wider">
                                                {recipe.category}
                                            </div>
                                        </div>
                                        <div className="p-4 flex-1 flex flex-col">
                                            <h3 className="font-semibold text-lg text-gray-900 mb-1">{recipe.title}</h3>
                                            <div className="text-sm text-gray-500 mb-4 flex items-center gap-3">
                                                <span>{recipe.cookTime}</span>
                                            </div>
                                            <div className="mt-auto flex justify-end">
                                                <button
                                                    onClick={() => handleDelete(recipe.id)}
                                                    className="p-2 text-red-500 hover:bg-red-50 rounded-full transition-colors"
                                                    title="Delete Recipe"
                                                >
                                                    <Trash2 className="w-5 h-5" />
                                                </button>
                                            </div>
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
