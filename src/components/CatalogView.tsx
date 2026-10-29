import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Product, Category, BranchProduct, ProductVariant, ProductAddOn } from '../types';
import {
  getProducts,
  getCategories,
  saveProduct,
  saveCategory,
  getBranchProducts,
  updateBranchProductPriceAndAlert,
} from '../services/dbService';
import { hasPermission, canViewCostPrice } from '../services/permissionService';
import {
  Package,
  Plus,
  Edit,
  Tag,
  CheckCircle,
  AlertCircle,
  Layers,
  Search,
  DollarSign,
  Archive,
} from 'lucide-react';

export const CatalogView: React.FC = () => {
  const { userProfile, currentBranchId, currentBranch, branches } = useAuth();

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [branchProducts, setBranchProducts] = useState<BranchProduct[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');

  // Product edit modal state
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isNewProduct, setIsNewProduct] = useState<boolean>(false);
  const [formData, setFormData] = useState<{
    name: string;
    description: string;
    categoryId: string;
    sku: string;
    globalSellingPrice: number;
    costPrice: number;
    active: boolean;
    variants: ProductVariant[];
    addOns: ProductAddOn[];
  }>({
    name: '',
    description: '',
    categoryId: '',
    sku: '',
    globalSellingPrice: 0,
    costPrice: 0,
    active: true,
    variants: [],
    addOns: [],
  });

  // Category modal state
  const [showCategoryModal, setShowCategoryModal] = useState<boolean>(false);
  const [newCategoryName, setNewCategoryName] = useState<string>('');
  const [newCategoryDesc, setNewCategoryDesc] = useState<string>('');

  // Branch override modal state
  const [overrideModalProduct, setOverrideModalProduct] = useState<Product | null>(null);
  const [branchPriceOverride, setBranchPriceOverride] = useState<string>('');
  const [branchLowAlert, setBranchLowAlert] = useState<number>(10);
  const [branchTrackStock, setBranchTrackStock] = useState<boolean>(true);

  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const isStaff = userProfile?.role === 'staff';
  const canViewCatalog = !isStaff && hasPermission(userProfile, 'products.view');
  const showCostPrice = canViewCostPrice(userProfile);

  const canCreate = !isStaff && hasPermission(userProfile, 'products.create');
  const canEdit = !isStaff && hasPermission(userProfile, 'products.edit');
  const canChangePrice = !isStaff && hasPermission(userProfile, 'products.change_price');
  const canManageCategories = !isStaff && hasPermission(userProfile, 'categories.manage');

  const effectiveBranchId = currentBranchId !== 'all' ? currentBranchId : branches[0]?.id;

  const loadData = async () => {
    try {
      setLoading(true);
      const [prods, cats] = await Promise.all([getProducts(), getCategories()]);
      setProducts(prods);
      setCategories(cats);

      if (effectiveBranchId) {
        const bp = await getBranchProducts(effectiveBranchId);
        setBranchProducts(bp);
      }
    } catch (e) {
      console.error('Error loading catalog:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [effectiveBranchId]);

  const handleOpenAddProduct = () => {
    setIsNewProduct(true);
    setFormData({
      name: '',
      description: '',
      categoryId: categories[0]?.id || '',
      sku: `FAL-${Math.floor(100 + Math.random() * 900)}`,
      globalSellingPrice: 150,
      costPrice: 50,
      active: true,
      variants: [{ id: 'v1', name: 'Regular', priceOffset: 0 }],
      addOns: [],
    });
    setEditingProduct({} as Product);
  };

  const handleOpenEditProduct = (p: Product) => {
    setIsNewProduct(false);
    setEditingProduct(p);
    setFormData({
      name: p.name,
      description: p.description,
      categoryId: p.categoryId,
      sku: p.sku,
      globalSellingPrice: p.globalSellingPrice,
      costPrice: p.costPrice,
      active: p.active,
      variants: p.variants || [],
      addOns: p.addOns || [],
    });
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.categoryId) {
      setMessage({ type: 'error', text: 'Name and Category are required.' });
      return;
    }

    try {
      await saveProduct({
        id: isNewProduct ? undefined : editingProduct?.id,
        name: formData.name.trim(),
        description: formData.description.trim(),
        categoryId: formData.categoryId,
        sku: formData.sku.trim(),
        globalSellingPrice: formData.globalSellingPrice,
        costPrice: showCostPrice ? formData.costPrice : (isNewProduct ? 0 : editingProduct?.costPrice || 0),
        active: formData.active,
        variants: formData.variants,
        addOns: formData.addOns,
        createdAt: isNewProduct ? new Date().toISOString() : editingProduct?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      setMessage({
        type: 'success',
        text: isNewProduct ? 'Product created successfully!' : 'Product updated successfully!',
      });
      setEditingProduct(null);
      await loadData();
    } catch (err) {
      console.error('Failed to save product:', err);
      setMessage({ type: 'error', text: 'Failed to save product. Permission denied.' });
    }
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;

    try {
      await saveCategory({
        name: newCategoryName.trim(),
        description: newCategoryDesc.trim(),
        sortOrder: categories.length + 1,
        active: true,
      });
      setMessage({ type: 'success', text: 'Category created successfully!' });
      setShowCategoryModal(false);
      setNewCategoryName('');
      setNewCategoryDesc('');
      await loadData();
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to create category.' });
    }
  };

  // Branch override save
  const handleOpenBranchOverride = (p: Product) => {
    setOverrideModalProduct(p);
    const bp = branchProducts.find((b) => b.productId === p.id);
    setBranchPriceOverride(bp?.priceOverride !== undefined ? bp.priceOverride.toString() : '');
    setBranchLowAlert(bp?.lowStockAlert || 10);
    setBranchTrackStock(bp?.stockTrackingEnabled ?? true);
  };

  const handleSaveBranchOverride = async () => {
    if (!overrideModalProduct || !effectiveBranchId) return;
    try {
      const overrideVal = branchPriceOverride.trim() ? parseFloat(branchPriceOverride) : undefined;
      await updateBranchProductPriceAndAlert(
        effectiveBranchId,
        overrideModalProduct.id,
        overrideVal,
        branchLowAlert,
        branchTrackStock
      );
      setMessage({ type: 'success', text: 'Branch pricing and stock thresholds saved!' });
      setOverrideModalProduct(null);
      await loadData();
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to save branch override.' });
    }
  };

  const filtered = products.filter((p) => {
    const matchCat = selectedCategoryId === 'all' || p.categoryId === selectedCategoryId;
    const matchSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCat && matchSearch;
  });

  if (!canViewCatalog) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center">
        <div className="bg-white rounded-2xl border border-[#EADBD6] p-8 shadow-xs space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-[#F8E7E5] text-[#70445B] flex items-center justify-center mx-auto">
            <Package className="w-6 h-6 text-[#D98591]" />
          </div>
          <h3 className="text-lg font-bold text-[#70445B]">Access Restricted</h3>
          <p className="text-xs text-[#79696D] max-w-md mx-auto leading-relaxed">
            The Product Catalog & Pricing management panel is restricted to administrative staff. Cashiers and operational staff operate through POS Billing.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Top Banner */}
      <div className="bg-white rounded-2xl p-6 border border-[#EADBD6] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-[#70445B] flex items-center gap-2">
            <Package className="w-5 h-5 text-[#D98591]" />
            Dessert Menu & Price Management
          </h2>
          <p className="text-xs text-[#79696D] mt-0.5">
            Manage recipes, default catalog pricing, and branch-specific price overrides
          </p>
        </div>

        <div className="flex items-center gap-2">
          {canManageCategories && (
            <button
              onClick={() => setShowCategoryModal(true)}
              className="px-3.5 py-2 text-xs font-semibold rounded-xl border border-[#EADBD6] hover:bg-[#F8E7E5] text-[#493A3E] transition flex items-center gap-1.5"
            >
              <Layers className="w-3.5 h-3.5" />
              + Add Category
            </button>
          )}
          {canCreate && (
            <button
              onClick={handleOpenAddProduct}
              className="px-4 py-2 text-xs font-bold rounded-xl bg-[#70445B] hover:bg-[#D98591] text-white shadow-xs transition flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              Create Product
            </button>
          )}
        </div>
      </div>

      {message && (
        <div
          className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
            message.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle className="w-4 h-4 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0" />
          )}
          <span>{message.text}</span>
          <button onClick={() => setMessage(null)} className="ml-auto font-bold">
            ✕
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl p-4 border border-[#EADBD6] shadow-xs flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          <button
            onClick={() => setSelectedCategoryId('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
              selectedCategoryId === 'all'
                ? 'bg-[#70445B] text-white'
                : 'bg-[#F8E7E5] text-[#493A3E] hover:bg-[#D98591]/20'
            }`}
          >
            All Categories ({products.length})
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedCategoryId(c.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
                selectedCategoryId === c.id
                  ? 'bg-[#70445B] text-white'
                  : 'bg-[#F8E7E5] text-[#493A3E] hover:bg-[#D98591]/20'
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64 shrink-0">
          <Search className="w-4 h-4 text-[#79696D] absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search items by name or SKU..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-[#EADBD6] bg-[#FFFCF8]"
          />
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-white rounded-2xl border border-[#EADBD6] shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#FFF9F0] border-b border-[#EADBD6] text-[#70445B] font-bold">
                <th className="py-3 px-4">Item & SKU</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Base Selling Price</th>
                <th className="py-3 px-4">Branch Override</th>
                {showCostPrice && <th className="py-3 px-4">Cost Price</th>}
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EADBD6]/60">
              {filtered.map((prod) => {
                const bp = branchProducts.find((b) => b.productId === prod.id);
                return (
                  <tr key={prod.id} className="hover:bg-[#FFFCF8] transition">
                    <td className="py-3 px-4">
                      <div className="font-bold text-[#493A3E]">{prod.name}</div>
                      <div className="text-[10px] text-[#79696D] font-mono">{prod.sku}</div>
                    </td>
                    <td className="py-3 px-4 text-[#79696D]">
                      {categories.find((c) => c.id === prod.categoryId)?.name || 'General'}
                    </td>
                    <td className="py-3 px-4 font-bold text-[#70445B]">₹{prod.globalSellingPrice}</td>
                    <td className="py-3 px-4">
                      {bp?.priceOverride !== undefined ? (
                        <span className="font-bold text-[#D98591]">₹{bp.priceOverride} (Custom)</span>
                      ) : (
                        <span className="text-[#79696D]">Default</span>
                      )}
                    </td>
                    {showCostPrice && <td className="py-3 px-4 text-[#79696D]">₹{prod.costPrice}</td>}
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          prod.active ? 'bg-emerald-100 text-emerald-800' : 'bg-neutral-100 text-neutral-600'
                        }`}
                      >
                        {prod.active ? 'Active' : 'Archived'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right space-x-1">
                      {/* Branch Override Button */}
                      {canChangePrice && (
                        <button
                          onClick={() => handleOpenBranchOverride(prod)}
                          title="Set Branch Price Override"
                          className="p-1.5 rounded-lg text-[#70445B] hover:bg-[#F8E7E5] transition"
                        >
                          <Tag className="w-4 h-4" />
                        </button>
                      )}
                      {/* Edit Button */}
                      {canEdit && (
                        <button
                          onClick={() => handleOpenEditProduct(prod)}
                          title="Edit Product"
                          className="p-1.5 rounded-lg text-[#79696D] hover:text-[#70445B] hover:bg-[#F8E7E5] transition"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit / Create Product Modal */}
      {editingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-[#EADBD6] max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-[#EADBD6] pb-3">
              <h3 className="font-bold text-lg text-[#70445B]">
                {isNewProduct ? 'Create New Dessert' : 'Edit Product Details'}
              </h3>
              <button onClick={() => setEditingProduct(null)} className="text-neutral-400 font-bold">
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-[#493A3E] block mb-1">Product Name:</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-[#EADBD6] bg-[#FFFCF8]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-[#493A3E] block mb-1">Category:</label>
                  <select
                    value={formData.categoryId}
                    onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-[#EADBD6] bg-[#FFFCF8]"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="font-bold text-[#493A3E] block mb-1">SKU Code:</label>
                  <input
                    type="text"
                    required
                    value={formData.sku}
                    onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-[#EADBD6] bg-[#FFFCF8]"
                  />
                </div>
              </div>

              {showCostPrice ? (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-[#493A3E] block mb-1">Global Selling Price (₹):</label>
                    <input
                      type="number"
                      required
                      min="0"
                      disabled={!canChangePrice}
                      value={formData.globalSellingPrice}
                      onChange={(e) =>
                        setFormData({ ...formData, globalSellingPrice: parseFloat(e.target.value) || 0 })
                      }
                      className="w-full px-3 py-2 rounded-xl border border-[#EADBD6] bg-[#FFFCF8] disabled:opacity-50"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-[#493A3E] block mb-1">Estimated Cost Price (₹):</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.costPrice}
                      onChange={(e) =>
                        setFormData({ ...formData, costPrice: parseFloat(e.target.value) || 0 })
                      }
                      className="w-full px-3 py-2 rounded-xl border border-[#EADBD6] bg-[#FFFCF8]"
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <label className="font-bold text-[#493A3E] block mb-1">Global Selling Price (₹):</label>
                  <input
                    type="number"
                    required
                    min="0"
                    disabled={!canChangePrice}
                    value={formData.globalSellingPrice}
                    onChange={(e) =>
                      setFormData({ ...formData, globalSellingPrice: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-[#EADBD6] bg-[#FFFCF8] disabled:opacity-50"
                  />
                </div>
              )}

              <div>
                <label className="font-bold text-[#493A3E] block mb-1">Description & Ingredients:</label>
                <textarea
                  rows={2}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-[#EADBD6] bg-[#FFFCF8]"
                />
              </div>

              {/* Status checkbox */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="prod-active"
                  checked={formData.active}
                  onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                  className="rounded text-[#D98591]"
                />
                <label htmlFor="prod-active" className="text-xs font-semibold text-[#493A3E]">
                  Active on POS Menu
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#EADBD6]">
                <button
                  type="button"
                  onClick={() => setEditingProduct(null)}
                  className="px-4 py-2 rounded-xl border border-[#EADBD6] font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#70445B] hover:bg-[#D98591] text-white font-bold transition"
                >
                  Save Product
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Branch Price Override Modal */}
      {overrideModalProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-[#EADBD6] max-w-md w-full p-6 shadow-2xl space-y-4">
            <div>
              <h3 className="font-bold text-lg text-[#70445B]">Branch Price Override</h3>
              <p className="text-xs text-[#79696D]">
                {overrideModalProduct.name} at{' '}
                <strong>{branches.find((b) => b.id === effectiveBranchId)?.name}</strong>
              </p>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-[#493A3E] block mb-1">
                  Custom Price Override (₹):
                </label>
                <input
                  type="number"
                  placeholder={`Default: ₹${overrideModalProduct.globalSellingPrice}`}
                  value={branchPriceOverride}
                  onChange={(e) => setBranchPriceOverride(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#EADBD6] bg-[#FFFCF8]"
                />
                <span className="text-[10px] text-[#79696D] mt-0.5 block">
                  Leave blank to use global default price (₹{overrideModalProduct.globalSellingPrice})
                </span>
              </div>

              <div>
                <label className="font-bold text-[#493A3E] block mb-1">Low Stock Warning Alert At:</label>
                <input
                  type="number"
                  value={branchLowAlert}
                  onChange={(e) => setBranchLowAlert(parseInt(e.target.value) || 10)}
                  className="w-full px-3 py-2 rounded-xl border border-[#EADBD6] bg-[#FFFCF8]"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="track-stock"
                  checked={branchTrackStock}
                  onChange={(e) => setBranchTrackStock(e.target.checked)}
                  className="rounded text-[#D98591]"
                />
                <label htmlFor="track-stock" className="font-semibold text-[#493A3E]">
                  Enforce stock tracking for this branch
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-[#EADBD6]">
              <button
                type="button"
                onClick={() => setOverrideModalProduct(null)}
                className="px-4 py-2 rounded-xl border border-[#EADBD6] font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveBranchOverride}
                className="px-5 py-2 rounded-xl bg-[#70445B] hover:bg-[#D98591] text-white font-bold transition"
              >
                Save Override
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Category Modal */}
      {showCategoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-[#EADBD6] max-w-sm w-full p-6 shadow-2xl space-y-4">
            <h3 className="font-bold text-lg text-[#70445B]">Add New Category</h3>
            <form onSubmit={handleSaveCategory} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-[#493A3E] block mb-1">Category Name:</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Gourmet Waffles"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#EADBD6] bg-[#FFFCF8]"
                />
              </div>
              <div>
                <label className="font-bold text-[#493A3E] block mb-1">Description:</label>
                <textarea
                  rows={2}
                  placeholder="Short description..."
                  value={newCategoryDesc}
                  onChange={(e) => setNewCategoryDesc(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#EADBD6] bg-[#FFFCF8]"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-[#EADBD6]">
                <button
                  type="button"
                  onClick={() => setShowCategoryModal(false)}
                  className="px-4 py-2 rounded-xl border border-[#EADBD6] font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#70445B] hover:bg-[#D98591] text-white font-bold"
                >
                  Save Category
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
