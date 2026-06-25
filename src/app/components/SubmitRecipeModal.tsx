import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/AuthProvider';
import { createRecipe, updateRecipe } from '../api/recipesApi';
import { Recipe } from '../types/kitchen';
import { parseCookTime, composeCookTime } from '../lib/cookTime';
import { celebrate } from '../lib/celebrate';
import { ListInput } from './ListInput';
import { X, Plus, Pencil, Loader2, Upload, Phone } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

interface SubmitRecipeModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    editRecipe?: Recipe | null;
}

const emptyForm = {
    title: '',
    image: '',
    hours: 0,
    minutes: 0,
    servings: 4,
    category: 'main',
    youtubeUrl: '',
    orderable: false,
    orderPhone: '',
    ingredients: [''] as string[],
    instructions: [''] as string[],
};

export function SubmitRecipeModal({ isOpen, onClose, onSuccess, editRecipe }: SubmitRecipeModalProps) {
    const { t } = useTranslation();
    const { user } = useAuth();
    const isEdit = !!editRecipe;
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({ ...emptyForm });
    const [imageMode, setImageMode] = useState<'url' | 'upload'>('upload');
    const [videoMode, setVideoMode] = useState<'url' | 'upload'>('upload');
    const [previewImage, setPreviewImage] = useState<string>('');

    // Prefill when opening in edit mode; reset when opening fresh.
    useEffect(() => {
        if (!isOpen) return;
        if (editRecipe) {
            const { hours, minutes } = parseCookTime(editRecipe.cookTime);
            setFormData({
                title: editRecipe.title || '',
                image: editRecipe.image || '',
                hours,
                minutes,
                servings: editRecipe.servings ?? 4,
                category: editRecipe.category || 'main',
                youtubeUrl: editRecipe.youtubeUrl || '',
                orderable: !!editRecipe.orderable,
                orderPhone: editRecipe.orderPhone || '',
                ingredients: editRecipe.ingredients?.length ? editRecipe.ingredients : [''],
                instructions: editRecipe.instructions?.length ? editRecipe.instructions : [''],
            });
            setPreviewImage(editRecipe.image || '');
            setImageMode(editRecipe.image?.startsWith('data:') ? 'upload' : (editRecipe.image ? 'url' : 'upload'));
            setVideoMode(editRecipe.youtubeUrl?.startsWith('data:') ? 'upload' : (editRecipe.youtubeUrl ? 'url' : 'upload'));
        } else {
            setFormData({ ...emptyForm });
            setPreviewImage('');
            setImageMode('upload');
            setVideoMode('upload');
        }
    }, [isOpen, editRecipe]);

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

    const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 20 * 1024 * 1024) {
            toast.error(t('recipe_form.video_too_large'));
            return;
        }

        const reader = new FileReader();
        reader.onloadend = () => {
            setFormData(prev => ({ ...prev, youtubeUrl: reader.result as string }));
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

            if (!formData.image.trim()) { toast.error(t('recipe_form.image_required')); setLoading(false); return; }
            if (ingredients.length === 0) { toast.error(t('recipe_form.need_ingredient')); setLoading(false); return; }
            if (instructions.length === 0) { toast.error(t('recipe_form.need_instruction')); setLoading(false); return; }
            if (formData.hours === 0 && formData.minutes === 0) { toast.error(t('recipe_form.need_cook_time')); setLoading(false); return; }
            if (formData.orderable && !formData.orderPhone.trim()) { toast.error(t('recipe_form.order_phone_required')); setLoading(false); return; }

            const { hours, minutes, ...rest } = formData;
            const payload = {
                ...rest,
                orderPhone: formData.orderable ? formData.orderPhone.trim() : '',
                cookTime: composeCookTime(hours, minutes),
                ingredients,
                instructions,
            };

            if (isEdit && editRecipe) {
                await updateRecipe(editRecipe.id, payload);
                celebrate(t('recipe_form.updated'));
            } else {
                await createRecipe(payload);
                celebrate(user?.isAdmin ? t('recipe_form.created') : t('recipe_form.submitted'));
            }

            setFormData({ ...emptyForm });
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
                            {isEdit
                                ? <><Pencil className="w-5 h-5 text-primary" /> {t('recipe_form.edit_title')}</>
                                : <><Plus className="w-5 h-5 text-primary" /> {user?.isAdmin ? t('recipe_form.create_title') : t('recipe_form.submit_title')}</>}
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
                            <label className="block text-sm font-medium text-gray-700 mb-1">{t('recipe_form.cook_time')}</label>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <input
                                        type="number"
                                        min="0"
                                        max="48"
                                        placeholder="0"
                                        value={formData.hours === 0 ? '' : formData.hours}
                                        onChange={e => setFormData({ ...formData, hours: Math.max(0, Math.floor(Number(e.target.value) || 0)) })}
                                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none"
                                    />
                                    <p className="text-[11px] text-gray-400 mt-1">{t('recipe_form.hours')}</p>
                                </div>
                                <div>
                                    <input
                                        type="number"
                                        min="0"
                                        max="59"
                                        placeholder="0"
                                        value={formData.minutes === 0 ? '' : formData.minutes}
                                        onChange={e => setFormData({ ...formData, minutes: Math.min(59, Math.max(0, Math.floor(Number(e.target.value) || 0))) })}
                                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none"
                                    />
                                    <p className="text-[11px] text-gray-400 mt-1">{t('recipe_form.minutes')}</p>
                                </div>
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
                        {/* Orderable: chef takes direct orders (call-to-order). The site
                            is not involved in the order — buyers call the chef directly. */}
                        <div className="rounded-xl border border-primary/15 bg-primary/5 p-4">
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <label htmlFor="recipe-orderable" className="flex items-center gap-2 text-sm font-medium text-gray-800 cursor-pointer">
                                        <Phone className="w-4 h-4 text-primary" />
                                        {t('recipe_form.orderable')}
                                    </label>
                                    <p className="text-xs text-gray-500 mt-1">{t('recipe_form.orderable_hint')}</p>
                                </div>
                                <button
                                    id="recipe-orderable"
                                    type="button"
                                    role="switch"
                                    aria-checked={formData.orderable}
                                    onClick={() => setFormData({ ...formData, orderable: !formData.orderable })}
                                    className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${formData.orderable ? 'bg-primary' : 'bg-gray-300'}`}
                                >
                                    <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${formData.orderable ? 'translate-x-5' : 'translate-x-0.5'}`} />
                                </button>
                            </div>

                            {formData.orderable && (
                                <div className="mt-3">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('recipe_form.order_phone')}</label>
                                    <div className="relative">
                                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                        <input
                                            type="tel"
                                            required={formData.orderable}
                                            value={formData.orderPhone}
                                            onChange={e => setFormData({ ...formData, orderPhone: e.target.value })}
                                            className="w-full pl-9 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none"
                                            placeholder={t('recipe_form.order_phone_ph')}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">{t('recipe_form.video')}</label>
                            <div className="flex bg-gray-100 p-1 rounded-xl mb-3 w-fit">
                                <button
                                    type="button"
                                    onClick={() => setVideoMode('upload')}
                                    className={`relative px-4 py-2 text-sm font-medium transition-colors z-0 ${videoMode === 'upload' ? 'text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                                >
                                    {videoMode === 'upload' && (
                                        <motion.div
                                            layoutId="activeVideoMode"
                                            className="absolute inset-0 bg-white rounded-lg shadow-sm -z-10"
                                            transition={{ type: "spring", stiffness: 500, damping: 30 }}
                                        />
                                    )}
                                    {t('recipe_form.upload_file')}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setVideoMode('url')}
                                    className={`relative px-4 py-2 text-sm font-medium transition-colors z-0 ${videoMode === 'url' ? 'text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                                >
                                    {videoMode === 'url' && (
                                        <motion.div
                                            layoutId="activeVideoMode"
                                            className="absolute inset-0 bg-white rounded-lg shadow-sm -z-10"
                                            transition={{ type: "spring", stiffness: 500, damping: 30 }}
                                        />
                                    )}
                                    {t('recipe_form.video_link')}
                                </button>
                            </div>

                            {videoMode === 'url' ? (
                                <input
                                    type="url"
                                    placeholder="https://youtube.com/watch?v=..."
                                    value={formData.youtubeUrl.startsWith('data:') ? '' : formData.youtubeUrl}
                                    onChange={e => setFormData({ ...formData, youtubeUrl: e.target.value })}
                                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none"
                                />
                            ) : (
                                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:bg-gray-50 transition-colors">
                                    <input
                                        type="file"
                                        accept="video/*"
                                        onChange={handleVideoUpload}
                                        className="hidden"
                                        id="recipe-video-upload"
                                    />
                                    <label htmlFor="recipe-video-upload" className="cursor-pointer flex flex-col items-center gap-2">
                                        <Upload className="w-8 h-8 text-gray-400" />
                                        <span className="text-sm text-gray-600">{t('recipe_form.upload_video_hint')}</span>
                                    </label>
                                </div>
                            )}

                            {formData.youtubeUrl.startsWith('data:') && (
                                <div className="mt-3 relative rounded-lg overflow-hidden bg-black border">
                                    <video src={formData.youtubeUrl} controls className="w-full max-h-56" />
                                    <button
                                        type="button"
                                        onClick={() => setFormData({ ...formData, youtubeUrl: '' })}
                                        className="absolute top-2 right-2 p-1 bg-black/50 text-white rounded-full hover:bg-black/70 transition-colors"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            )}
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
                                {isEdit ? t('recipe_form.save_btn') : (user?.isAdmin ? t('recipe_form.create_btn') : t('recipe_form.submit_btn'))}
                            </motion.button>
                        </div>
                    </form>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
