import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { StockTransfer, Product, TransferItem } from '../types';
import {
  getStockTransfers,
  createStockTransfer,
  dispatchStockTransfer,
  receiveStockTransfer,
  getProducts,
} from '../services/dbService';
import { hasPermission } from '../services/permissionService';
import {
  ArrowLeftRight,
  Plus,
  Send,
  PackageCheck,
  CheckCircle,
  AlertCircle,
  Clock,
  Trash2,
} from 'lucide-react';

export const TransfersView: React.FC = () => {
  const { userProfile, currentBranchId, branches } = useAuth();

  const [transfers, setTransfers] = useState<StockTransfer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [showNewModal, setShowNewModal] = useState<boolean>(false);

  // New transfer form
  const [sourceBranchId, setSourceBranchId] = useState<string>('');
  const [destBranchId, setDestBranchId] = useState<string>('');
  const [transferItems, setTransferItems] = useState<TransferItem[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [itemQuantity, setItemQuantity] = useState<number>(10);
  const [transferNotes, setTransferNotes] = useState<string>('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const canCreate = hasPermission(userProfile, 'transfers.create');
  const canDispatch = hasPermission(userProfile, 'transfers.dispatch');
  const canReceive = hasPermission(userProfile, 'transfers.receive');

  const loadData = async () => {
    try {
      setLoading(true);
      const [tList, pList] = await Promise.all([getStockTransfers(currentBranchId), getProducts()]);
      setTransfers(tList);
      setProducts(pList.filter((p) => p.active));

      if (branches.length >= 2) {
        setSourceBranchId(branches[0].id);
        setDestBranchId(branches[1].id);
      }
    } catch (e) {
      console.error('Error fetching stock transfers:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentBranchId]);

  const handleAddItemToTransfer = () => {
    if (!selectedProductId || itemQuantity <= 0) return;
    const prod = products.find((p) => p.id === selectedProductId);
    if (!prod) return;

    if (transferItems.some((i) => i.productId === selectedProductId)) {
      setMessage({ type: 'error', text: 'Item already added to transfer list.' });
      return;
    }

    setTransferItems([
      ...transferItems,
      {
        productId: prod.id,
        productName: prod.name,
        quantity: itemQuantity,
      },
    ]);
    setSelectedProductId('');
    setItemQuantity(10);
    setMessage(null);
  };

  const handleRemoveTransferItem = (idx: number) => {
    setTransferItems(transferItems.filter((_, i) => i !== idx));
  };

  const handleCreateTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sourceBranchId === destBranchId) {
      setMessage({ type: 'error', text: 'Source and Destination branches cannot be the same.' });
      return;
    }
    if (transferItems.length === 0) {
      setMessage({ type: 'error', text: 'Please add at least one product item to transfer.' });
      return;
    }

    try {
      const srcName = branches.find((b) => b.id === sourceBranchId)?.name || 'Source Branch';
      const destName = branches.find((b) => b.id === destBranchId)?.name || 'Destination Branch';

      await createStockTransfer({
        sourceBranchId,
        sourceBranchName: srcName,
        destinationBranchId: destBranchId,
        destinationBranchName: destName,
        items: transferItems,
        status: 'draft',
        createdBy: userProfile?.id || 'staff',
        createdByName: userProfile?.displayName || 'Staff',
        notes: transferNotes.trim() || '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      setMessage({ type: 'success', text: 'Stock transfer request created in Draft state!' });
      setShowNewModal(false);
      setTransferItems([]);
      setTransferNotes('');
      await loadData();
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to create transfer request.' });
    }
  };

  const handleDispatch = async (t: StockTransfer) => {
    if (!confirm(`Dispatch transfer #${t.transferNumber}? Stock will be deducted from ${t.sourceBranchName}.`)) {
      return;
    }
    try {
      await dispatchStockTransfer(t, {
        id: userProfile?.id || 'staff',
        name: userProfile?.displayName || 'Staff',
      });
      setMessage({ type: 'success', text: `Transfer #${t.transferNumber} marked as Dispatched!` });
      await loadData();
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to dispatch transfer. Permission denied.' });
    }
  };

  const handleReceive = async (t: StockTransfer) => {
    if (
      !confirm(
        `Receive transfer #${t.transferNumber}? Stock will be added to ${t.destinationBranchName}.`
      )
    ) {
      return;
    }
    try {
      await receiveStockTransfer(t, {
        id: userProfile?.id || 'staff',
        name: userProfile?.displayName || 'Staff',
      });
      setMessage({ type: 'success', text: `Transfer #${t.transferNumber} received and stock updated!` });
      await loadData();
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to receive transfer. Permission denied.' });
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Banner */}
      <div className="bg-white rounded-2xl p-6 border border-[#EADBD6] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-[#70445B] flex items-center gap-2">
            <ArrowLeftRight className="w-5 h-5 text-[#D98591]" />
            Inter-Branch Stock Transfers
          </h2>
          <p className="text-xs text-[#79696D] mt-0.5">
            Auditable movement of falooda ingredients and inventory between branch locations
          </p>
        </div>

        {canCreate && (
          <button
            onClick={() => setShowNewModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[#70445B] hover:bg-[#D98591] text-white text-xs font-bold rounded-xl shadow-xs transition"
          >
            <Plus className="w-4 h-4" />
            Initiate Stock Transfer
          </button>
        )}
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

      {/* Transfers List */}
      <div className="bg-white rounded-2xl border border-[#EADBD6] shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#FFF9F0] border-b border-[#EADBD6] text-[#70445B] font-bold">
                <th className="py-3 px-4">Transfer #</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Source Branch</th>
                <th className="py-3 px-4">Destination Branch</th>
                <th className="py-3 px-4">Items Transferred</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EADBD6]/60">
              {transfers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-[#79696D]">
                    No stock transfers recorded yet.
                  </td>
                </tr>
              ) : (
                transfers.map((t) => (
                  <tr key={t.id} className="hover:bg-[#FFFCF8] transition">
                    <td className="py-3 px-4 font-mono font-bold text-[#70445B]">#{t.transferNumber}</td>
                    <td className="py-3 px-4 text-[#79696D]">{new Date(t.createdAt).toLocaleDateString()}</td>
                    <td className="py-3 px-4 font-medium text-[#493A3E]">{t.sourceBranchName}</td>
                    <td className="py-3 px-4 font-medium text-[#493A3E]">{t.destinationBranchName}</td>
                    <td className="py-3 px-4">
                      <span className="font-semibold text-[#493A3E]">
                        {t.items.reduce((s, i) => s + i.quantity, 0)} units
                      </span>
                      <div className="text-[10px] text-[#79696D] truncate max-w-[200px]">
                        {t.items.map((i) => `${i.productName} (${i.quantity})`).join(', ')}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          t.status === 'received'
                            ? 'bg-emerald-100 text-emerald-800'
                            : t.status === 'dispatched'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {t.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right space-x-1.5">
                      {t.status === 'draft' && canDispatch && (
                        <button
                          onClick={() => handleDispatch(t)}
                          className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 font-semibold text-[11px] inline-flex items-center gap-1"
                        >
                          <Send className="w-3 h-3" /> Dispatch
                        </button>
                      )}
                      {t.status === 'dispatched' && canReceive && (
                        <button
                          onClick={() => handleReceive(t)}
                          className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-semibold text-[11px] inline-flex items-center gap-1"
                        >
                          <PackageCheck className="w-3 h-3" /> Confirm Receipt
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Transfer Modal */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-[#EADBD6] max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-[#EADBD6] pb-3">
              <h3 className="font-bold text-lg text-[#70445B]">Initiate Inter-Branch Transfer</h3>
              <button onClick={() => setShowNewModal(false)} className="text-neutral-400 font-bold">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateTransfer} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-[#493A3E] block mb-1">Source Branch (From):</label>
                  <select
                    value={sourceBranchId}
                    onChange={(e) => setSourceBranchId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#EADBD6] bg-[#FFFCF8]"
                  >
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="font-bold text-[#493A3E] block mb-1">Destination Branch (To):</label>
                  <select
                    value={destBranchId}
                    onChange={(e) => setDestBranchId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#EADBD6] bg-[#FFFCF8]"
                  >
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Add item to transfer row */}
              <div className="p-3 bg-[#FFF9F0] rounded-xl border border-[#EADBD6] space-y-2">
                <span className="font-bold text-[#70445B] block">Add Products to Transfer:</span>
                <div className="flex gap-2">
                  <select
                    value={selectedProductId}
                    onChange={(e) => setSelectedProductId(e.target.value)}
                    className="flex-1 px-3 py-1.5 rounded-lg border border-[#EADBD6] bg-white text-xs"
                  >
                    <option value="">Select item to transfer...</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.sku})
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min="1"
                    placeholder="Qty"
                    value={itemQuantity}
                    onChange={(e) => setItemQuantity(parseInt(e.target.value) || 1)}
                    className="w-20 px-2 py-1.5 rounded-lg border border-[#EADBD6] bg-white text-xs font-bold text-center"
                  />
                  <button
                    type="button"
                    onClick={handleAddItemToTransfer}
                    className="px-3 py-1.5 rounded-lg bg-[#70445B] text-white font-semibold text-xs hover:bg-[#D98591]"
                  >
                    + Add
                  </button>
                </div>

                {/* List of items added */}
                {transferItems.length > 0 && (
                  <div className="space-y-1 pt-2 border-t border-[#EADBD6]/60">
                    {transferItems.map((item, idx) => (
                      <div
                        key={idx}
                        className="flex justify-between items-center bg-white p-2 rounded-lg border border-[#EADBD6]"
                      >
                        <span className="font-semibold text-[#493A3E]">{item.productName}</span>
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-[#70445B]">{item.quantity} units</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveTransferItem(idx)}
                            className="text-rose-600 hover:text-rose-800"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="font-bold text-[#493A3E] block mb-1">Transfer Notes (Optional):</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Rush weekend replenishment for ice cream base"
                  value={transferNotes}
                  onChange={(e) => setTransferNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#EADBD6] bg-[#FFFCF8]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#EADBD6]">
                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
                  className="px-4 py-2 rounded-xl border border-[#EADBD6] font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#70445B] hover:bg-[#D98591] text-white font-bold transition"
                >
                  Create Transfer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
