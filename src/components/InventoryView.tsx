import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Product, BranchProduct, InventoryMovement } from '../types';
import {
  getProducts,
  getBranchProducts,
  adjustBranchStock,
} from '../services/dbService';
import { hasPermission } from '../services/permissionService';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../firebase/config';
import {
  Layers,
  Plus,
  Minus,
  RefreshCw,
  Search,
  AlertTriangle,
  History,
  CheckCircle,
  AlertCircle,
  PackageCheck,
} from 'lucide-react';

export const InventoryView: React.FC = () => {
  const { userProfile, currentBranchId, branches } = useAuth();

  const [products, setProducts] = useState<Product[]>([]);
  const [branchProducts, setBranchProducts] = useState<BranchProduct[]>([]);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Adjustment Modal
  const [adjustingProduct, setAdjustingProduct] = useState<Product | null>(null);
  const [adjustQty, setAdjustQty] = useState<number>(0);
  const [adjustType, setAdjustType] = useState<InventoryMovement['movementType']>('restock');
  const [adjustReason, setAdjustReason] = useState<string>('');
  const [submittingAdjustment, setSubmittingAdjustment] = useState<boolean>(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const canAdjust = hasPermission(userProfile, 'inventory.adjust');
  const canReceive = hasPermission(userProfile, 'inventory.receive');

  const effectiveBranchId = currentBranchId !== 'all' ? currentBranchId : branches[0]?.id;
  const currentBranchName = branches.find((b) => b.id === effectiveBranchId)?.name || 'Branch';

  const loadInventory = async () => {
    if (!effectiveBranchId) return;
    try {
      setLoading(true);
      const [prods, bp] = await Promise.all([getProducts(), getBranchProducts(effectiveBranchId)]);
      setProducts(prods);
      setBranchProducts(bp);

      // Load recent movements for this branch
      const movSnap = await getDocs(
        query(
          collection(db, 'inventoryMovements'),
          where('branchId', '==', effectiveBranchId),
          orderBy('createdAt', 'desc'),
          limit(50)
        )
      );
      setMovements(movSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<InventoryMovement, 'id'>) })));
    } catch (err) {
      console.error('Error loading inventory:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInventory();
  }, [effectiveBranchId]);

  const handleOpenAdjust = (p: Product, defaultType: InventoryMovement['movementType'] = 'restock') => {
    setAdjustingProduct(p);
    setAdjustType(defaultType);
    setAdjustQty(defaultType === 'restock' ? 20 : 1);
    setAdjustReason(defaultType === 'restock' ? 'Vendor Delivery / Restock' : 'Ingredient spoilage / waste');
  };

  const handleExecuteAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustingProduct || !effectiveBranchId) return;
    if (adjustQty <= 0) {
      setMessage({ type: 'error', text: 'Adjustment quantity must be greater than zero.' });
      return;
    }

    try {
      setSubmittingAdjustment(true);
      const isPositive = adjustType === 'restock' || adjustType === 'transfer_in' || adjustType === 'return';
      const change = isPositive ? adjustQty : -adjustQty;

      await adjustBranchStock(
        effectiveBranchId,
        adjustingProduct.id,
        adjustingProduct.name,
        change,
        adjustType,
        adjustReason.trim() || 'Inventory stock audit',
        {
          id: userProfile?.id || 'staff',
          name: userProfile?.displayName || 'Staff',
        }
      );

      setMessage({ type: 'success', text: `Stock adjusted for ${adjustingProduct.name}!` });
      setAdjustingProduct(null);
      await loadInventory();
    } catch (err) {
      console.error('Stock adjustment error:', err);
      setMessage({ type: 'error', text: 'Failed to adjust stock. Permission denied.' });
    } finally {
      setSubmittingAdjustment(false);
    }
  };

  const filtered = products.filter((p) => p.name.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Banner */}
      <div className="bg-white rounded-2xl p-6 border border-[#EADBD6] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-[#70445B] flex items-center gap-2">
            <Layers className="w-5 h-5 text-[#D98591]" />
            Branch Inventory & Stock Control
          </h2>
          <p className="text-xs text-[#79696D] mt-0.5">
            Real-time stock balance for <strong>{currentBranchName}</strong>
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative w-64">
            <Search className="w-4 h-4 text-[#79696D] absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search product inventory..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-[#EADBD6] bg-[#FFFCF8]"
            />
          </div>
          <button
            onClick={loadInventory}
            className="p-2 rounded-xl border border-[#EADBD6] hover:bg-[#F8E7E5] text-[#70445B]"
            title="Refresh Stock"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
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

      {/* Stock Balance Table */}
      <div className="bg-white rounded-2xl border border-[#EADBD6] shadow-xs overflow-hidden">
        <div className="p-4 bg-[#FFF9F0] border-b border-[#EADBD6] font-bold text-sm text-[#70445B] flex items-center justify-between">
          <span>Current Stock on Hand ({filtered.length} items)</span>
          <span className="text-xs text-[#79696D] font-normal">Tracked at {currentBranchName}</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[#EADBD6] text-[#79696D] font-bold">
                <th className="py-3 px-4">Item & SKU</th>
                <th className="py-3 px-4">Tracking</th>
                <th className="py-3 px-4 text-center">Available Stock</th>
                <th className="py-3 px-4 text-center">Low Stock Alert</th>
                <th className="py-3 px-4 text-right">Stock Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EADBD6]/60">
              {filtered.map((prod) => {
                const bp = branchProducts.find((b) => b.productId === prod.id);
                const stock = bp ? bp.stockQuantity : 0;
                const isTracking = bp?.stockTrackingEnabled ?? true;
                const alertThreshold = bp?.lowStockAlert || 10;
                const isLow = isTracking && stock <= alertThreshold;

                return (
                  <tr key={prod.id} className="hover:bg-[#FFFCF8] transition">
                    <td className="py-3 px-4">
                      <div className="font-bold text-[#493A3E]">{prod.name}</div>
                      <div className="text-[10px] text-[#79696D] font-mono">{prod.sku}</div>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          isTracking ? 'bg-blue-50 text-blue-700' : 'bg-neutral-100 text-neutral-600'
                        }`}
                      >
                        {isTracking ? 'Enabled' : 'Disabled'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`text-sm font-black px-2.5 py-0.5 rounded-lg inline-block ${
                          !isTracking
                            ? 'text-neutral-500'
                            : stock <= 0
                            ? 'bg-rose-100 text-rose-800'
                            : isLow
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {isTracking ? `${stock} units` : 'Untracked'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center text-[#79696D] font-mono">
                      ≤ {alertThreshold} units
                    </td>
                    <td className="py-3 px-4 text-right space-x-1.5">
                      {canReceive && (
                        <button
                          onClick={() => handleOpenAdjust(prod, 'restock')}
                          className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-semibold text-[11px] transition inline-flex items-center gap-1"
                        >
                          <Plus className="w-3 h-3" /> Restock
                        </button>
                      )}
                      {canAdjust && (
                        <button
                          onClick={() => handleOpenAdjust(prod, 'waste')}
                          className="px-2.5 py-1 rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 font-semibold text-[11px] transition inline-flex items-center gap-1"
                        >
                          <Minus className="w-3 h-3" /> Waste / Deduct
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

      {/* Stock Movement Audit Log */}
      <div className="bg-white rounded-2xl border border-[#EADBD6] shadow-xs overflow-hidden">
        <div className="p-4 bg-[#FFF9F0] border-b border-[#EADBD6] font-bold text-sm text-[#70445B] flex items-center gap-2">
          <History className="w-4 h-4 text-[#D98591]" />
          Recent Stock Movement History (Audit Trail)
        </div>
        <div className="overflow-x-auto max-h-72">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[#EADBD6] text-[#79696D] font-bold">
                <th className="py-2.5 px-4">Timestamp</th>
                <th className="py-2.5 px-4">Item</th>
                <th className="py-2.5 px-4">Type</th>
                <th className="py-2.5 px-4 text-center">Qty Change</th>
                <th className="py-2.5 px-4">Reason / Order</th>
                <th className="py-2.5 px-4">Actor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EADBD6]/60">
              {movements.map((m) => (
                <tr key={m.id} className="hover:bg-[#FFFCF8]">
                  <td className="py-2.5 px-4 text-[#79696D]">
                    {new Date(m.createdAt).toLocaleTimeString()} ({new Date(m.createdAt).toLocaleDateString()})
                  </td>
                  <td className="py-2.5 px-4 font-semibold text-[#493A3E]">{m.productName}</td>
                  <td className="py-2.5 px-4 capitalize">
                    <span className="font-medium text-[#70445B]">{m.movementType.replace('_', ' ')}</span>
                  </td>
                  <td className="py-2.5 px-4 text-center font-bold">
                    <span className={m.quantityChange > 0 ? 'text-emerald-700' : 'text-rose-700'}>
                      {m.quantityChange > 0 ? `+${m.quantityChange}` : m.quantityChange}
                    </span>
                  </td>
                  <td className="py-2.5 px-4 text-[#79696D]">{m.reason}</td>
                  <td className="py-2.5 px-4 font-medium text-[#493A3E]">{m.actorName}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Stock Adjustment Modal */}
      {adjustingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-[#EADBD6] max-w-md w-full p-6 shadow-2xl space-y-4">
            <div>
              <h3 className="font-bold text-lg text-[#70445B]">Adjust Inventory</h3>
              <p className="text-xs text-[#79696D]">
                {adjustingProduct.name} at <strong>{currentBranchName}</strong>
              </p>
            </div>

            <form onSubmit={handleExecuteAdjustment} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-[#493A3E] block mb-1">Adjustment Type:</label>
                <select
                  value={adjustType}
                  onChange={(e) => setAdjustType(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl border border-[#EADBD6] bg-[#FFFCF8]"
                >
                  <option value="restock">Restock / Inward Shipment (+)</option>
                  <option value="adjustment">Stock Audit Correction (Manual)</option>
                  <option value="waste">Wastage / Spoilage / Expired (-)</option>
                  <option value="return">Customer Return (+)</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-[#493A3E] block mb-1">Quantity (Units):</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={adjustQty}
                  onChange={(e) => setAdjustQty(parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 rounded-xl border border-[#EADBD6] bg-[#FFFCF8] font-bold text-sm"
                />
              </div>

              <div>
                <label className="font-bold text-[#493A3E] block mb-1">Reason / Notes:</label>
                <textarea
                  rows={2}
                  required
                  placeholder="e.g. Received shipment from milk dairy, Invoice #884"
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#EADBD6] bg-[#FFFCF8]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#EADBD6]">
                <button
                  type="button"
                  onClick={() => setAdjustingProduct(null)}
                  className="px-4 py-2 rounded-xl border border-[#EADBD6] font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingAdjustment}
                  className="px-5 py-2 rounded-xl bg-[#70445B] hover:bg-[#D98591] text-white font-bold transition disabled:opacity-50"
                >
                  {submittingAdjustment ? 'Saving...' : 'Confirm Adjustment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
