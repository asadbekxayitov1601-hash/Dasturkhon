import { ShoppingCart, Trash2, Check, Plus, Download, ExternalLink, ShoppingBag, ChefHat } from 'lucide-react';
import { DELIVERY_PLATFORMS } from '../lib/delivery';
import { PanLoader } from '../components/PanLoader';
import { ShoppingListItem } from '../types/kitchen';
import { motion, AnimatePresence } from 'motion/react';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { getShoppingList, addShoppingItem, updateShoppingItem, deleteShoppingItem } from '../api/shoppingApi';

export function ShoppingListPage() {
  const { t } = useTranslation();
  const [items, setItems] = useState<ShoppingListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemQuantity, setNewItemQuantity] = useState('');

  useEffect(() => {
    loadShoppingList();
  }, []);

  const loadShoppingList = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getShoppingList();
      setItems(data);
    } catch (e: any) {
      setError(e.message || t('shopping.load_failed'));
      toast.error(t('shopping.load_failed'));
    } finally {
      setLoading(false);
    }
  };

  const activeItems = items.filter((item) => !item.checked);
  const completedItems = items.filter((item) => item.checked);

  const handleAddItem = async () => {
    if (!newItemName) {
      toast.error(t('shopping.enter_name'));
      return;
    }
    try {
      const newItem = await addShoppingItem({
        name: newItemName,
        quantity: newItemQuantity,
      });
      setItems((prev) => [newItem, ...prev]);
      setNewItemName('');
      setNewItemQuantity('');
      setIsAddingItem(false);
      toast.success(t('shopping.item_added'));
    } catch (e: any) {
      toast.error(e.message || t('shopping.add_failed'));
    }
  };

  // Optimistic toggle: flip instantly, reconcile/revert with the server.
  const handleToggleItem = async (id: string) => {
    const item = items.find((i) => i.id === id);
    if (!item) return;
    const nextChecked = !item.checked;
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, checked: nextChecked } : i)));
    try {
      const updated = await updateShoppingItem(id, { checked: nextChecked });
      setItems((prev) => prev.map((i) => (i.id === id ? updated : i)));
    } catch (e: any) {
      setItems((prev) => prev.map((i) => (i.id === id ? { ...i, checked: item.checked } : i)));
      toast.error(e.message || t('shopping.add_failed'));
    }
  };

  // Optimistic remove: drop instantly, restore on failure.
  const handleRemoveItem = async (id: string, name: string) => {
    const prev = items;
    setItems((curr) => curr.filter((item) => item.id !== id));
    try {
      await deleteShoppingItem(id);
    } catch (e: any) {
      setItems(prev);
      toast.error(e.message || t('shopping.remove_failed', { name }));
    }
  };

  const handleClearCompleted = async () => {
    if (completedItems.length === 0) return;
    const prev = items;
    const toRemove = completedItems.map((i) => i.id);
    setItems((curr) => curr.filter((i) => !i.checked));
    try {
      await Promise.all(toRemove.map((id) => deleteShoppingItem(id)));
      toast.success(t('shopping.cleared'));
    } catch (e: any) {
      setItems(prev);
      toast.error(t('shopping.clear_failed'));
    }
  };

  const handleExportList = () => {
    const listText = activeItems
      .map((item) => `${item.name} - ${item.quantity || '1x'}`)
      .join('\n');

    navigator.clipboard
      .writeText(listText)
      .then(() => {
        toast.success(t('shopping.copied_success'));
      })
      .catch(() => {
        toast.error(t('shopping.copy_failed'));
      });
  };

  // Group active items by the recipe they came from (manual items go to "Other").
  const groupedActive = activeItems.reduce<Record<string, ShoppingListItem[]>>((acc, item) => {
    const key = item.recipeName || 'Other items';
    (acc[key] ||= []).push(item);
    return acc;
  }, {});
  const boughtCount = completedItems.length;
  const totalCount = items.length;
  const progress = totalCount > 0 ? Math.round((boughtCount / totalCount) * 100) : 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <PanLoader />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-[1000px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="mb-8 animate-fade-up">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl sm:text-4xl text-gray-900 mb-3">{t('shopping.title')}</h1>
              <p className="text-gray-600">
                {activeItems.length} {activeItems.length === 1 ? t('shopping.item_to_buy') : t('shopping.items_to_buy')}
              </p>
            </div>
            <button
              onClick={() => setIsAddingItem(!isAddingItem)}
              className="flex items-center gap-2 px-6 py-3 rounded-[20px] bg-gradient-to-r from-primary to-primary/80 text-white hover:shadow-lg transition-all"
            >
              <Plus className="w-5 h-5" />
              <span className="hidden sm:inline">{t('shopping.add_item')}</span>
            </button>
          </div>

          {/* Progress */}
          {totalCount > 0 && (
            <div>
              <div className="flex items-center justify-between text-xs font-medium text-gray-500 mb-1.5">
                <span>{t('shopping.bought', { bought: boughtCount, total: totalCount })}</span>
                <span>{progress}%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-primary/10 overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-primary to-primary/70"
                  initial={false}
                  animate={{ width: `${progress}%` }}
                  transition={{ type: 'spring', stiffness: 120, damping: 20 }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Order ingredients (affiliate) */}
        {activeItems.length > 0 && (
          <div
            className="mb-8 p-5 rounded-[24px] animate-fade-up stagger-2"
            style={{
              background: 'linear-gradient(135deg, rgba(74,124,126,0.05), rgba(230,181,102,0.07))',
              border: '1px solid rgba(74,124,126,0.15)',
            }}
          >
            <div className="flex items-center gap-2 mb-3">
              <ShoppingBag className="w-4 h-4 text-primary" />
              <p className="text-sm font-semibold text-gray-800">{t('shopping.order_ingredients')}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {DELIVERY_PLATFORMS.map((p) => (
                <a
                  key={p.key}
                  href={p.searchUrl(activeItems.slice(0, 5).map((i) => i.name).join(', '))}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium transition-all hover:scale-105 active:scale-95 shadow-sm"
                  style={{ background: p.color, color: p.textColor, boxShadow: `0 2px 8px ${p.color}40` }}
                >
                  <ShoppingBag className="w-3.5 h-3.5" />
                  {t('shopping.order_on', { platform: p.name })}
                  <ExternalLink className="w-3 h-3 opacity-70" />
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Add Item Form */}
        <AnimatePresence>
          {isAddingItem && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-8"
            >
              <div className="p-6 rounded-[24px] bg-white border border-primary/20">
                <h3 className="text-lg text-gray-900 mb-4">{t('shopping.add_new_item')}</h3>
                <div className="grid sm:grid-cols-2 gap-4 mb-4">
                  <div className="relative">
                    <input
                      type="text"
                      maxLength={30}
                      placeholder={t('shopping.item_name')}
                      value={newItemName}
                      onChange={(e) => setNewItemName(e.target.value.slice(0, 30))}
                      onKeyPress={(e) => e.key === 'Enter' && handleAddItem()}
                      className="w-full px-4 py-3 rounded-[16px] bg-background border border-primary/20 focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                    {newItemName.length > 0 && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">
                        {30 - newItemName.length}
                      </span>
                    )}
                  </div>
                  <input
                    type="text"
                    placeholder={t('shopping.quantity')}
                    value={newItemQuantity}
                    onChange={(e) => setNewItemQuantity(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAddItem()}
                    className="px-4 py-3 rounded-[16px] bg-background border border-primary/20 focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleAddItem}
                    className="px-6 py-2 rounded-[16px] bg-primary text-white hover:bg-primary/90 transition-colors"
                  >
                    {t('shopping.add')}
                  </button>
                  <button
                    onClick={() => setIsAddingItem(false)}
                    className="px-6 py-2 rounded-[16px] bg-gray-200 text-gray-700 hover:bg-gray-300 transition-colors"
                  >
                    {t('shopping.cancel')}
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Action Buttons */}
        {activeItems.length > 0 && (
          <div className="mb-8 flex flex-wrap gap-3">
            <button
              onClick={handleExportList}
              className="flex items-center gap-2 px-6 py-3 rounded-[20px] bg-white border border-primary/20 text-gray-700 hover:bg-primary/5 transition-all"
            >
              <Download className="w-5 h-5" />
              {t('shopping.copy_list')}
            </button>
          </div>
        )}

        {/* Shopping List Items */}
        <div className="space-y-6">
          {/* Active Items, grouped by recipe */}
          {activeItems.length > 0 && (
            <div className="space-y-6">
              {Object.entries(groupedActive).map(([groupName, groupItems]) => (
                <div key={groupName}>
                  <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-gray-500 mb-3">
                    {groupName !== 'Other items' && <ChefHat className="w-4 h-4 text-primary" />}
                    {groupName === 'Other items' ? t('shopping.other_items') : groupName}
                    <span className="text-gray-400 font-normal normal-case">({groupItems.length})</span>
                  </h2>
                  <div className="space-y-3">
                    <AnimatePresence>
                      {groupItems.map((item) => (
                        <motion.div
                          key={item.id}
                          layout
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 20 }}
                          className="group"
                        >
                          <div className="p-5 rounded-[24px] bg-white border border-gray-200 hover:shadow-md transition-all">
                            <div className="flex items-center gap-4">
                              <button
                                onClick={() => handleToggleItem(item.id)}
                                className="w-6 h-6 rounded-full border-2 border-gray-300 hover:border-primary transition-colors shrink-0 flex items-center justify-center active:scale-90"
                              >
                                {item.checked && <Check className="w-4 h-4 text-primary" />}
                              </button>
                              <div className="flex-1 min-w-0">
                                <h3 className="text-gray-900 break-words">{item.name}</h3>
                                {item.quantity && (
                                  <p className="text-sm text-gray-600 mt-0.5">{item.quantity}</p>
                                )}
                              </div>
                              <button
                                onClick={() => handleRemoveItem(item.id, item.name)}
                                className="w-10 h-10 rounded-full hover:bg-red-50 flex items-center justify-center transition-colors shrink-0 opacity-0 group-hover:opacity-100"
                              >
                                <Trash2 className="w-4 h-4 text-red-500" />
                              </button>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Completed Items */}
          {completedItems.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl text-gray-900">{t('shopping.completed')} ({completedItems.length})</h2>
                <button
                  onClick={handleClearCompleted}
                  className="flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-red-500 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  {t('shopping.clear_completed')}
                </button>
              </div>
              <div className="space-y-3">
                <AnimatePresence>
                  {completedItems.map((item) => (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="group"
                    >
                      <div className="p-5 rounded-[24px] bg-green-50/50 border border-green-200">
                        <div className="flex items-start gap-4">
                          <button
                            onClick={() => handleToggleItem(item.id)}
                            className="mt-1 w-6 h-6 rounded-full bg-primary border-2 border-primary flex items-center justify-center shrink-0"
                          >
                            <Check className="w-4 h-4 text-white" />
                          </button>
                          <div className="flex-1 min-w-0">
                            <h3 className="text-gray-600 line-through break-words">{item.name}</h3>
                            {item.quantity && (
                              <p className="text-sm text-gray-500 mt-1 line-through">
                                {item.quantity}
                              </p>
                            )}
                          </div>
                          <button
                            onClick={() => handleRemoveItem(item.id, item.name)}
                            className="w-10 h-10 rounded-full hover:bg-red-50 flex items-center justify-center transition-colors shrink-0 opacity-0 group-hover:opacity-100"
                          >
                            <Trash2 className="w-4 h-4 text-red-400" />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          )}
        </div>

        {/* Empty State */}
        {items.length === 0 && (
          <div className="text-center py-20">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-primary/10 to-accent/10 flex items-center justify-center">
              <ShoppingCart className="w-10 h-10 text-primary" />
            </div>
            <h3 className="text-2xl text-gray-900 mb-3">{t('shopping.empty_title')}</h3>
            <p className="text-gray-600 mb-6">
              {t('shopping.empty_subtitle')}
            </p>
            <button
              onClick={() => setIsAddingItem(true)}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-[20px] bg-gradient-to-r from-primary to-primary/80 text-white hover:shadow-lg transition-all"
            >
              <Plus className="w-5 h-5" />
              {t('shopping.add_first_item')}
            </button>
          </div>
        )}

        {error && (
          <div className="mt-12 p-6 rounded-[24px] bg-red-50 border border-red-200">
            <p className="text-sm text-red-900">⚠️ <strong>Error:</strong> {error}</p>
          </div>
        )}
      </div>
    </div>
  );
}
