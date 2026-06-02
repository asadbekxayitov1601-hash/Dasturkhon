import { ShoppingCart, Trash2, Check, Plus, Download, ExternalLink, ShoppingBag } from 'lucide-react';
import { DELIVERY_PLATFORMS } from '../lib/delivery';
import { PanLoader } from '../components/PanLoader';
import { ShoppingListItem } from '../types/kitchen';
import { motion, AnimatePresence } from 'motion/react';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { getShoppingList, addShoppingItem, updateShoppingItem, deleteShoppingItem } from '../api/shoppingApi';

export function ShoppingListPage() {
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
      setError(e.message || 'Failed to load shopping list');
      toast.error('Failed to load shopping list');
    } finally {
      setLoading(false);
    }
  };

  const activeItems = items.filter((item) => !item.checked);
  const completedItems = items.filter((item) => item.checked);

  const handleAddItem = async () => {
    if (!newItemName) {
      toast.error('Please enter an item name');
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
      toast.success('Item added to shopping list');
    } catch (e: any) {
      toast.error(e.message || 'Failed to add item');
    }
  };

  const handleToggleItem = async (id: string) => {
    const item = items.find((i) => i.id === id);
    if (!item) return;
    try {
      const updated = await updateShoppingItem(id, { checked: !item.checked });
      setItems((prev) => prev.map((i) => (i.id === id ? updated : i)));
      toast.success(updated.checked ? 'Item completed' : 'Item marked as pending');
    } catch (e: any) {
      toast.error(e.message || 'Failed to update item');
    }
  };

  const handleRemoveItem = async (id: string, name: string) => {
    try {
      await deleteShoppingItem(id);
      setItems((prev) => prev.filter((item) => item.id !== id));
      toast.success(`${name} removed from list`);
    } catch (e: any) {
      toast.error(e.message || 'Failed to delete item');
    }
  };

  const handleExportList = () => {
    const listText = activeItems
      .map((item) => `${item.name} - ${item.quantity || '1x'}`)
      .join('\n');

    navigator.clipboard
      .writeText(listText)
      .then(() => {
        toast.success('Shopping list copied to clipboard!');
      })
      .catch(() => {
        toast.error('Failed to copy list');
      });
  };

  const handleOrderFromKorzinka = () => {
    const listText = activeItems.map((item) => `${item.name} - ${item.quantity || '1x'}`).join('\n');

    navigator.clipboard
      .writeText(listText)
      .then(() => {
        toast.success('Shopping list copied!', {
          description: 'Opening Korzinka.uz...',
        });

        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

        if (isMobile) {
          const korzinkaAppUrl = 'korzinka://';
          const iframe = document.createElement('iframe');
          iframe.style.display = 'none';
          iframe.src = korzinkaAppUrl;
          document.body.appendChild(iframe);

          setTimeout(() => {
            document.body.removeChild(iframe);
            window.open('https://korzinka.uz', '_blank');
          }, 2000);
        } else {
          window.open('https://korzinka.uz', '_blank');
        }
      })
      .catch(() => {
        toast.error('Failed to copy list');
      });
  };

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
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl sm:text-4xl text-gray-900 mb-3">Shopping List</h1>
              <p className="text-gray-600">
                {activeItems.length} {activeItems.length === 1 ? 'item' : 'items'} to buy
              </p>
            </div>
            <button
              onClick={() => setIsAddingItem(!isAddingItem)}
              className="flex items-center gap-2 px-6 py-3 rounded-[20px] bg-gradient-to-r from-primary to-primary/80 text-white hover:shadow-lg transition-all"
            >
              <Plus className="w-5 h-5" />
              <span className="hidden sm:inline">Add Item</span>
            </button>
          </div>
        </div>

        {/* Order ingredients (affiliate) */}
        {activeItems.length > 0 && (
          <div
            className="mb-8 p-5 rounded-[24px]"
            style={{
              background: 'linear-gradient(135deg, rgba(74,124,126,0.05), rgba(230,181,102,0.07))',
              border: '1px solid rgba(74,124,126,0.15)',
            }}
          >
            <div className="flex items-center gap-2 mb-3">
              <ShoppingBag className="w-4 h-4 text-primary" />
              <p className="text-sm font-semibold text-gray-800">Don't want to shop? Order your ingredients</p>
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
                  Order on {p.name}
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
                <h3 className="text-lg text-gray-900 mb-4">Add New Item</h3>
                <div className="grid sm:grid-cols-2 gap-4 mb-4">
                  <input
                    type="text"
                    placeholder="Item name"
                    value={newItemName}
                    onChange={(e) => setNewItemName(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAddItem()}
                    className="px-4 py-3 rounded-[16px] bg-background border border-primary/20 focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <input
                    type="text"
                    placeholder="Quantity (e.g., 2 kg)"
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
                    Add
                  </button>
                  <button
                    onClick={() => setIsAddingItem(false)}
                    className="px-6 py-2 rounded-[16px] bg-gray-200 text-gray-700 hover:bg-gray-300 transition-colors"
                  >
                    Cancel
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
              onClick={handleOrderFromKorzinka}
              className="flex items-center gap-2 px-6 py-3 rounded-[20px] bg-gradient-to-r from-secondary to-secondary/80 text-white hover:shadow-lg transition-all"
            >
              <ExternalLink className="w-5 h-5" />
              Order from Korzinka
            </button>
            <button
              onClick={handleExportList}
              className="flex items-center gap-2 px-6 py-3 rounded-[20px] bg-white border border-primary/20 text-gray-700 hover:bg-primary/5 transition-all"
            >
              <Download className="w-5 h-5" />
              Copy List
            </button>
          </div>
        )}

        {/* Shopping List Items */}
        <div className="space-y-6">
          {/* Active Items */}
          {activeItems.length > 0 && (
            <div>
              <h2 className="text-xl text-gray-900 mb-4">To Buy</h2>
              <div className="space-y-3">
                <AnimatePresence>
                  {activeItems.map((item) => (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      className="group"
                    >
                      <div className="p-5 rounded-[24px] bg-white border border-gray-200 hover:shadow-md transition-all">
                        <div className="flex items-start gap-4">
                          <button
                            onClick={() => handleToggleItem(item.id)}
                            className="mt-1 w-6 h-6 rounded-full border-2 border-gray-300 hover:border-primary transition-colors shrink-0 flex items-center justify-center"
                          >
                            {item.checked && <Check className="w-4 h-4 text-primary" />}
                          </button>
                          <div className="flex-1 min-w-0">
                            <h3 className="text-gray-900">{item.name}</h3>
                            {item.quantity && (
                              <p className="text-sm text-gray-600 mt-1">{item.quantity}</p>
                            )}
                            {item.recipeName && (
                              <p className="text-sm text-primary mt-1">
                                For: {item.recipeName}
                              </p>
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
          )}

          {/* Completed Items */}
          {completedItems.length > 0 && (
            <div>
              <h2 className="text-xl text-gray-900 mb-4">Completed</h2>
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
                            <h3 className="text-gray-600 line-through">{item.name}</h3>
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
            <h3 className="text-2xl text-gray-900 mb-3">Your shopping list is empty</h3>
            <p className="text-gray-600 mb-6">
              Add items manually or browse recipes to get started
            </p>
            <button
              onClick={() => setIsAddingItem(true)}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-[20px] bg-gradient-to-r from-primary to-primary/80 text-white hover:shadow-lg transition-all"
            >
              <Plus className="w-5 h-5" />
              Add Your First Item
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
