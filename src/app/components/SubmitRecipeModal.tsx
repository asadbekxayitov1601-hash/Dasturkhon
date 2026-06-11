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
            toast.error(t('recipe_form.image_too_large'));
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

            if (ingredients.length === 0) { toast.error(t('recipe_form.need_ingredient')); setLoading(false); return; }
            if (instructions.length === 0) { toast.error(t('recipe_form.need_instruction')); setLoading(false); return; }

            await createRecipe({
                ...formData,
                ingredients,
                instructions
            });

            if (user?.isAdmin) {
                toast.success(t('recipe_form.created'));
            } else {
                toast.success(t('recipe_form.submitted'));
            }

            setFormData({
                title: '',
                image: '',
                cookTime: '',
                servings: 4,
                category: 'main',
                youtubeUrl: '',
                ingredients: [''],
                instructions: ['']
            });
            setPreviewImage('');
            onSuccess();
            onClose();
        } catch (e: any) {
            toast.error(e.message || t('recipe_form.create_failed'));
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
                            <Plus className="w-5 h-5 text-primary" /> {user?.isAdmin ? t('recipe_form.create_title') : t('recipe_form.submit_title')}
                        </h2>
                        <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                            <X className="w-5 h-5 text-gray-500" />
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="p-6 space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">{t('recipe_form.title')}</label>
                            <input
                                required
                                type="text"
                                value={formData.title}
                                onChange={e => setFormData({ ...formData, title: e.target.value })}
                                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none"
                                placeholder={t('recipe_form.title_ph')}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">{t('recipe_form.image')}</label>
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
                                    {t('recipe_form.image_url')}
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
                                    {t('recipe_form.upload_file')}
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
                                        <span className="text-sm text-gray-600">{t('recipe_form.upload_hint')}</span>
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
                        <div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">{t('recipe_form.cook_time')}</label>
                                <input
                                    required
                                    type="text"
                                    placeholder={t('recipe_form.cook_time_ph')}
                                    value={formData.cookTime}
                                    onChange={e => setFormData({ ...formData, cookTime: e.target.value })}
                                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">{t('recipe_form.category')}</label>
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
                            <label className="block text-sm font-medium text-gray-700 mb-1">{t('recipe_form.youtube')}</label>
                            <input
                                type="url"
                                placeholder="https://youtube.com/watch?v=..."
                                value={formData.youtubeUrl}
                                onChange={e => setFormData({ ...formData, youtubeUrl: e.target.value })}
                                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">{t('recipe_form.ingredients')}</label>
                            <ListInput
                                items={formData.ingredients}
                                onChange={items => setFormData({ ...formData, ingredients: items })}
                                placeholder={t('recipe_form.ingredient_ph')}
                                addLabel={t('recipe_form.add_ingredient')}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">{t('recipe_form.instructions')}</label>
                            <ListInput
                                items={formData.instructions}
                                onChange={items => setFormData({ ...formData, instructions: items })}
                                placeholder={t('recipe_form.instruction_ph')}
                                addLabel={t('recipe_form.add_step')}
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
                                {user?.isAdmin ? t('recipe_form.create_btn') : t('recipe_form.submit_btn')}
                            </motion.button>
                        </div>
                    </form>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
