import { useState, useEffect } from 'react';
import { Package, Plus, Search, TrendingDown, TrendingUp } from 'lucide-react';
import { PantryItem, IngredientStatus } from '../types/kitchen';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { getPantry, addPantryItem, updatePantryItem, deletePantryItem } from '../api/pantryApi';
import { useTranslation } from 'react-i18next';

export function PantryPage() {
  const { t } = useTranslation();
  const [items, setItems] = useState<PantryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<IngredientStatus | 'all'>('all');
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemCategory, setNewItemCategory] = useState('');
  const [newItemQuantity, setNewItemQuantity] = useState('');

  useEffect(() => {
    loadPantry();
  }, []);

  const loadPantry = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getPantry();
      setItems(data);
    } catch (e: any) {
      setError(e.message || t('pantry.load_failed'));
      toast.error(t('pantry.load_failed'));
    } finally {
      setLoading(false);
    }
  };

  const categories = Array.from(new Set(items.map((item) => item.category)));

  const filteredItems = items.filter((item) => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = selectedStatus === 'all' || item.status === selectedStatus;
    return matchesSearch && matchesStatus;
  });

  const statusStats = {
    'in-stock': items.filter((i) => i.status === 'in-stock').length,
    low: items.filter((i) => i.status === 'low').length,
    out: items.filter((i) => i.status === 'out').length,
  };

  const statusColors = {
    'in-stock': { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700', dot: 'bg-green-500' },
    low: { bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-700', dot: 'bg-yellow-500' },
    out: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', dot: 'bg-red-500' },
  };

  const handleAddItem = async () => {
    if (!newItemName || !newItemCategory) {
      toast.error(t('pantry.fill_required'));
      return;
    }
    try {
      const newItem = await addPantryItem({
        name: newItemName,
        category: newItemCategory,
        quantity: newItemQuantity || undefined,
        status: 'in-stock',
      });
      setItems((prev) => [newItem, ...prev]);
      setNewItemName('');
      setNewItemCategory('');
      setNewItemQuantity('');
      setIsAddingItem(false);
      toast.success(t('pantry.added', { name: newItemName }));
    } catch (e: any) {
      toast.error(e.message || t('pantry.add_failed'));
    }
  };

  const handleStatusChange = async (id: string, status: IngredientStatus) => {
    try {
      const updated = await updatePantryItem(id, { status });
      setItems((prev) => prev.map((item) => (item.id === id ? updated : item)));
      toast.success(t('pantry.status_updated'));
    } catch (e: any) {
      toast.error(e.message || t('pantry.update_failed'));
    }
  };

  const handleDeleteItem = async (id: string, name: string) => {
    try {
      await deletePantryItem(id);
      setItems((prev) => prev.filter((item) => item.id !== id));
      toast.success(t('pantry.removed', { name }));
    } catch (e: any) {
      toast.error(e.message || t('pantry.delete_failed'));
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full mx-auto mb-4" />
          <p className="text-gray-600">{t('pantry.loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="mb-8 animate-fade-up">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl sm:text-4xl text-gray-900 mb-3">{t('pantry.title')}</h1>
              <p className="text-gray-600">{t('pantry.subtitle')}</p>
            </div>
            <button
              onClick={() => setIsAddingItem(!isAddingItem)}
              className="flex items-center gap-2 px-6 py-3 rounded-[20px] bg-gradient-to-r from-primary to-primary/80 text-white hover:shadow-lg transition-all"
            >
              <Plus className="w-5 h-5" />
              <span className="hidden sm:inline">{t('pantry.add_item')}</span>
            </button>
          </div>
        </div>

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
                <h3 className="text-lg text-gray-900 mb-4">{t('pantry.add_new_item')}</h3>
                <div className="grid sm:grid-cols-3 gap-4 mb-4">
                  <input
                    type="text"
                    placeholder={t('pantry.item_name')}
                    value={newItemName}
                    onChange={(e) => setNewItemName(e.target.value)}
                    className="px-4 py-3 rounded-[16px] bg-background border border-primary/20 focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <input
                    type="text"
                    placeholder={t('pantry.category_ph')}
                    value={newItemCategory}
                    onChange={(e) => setNewItemCategory(e.target.value)}
                    className="px-4 py-3 rounded-[16px] bg-background border border-primary/20 focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <input
                    type="text"
                    placeholder={t('pantry.quantity_ph')}
                    value={newItemQuantity}
                    onChange={(e) => setNewItemQuantity(e.target.value)}
                    className="px-4 py-3 rounded-[16px] bg-background border border-primary/20 focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleAddItem}
                    className="px-6 py-2 rounded-[16px] bg-primary text-white hover:bg-primary/90 transition-colors"
                  >
                    {t('pantry.add')}
                  </button>
                  <button
                    onClick={() => setIsAddingItem(false)}
                    className="px-6 py-2 rounded-[16px] bg-gray-200 text-gray-700 hover:bg-gray-300 transition-colors"
                  >
                    {t('pantry.cancel')}
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Stats Cards */}
        <div className="grid sm:grid-cols-3 gap-4 mb-8 animate-fade-up stagger-2">
          <div className="p-6 rounded-[24px] bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-green-700">{t('pantry.in_stock')}</span>
              <TrendingUp className="w-5 h-5 text-green-600" />
            </div>
            <div className="text-3xl text-green-900">{statusStats['in-stock']}</div>
          </div>
          <div className="p-6 rounded-[24px] bg-gradient-to-br from-yellow-50 to-amber-50 border border-yellow-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-yellow-700">{t('pantry.running_low')}</span>
              <TrendingDown className="w-5 h-5 text-yellow-600" />
            </div>
            <div className="text-3xl text-yellow-900">{statusStats.low}</div>
          </div>
          <div className="p-6 rounded-[24px] bg-gradient-to-br from-red-50 to-rose-50 border border-red-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-red-700">{t('pantry.out')}</span>
              <Package className="w-5 h-5 text-red-600" />
            </div>
            <div className="text-3xl text-red-900">{statusStats.out}</div>
          </div>
        </div>

        {/* Search and Filter */}
        <div className="mb-6 space-y-4 animate-fade-up stagger-3">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder={t('pantry.search_ph')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 rounded-[20px] bg-white border border-primary/20 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {(['all', 'in-stock', 'low', 'out'] as const).map((status) => (
              <button
                key={status}
                onClick={() => setSelectedStatus(status)}
                className={`px-4 py-2 rounded-[16px] text-sm transition-all ${selectedStatus === status
                  ? 'bg-gradient-to-r from-primary to-primary/80 text-white shadow-md'
                  : 'bg-white border border-primary/20 text-gray-700 hover:bg-primary/5'
                  }`}
              >
                {status === 'all' ? t('pantry.all_items') : status === 'in-stock' ? t('pantry.in_stock') : status === 'low' ? t('pantry.low') : t('pantry.out')}
              </button>
            ))}
          </div>
        </div>

        {/* Pantry Items by Category */}
        <div className="space-y-8">
          {categories.map((category) => {
            const categoryItems = filteredItems.filter((item) => item.category === category);
            if (categoryItems.length === 0) return null;

            return (
              <div key={category}>
                <h2 className="text-xl text-gray-900 mb-4 capitalize">{category}</h2>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {categoryItems.map((item) => (
                    <motion.div
                      key={item.id}
                      layout
                      className="group relative"
                    >
                      <div
                        onClick={() => {
                          const statuses: IngredientStatus[] = ['in-stock', 'low', 'out'];
                          const currentIndex = statuses.indexOf(item.status);
                          const nextIndex = (currentIndex + 1) % statuses.length;
                          handleStatusChange(item.id, statuses[nextIndex]);
                        }}
                        className={`p-5 rounded-[24px] ${statusColors[item.status].bg} border ${statusColors[item.status].border} hover:shadow-lg transition-all duration-200 cursor-pointer`}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <h3 className="text-gray-900">{item.name}</h3>
                          <div className={`w-3 h-3 rounded-full ${statusColors[item.status].dot} mt-1`} />
                        </div>
                        {item.quantity && (
                          <p className="text-sm text-gray-600 mb-2">{item.quantity}</p>
                        )}
                        <div className={`inline-flex px-3 py-1 rounded-full text-xs ${statusColors[item.status].bg} ${statusColors[item.status].text} border ${statusColors[item.status].border}`}>
                          {item.status === 'in-stock' ? t('pantry.in_stock') : item.status === 'low' ? t('pantry.low') : t('pantry.out')}
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteItem(item.id, item.name)}
                        className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-xs font-bold hover:bg-red-600"
                      >
                        ×
                      </button>
                    </motion.div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {filteredItems.length === 0 && (
          <div className="text-center py-20">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-primary/10 to-accent/10 flex items-center justify-center">
              <Package className="w-10 h-10 text-primary" />
            </div>
            <h3 className="text-2xl text-gray-900 mb-3">{t('pantry.no_items')}</h3>
            <p className="text-gray-600 mb-6">{t('pantry.no_items_sub')}</p>
            <button
              onClick={() => setIsAddingItem(true)}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-[20px] bg-gradient-to-r from-primary to-primary/80 text-white hover:shadow-lg transition-all"
            >
              <Plus className="w-5 h-5" />
              {t('pantry.add_item')}
            </button>
          </div>
        )}

        {error && (
          <div className="mt-12 p-6 rounded-[24px] bg-red-50 border border-red-200">
            <p className="text-sm text-red-900">⚠️ <strong>Error:</strong> {error}</p>
          </div>
        )}

        {/* Tip */}
        <div className="mt-12 p-6 rounded-[24px] bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200">
          <p className="text-sm text-blue-900">
            💡 {t('pantry.tip')}
          </p>
        </div>
      </div>
    </div>
  );
}
