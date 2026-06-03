import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/AuthProvider';
import { createRecipe } from '../api/recipesApi';
import { ListInput } from './ListInput';
import { X, Plus, Loader2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

interface SubmitRecipeModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export function SubmitRecipeModal({ isOpen, onClose, onSuccess }: SubmitRecipeModalProps) {
    const { t } = useTranslation();
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        title: '',
        image: '',
        cookTime: '',
        servings: 4,
        price: 0,
        category: 'main',
        youtubeUrl: '',
        ingredients: [''] as string[],
        instructions: [''] as string[]
    });
    const [imageMode, setImageMode] = useState<'url' | 'upload'>('url');
    const [previewImage, setPreviewImage] = useState<string>('');

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 5 * 1024 * 1024) {
            toast.error('Image size must be less than 5MB');
            return;
        }

        const reader = new FileReader();
        reader.onloadend = () => {
            const base64 = reader.result as string;
            setFormData({ ...formData, image: base64 });
            setPreviewImage(base64);
        };
        reader.readAsDataURL(file);
    };

    const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const url = e.target.value;
        setFormData({ ...formData, image: url });
        setPreviewImage(url);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            setLoading(true);
            const ingredients = formData.ingredients.map(s => s.trim()).filter(Boolean);
            const instructions = formData.instructions.map(s => s.trim()).filter(Boolean);

            if (ingredients.length === 0) { toast.error('Add at least one ingredient'); setLoading(false); return; }
            if (instructions.length === 0) { toast.error('Add at least one instruction'); setLoading(false); return; }

            await createRecipe({
                ...formData,
                ingredients,
                instructions
            });

            if (user?.isAdmin) {
                toast.success('Recipe created successfully');
            } else {
                toast.success('Recipe submitted for approval');
            }

            setFormData({
                title: '',
                image: '',
                cookTime: '',
                servings: 4,
                price: 0,
                category: 'main',
                youtubeUrl: '',
                ingredients: [''],
                instructions: ['']
            });
            setPreviewImage('');
            onSuccess();
            onClose();
        } catch (e: any) {
            toast.error(e.message || 'Failed to create recipe');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div
                className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
                onClick={onClose}
            >
                <motion.div
                    onClick={(e) => e.stopPropagation()}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-xl"
                >
                    <div className="sticky top-0 bg-white p-4 border-b flex items-center justify-between z-10">
                        <h2 className="text-xl font-semibold flex items-center gap-2">
                            <Plus className="w-5 h-5 text-primary" /> {user?.isAdmin ? 'Create New Recipe' : 'Submit New Recipe'}
                        </h2>
                        <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                            <X className="w-5 h-5 text-gray-500" />
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="p-6 space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                            <input
                                required
                                type="text"
                                value={formData.title}
                                onChange={e => setFormData({ ...formData, title: e.target.value })}
                                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none"
                                placeholder="e.g. Traditional Palov"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Recipe Image</label>
                            <div className="flex bg-gray-100 p-1 rounded-xl mb-3 w-fit">
                                <button
                                    type="button"
                                    onClick={() => setImageMode('url')}
                                    className={`relative px-4 py-2 text-sm font-medium transition-colors z-0 ${imageMode === 'url' ? 'text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                                >
                                    {imageMode === 'url' && (
                                        <motion.div
                                            layoutId="activeImageMode"
                                            className="absolute inset-0 bg-white rounded-lg shadow-sm -z-10"
                                            transition={{ type: "spring", stiffness: 500, damping: 30 }}
                                        />
                                    )}
                                    Image URL
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setImageMode('upload')}
                                    className={`relative px-4 py-2 text-sm font-medium transition-colors z-0 ${imageMode === 'upload' ? 'text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                                >
                                    {imageMode === 'upload' && (
                                        <motion.div
                                            layoutId="activeImageMode"
                                            className="absolute inset-0 bg-white rounded-lg shadow-sm -z-10"
                                            transition={{ type: "spring", stiffness: 500, damping: 30 }}
                                        />
                                    )}
                                    Upload File
                                </button>
                            </div>

                            {imageMode === 'url' ? (
                                <input
                                    required={!formData.image}
                                    type="url"
                                    value={imageMode === 'url' ? formData.image : ''}
                                    onChange={handleUrlChange}
                                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none"
                                    placeholder="https://example.com/image.jpg"
                                />
                            ) : (
                                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:bg-gray-50 transition-colors">
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={handleImageUpload}
                                        className="hidden"
                                        id="recipe-image-upload"
                                    />
                                    <label htmlFor="recipe-image-upload" className="cursor-pointer flex flex-col items-center gap-2">
                                        <Upload className="w-8 h-8 text-gray-400" />
                                        <span className="text-sm text-gray-600">Click to upload image (max 5MB)</span>
                                    </label>
                                </div>
                            )}

                            {previewImage && (
                                <div className="mt-3 relative h-40 w-full rounded-lg overflow-hidden bg-gray-100 border">
                                    <img src={previewImage} alt="Preview" className="w-full h-full object-cover" />
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setFormData({ ...formData, image: '' });
                                            setPreviewImage('');
                                        }}
                                        className="absolute top-2 right-2 p-1 bg-black/50 text-white rounded-full hover:bg-black/70 transition-colors"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            )}
                        </div>
                        <div className="grid grid-cols-2 gap-4">
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
                                <label className="block text-sm font-medium text-gray-700 mb-1">{t('recipes.price_label')}</label>
                                <input
                                    type="number"
                                    min="0"
                                    step="1000"
                                    placeholder="0"
                                    value={formData.price === 0 ? '' : formData.price}
                                    onChange={e => {
                                        const v = e.target.value;
                                        setFormData({ ...formData, price: v === '' ? 0 : Math.max(0, Math.floor(Number(v) || 0)) });
                                    }}
                                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none"
                                />
                                <p className="text-[11px] text-gray-400 mt-1">{t('recipes.price_hint')}</p>
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                            <select
                                value={formData.category}
                                onChange={e => setFormData({ ...formData, category: e.target.value })}
                                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none"
                            >
                                <option value="main">{t('categories.main')}</option>
                                <option value="breakfast">{t('categories.breakfast')}</option>
                                <option value="appetizer">{t('categories.appetizer')}</option>
                                <option value="soup">{t('categories.soup')}</option>
                                <option value="dessert">{t('categories.dessert')}</option>
                                <option value="salad">{t('categories.salad')}</option>
                                <option value="bread">{t('categories.bread')}</option>
                                <option value="drink">{t('categories.drink')}</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">YouTube URL (optional)</label>
                            <input
                                type="url"
                                placeholder="https://youtube.com/watch?v=..."
                                value={formData.youtubeUrl}
                                onChange={e => setFormData({ ...formData, youtubeUrl: e.target.value })}
                                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Ingredients</label>
                            <ListInput
                                items={formData.ingredients}
                                onChange={items => setFormData({ ...formData, ingredients: items })}
                                placeholder="e.g. 2 cups rice"
                                addLabel="Add ingredient"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Instructions</label>
                            <ListInput
                                items={formData.instructions}
                                onChange={items => setFormData({ ...formData, instructions: items })}
                                placeholder="Describe this step…"
                                addLabel="Add step"
                            />
                        </div>
                        <div className="pt-2">
                            <motion.button
                                type="submit"
                                disabled={loading}
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                className="w-full py-3 bg-gradient-to-r from-primary to-primary/80 text-white rounded-lg hover:shadow-lg transition-all font-medium disabled:opacity-70 disabled:cursor-not-allowed flex justify-center items-center gap-2"
                            >
                                {loading && <Loader2 className="w-5 h-5 animate-spin" />}
                                {user?.isAdmin ? 'Create Recipe' : 'Submit for Approval'}
                            </motion.button>
                        </div>
                    </form>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
