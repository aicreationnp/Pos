import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { Order, Refund } from '../types';
import { getOrders, processRefund } from '../services/dbService';
import { hasPermission } from '../services/permissionService';
import { ReceiptModal } from './ReceiptModal';
import {
  Search,
  Filter,
  Printer,
  RotateCcw,
  Eye,
  CheckCircle,
  XCircle,
  Clock,
  Calendar,
  CreditCard,
  Banknote,
  QrCode,
  AlertCircle,
  CupSoda,
} from 'lucide-react';

export const OrdersView: React.FC = () => {
  const { userProfile, currentBranchId, branches } = useAuth();

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [paymentFilter, setPaymentFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('all'); // all, today, week, month

  // Modal states
  const [selectedOrderForDetails, setSelectedOrderForDetails] = useState<Order | null>(null);
  const [selectedOrderForPrint, setSelectedOrderForPrint] = useState<Order | null>(null);
  const [selectedOrderForRefund, setSelectedOrderForRefund] = useState<Order | null>(null);

  // Refund form state
  const [refundType, setRefundType] = useState<'full' | 'partial'>('full');
  const [refundAmount, setRefundAmount] = useState<number>(0);
  const [refundReason, setRefundReason] = useState<string>('');
  const [processingRefund, setProcessingRefund] = useState<boolean>(false);
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );

  const canApproveRefund = hasPermission(userProfile, 'refunds.approve');
  const canCreateRefund = hasPermission(userProfile, 'refunds.create');

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const list = await getOrders(currentBranchId, 150);
      setOrders(list);
    } catch (err) {
      console.error('Failed to fetch orders:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [currentBranchId]);

  // Date filtering logic
  const filteredOrders = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const sevenDaysAgo = todayStart - 7 * 24 * 60 * 60 * 1000;
    const thirtyDaysAgo = todayStart - 30 * 24 * 60 * 60 * 1000;

    return orders.filter((o) => {
      const orderTime = new Date(o.createdAt).getTime();

      // Search match
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        o.receiptNumber.toLowerCase().includes(q) ||
        o.cashierName?.toLowerCase().includes(q) ||
        o.customerName?.toLowerCase().includes(q) ||
        o.items.some((i) => i.productName.toLowerCase().includes(q));

      // Status match
      const matchesStatus = statusFilter === 'all' || o.status === statusFilter;

      // Payment match
      const matchesPayment = paymentFilter === 'all' || o.paymentMethod === paymentFilter;

      // Date match
      let matchesDate = true;
      if (dateFilter === 'today') {
        matchesDate = orderTime >= todayStart;
      } else if (dateFilter === 'week') {
        matchesDate = orderTime >= sevenDaysAgo;
      } else if (dateFilter === 'month') {
        matchesDate = orderTime >= thirtyDaysAgo;
      }

      return matchesSearch && matchesStatus && matchesPayment && matchesDate;
    });
  }, [orders, searchQuery, statusFilter, paymentFilter, dateFilter]);

  // Open refund modal
  const handleOpenRefund = (order: Order) => {
    setSelectedOrderForRefund(order);
    setRefundType('full');
    setRefundAmount(order.totalAmount);
    setRefundReason('');
    setFeedbackMessage(null);
  };

  const handleExecuteRefund = async () => {
    if (!selectedOrderForRefund) return;
    if (refundAmount <= 0 || refundAmount > selectedOrderForRefund.totalAmount) {
      setFeedbackMessage({
        type: 'error',
        text: `Refund amount must be between ₹1 and ₹${selectedOrderForRefund.totalAmount}`,
      });
      return;
    }
    if (!refundReason.trim()) {
      setFeedbackMessage({ type: 'error', text: 'Please provide a valid reason for this refund.' });
      return;
    }

    try {
      setProcessingRefund(true);
      await processRefund(
        selectedOrderForRefund,
        refundAmount,
        refundType,
        refundReason,
        {
          id: userProfile?.id || 'admin',
          name: userProfile?.displayName || 'Admin',
        }
      );
      setFeedbackMessage({ type: 'success', text: 'Refund processed successfully.' });
      setSelectedOrderForRefund(null);
      await fetchOrders();
    } catch (err) {
      console.error('Refund failed:', err);
      setFeedbackMessage({ type: 'error', text: 'Failed to process refund. Check permissions.' });
    } finally {
      setProcessingRefund(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Top Title & Filters */}
      <div className="bg-white rounded-2xl p-6 border border-[#EADBD6] shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-[#70445B] flex items-center gap-2">
              <Clock className="w-5 h-5 text-[#D98591]" />
              Order & Transaction History
            </h2>
            <p className="text-xs text-[#79696D] mt-0.5">
              Review past sales, customer receipts, and process authorized refunds
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-3 py-1 rounded-full bg-[#F8E7E5] text-[#70445B]">
              Showing {filteredOrders.length} orders
            </span>
            <button
              onClick={fetchOrders}
              className="text-xs font-semibold px-3 py-1.5 rounded-xl border border-[#EADBD6] hover:bg-[#F8E7E5] transition"
            >
              Refresh
            </button>
          </div>
        </div>

        {/* Filters Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 text-[#79696D] absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Receipt #, Cashier, Item..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-[#EADBD6] bg-[#FFFCF8]"
            />
          </div>

          {/* Date Filter */}
          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="px-3 py-2 text-xs rounded-xl border border-[#EADBD6] bg-[#FFFCF8] text-[#493A3E]"
          >
            <option value="all">📅 All Dates</option>
            <option value="today">Today</option>
            <option value="week">Last 7 Days</option>
            <option value="month">Last 30 Days</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-xs rounded-xl border border-[#EADBD6] bg-[#FFFCF8] text-[#493A3E]"
          >
            <option value="all">Status: All</option>
            <option value="completed">Completed</option>
            <option value="refunded">Fully Refunded</option>
            <option value="partially_refunded">Partially Refunded</option>
          </select>

          {/* Payment Method Filter */}
          <select
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value)}
            className="px-3 py-2 text-xs rounded-xl border border-[#EADBD6] bg-[#FFFCF8] text-[#493A3E]"
          >
            <option value="all">Payment: All</option>
            <option value="cash">Cash</option>
            <option value="digital_wallet">UPI / QR</option>
            <option value="card">Card</option>
          </select>
        </div>
      </div>

      {feedbackMessage && (
        <div
          className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
            feedbackMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          {feedbackMessage.type === 'success' ? (
            <CheckCircle className="w-4 h-4 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0" />
          )}
          <span>{feedbackMessage.text}</span>
          <button onClick={() => setFeedbackMessage(null)} className="ml-auto font-bold">
            ✕
          </button>
        </div>
      )}

      {/* Orders Table */}
      <div className="bg-white rounded-2xl border border-[#EADBD6] shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-[#79696D]">
            <CupSoda className="w-8 h-8 text-[#D98591] animate-spin mx-auto mb-2" />
            <p className="text-xs">Loading order transactions...</p>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="p-12 text-center text-[#79696D]">
            <p className="font-bold text-sm text-[#493A3E]">No transactions found</p>
            <p className="text-xs mt-1">Orders created at the POS counter will appear here</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#FFF9F0] border-b border-[#EADBD6] text-[#70445B] font-bold">
                  <th className="py-3 px-4">Receipt #</th>
                  <th className="py-3 px-4">Date & Time</th>
                  <th className="py-3 px-4">Branch</th>
                  <th className="py-3 px-4">Items</th>
                  <th className="py-3 px-4">Payment</th>
                  <th className="py-3 px-4">Total Amount</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EADBD6]/60">
                {filteredOrders.map((order) => {
                  const isRefunded = order.status === 'refunded' || order.status === 'partially_refunded';
                  return (
                    <tr key={order.id} className="hover:bg-[#FFFCF8] transition">
                      <td className="py-3 px-4 font-mono font-bold text-[#70445B]">
                        #{order.receiptNumber}
                      </td>
                      <td className="py-3 px-4 text-[#79696D]">
                        {new Date(order.createdAt).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 font-medium text-[#493A3E]">
                        {order.branchName}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-semibold text-[#493A3E]">
                          {order.items.reduce((s, i) => s + i.quantity, 0)} items
                        </span>
                        <div className="text-[10px] text-[#79696D] truncate max-w-[200px]">
                          {order.items.map((i) => `${i.productName} (${i.quantity})`).join(', ')}
                        </div>
                      </td>
                      <td className="py-3 px-4 capitalize">
                        <span className="inline-flex items-center gap-1 font-medium text-[#493A3E]">
                          {order.paymentMethod === 'cash' ? (
                            <Banknote className="w-3.5 h-3.5 text-emerald-600" />
                          ) : order.paymentMethod === 'digital_wallet' ? (
                            <QrCode className="w-3.5 h-3.5 text-indigo-600" />
                          ) : (
                            <CreditCard className="w-3.5 h-3.5 text-blue-600" />
                          )}
                          {order.paymentMethod.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-extrabold text-[#70445B]">
                        ₹{order.totalAmount.toFixed(2)}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full font-bold text-[10px] uppercase ${
                            order.status === 'completed'
                              ? 'bg-emerald-100 text-emerald-800'
                              : order.status === 'refunded'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {order.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right space-x-1">
                        {/* Details */}
                        <button
                          onClick={() => setSelectedOrderForDetails(order)}
                          title="View order details"
                          className="p-1.5 rounded-lg text-[#79696D] hover:text-[#70445B] hover:bg-[#F8E7E5] transition"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {/* Print Receipt */}
                        <button
                          onClick={() => setSelectedOrderForPrint(order)}
                          title="Reprint Receipt"
                          className="p-1.5 rounded-lg text-[#79696D] hover:text-[#70445B] hover:bg-[#F8E7E5] transition"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                        {/* Refund Action */}
                        {(canApproveRefund || canCreateRefund) && order.status === 'completed' && (
                          <button
                            onClick={() => handleOpenRefund(order)}
                            title="Process Refund"
                            className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 transition"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Order Details Modal */}
      {selectedOrderForDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-[#EADBD6] max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-start border-b border-[#EADBD6] pb-3">
              <div>
                <h3 className="font-bold text-lg text-[#70445B]">
                  Order #{selectedOrderForDetails.receiptNumber}
                </h3>
                <p className="text-xs text-[#79696D]">
                  {selectedOrderForDetails.branchName} • {new Date(selectedOrderForDetails.createdAt).toLocaleString()}
                </p>
              </div>
              <button
                onClick={() => setSelectedOrderForDetails(null)}
                className="text-neutral-400 hover:text-neutral-700 font-bold"
              >
                ✕
              </button>
            </div>

            {/* Line items list */}
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {selectedOrderForDetails.items.map((item, idx) => (
                <div key={idx} className="flex justify-between items-center text-xs p-2 rounded-xl bg-[#FFF9F0]">
                  <div>
                    <span className="font-bold text-[#493A3E]">{item.productName}</span>
                    {item.variant && (
                      <span className="text-[10px] text-[#79696D] ml-1.5">({item.variant.name})</span>
                    )}
                    {item.selectedAddOns && item.selectedAddOns.length > 0 && (
                      <div className="text-[10px] text-[#D98591]">
                        Toppings: {item.selectedAddOns.map((a) => a.name).join(', ')}
                      </div>
                    )}
                    <div className="text-[10px] text-[#79696D]">
                      {item.quantity} × ₹{item.unitPrice.toFixed(2)}
                    </div>
                  </div>
                  <span className="font-bold text-[#70445B]">₹{item.itemSubtotal.toFixed(2)}</span>
                </div>
              ))}
            </div>

            {/* Summary */}
            <div className="space-y-1 text-xs border-t border-[#EADBD6] pt-3 text-[#79696D]">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>₹{selectedOrderForDetails.subtotal.toFixed(2)}</span>
              </div>
              {selectedOrderForDetails.discountAmount > 0 && (
                <div className="flex justify-between text-emerald-700">
                  <span>Discount:</span>
                  <span>-₹{selectedOrderForDetails.discountAmount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>GST/Tax ({selectedOrderForDetails.taxRate || 0}%):</span>
                <span>{selectedOrderForDetails.taxAmount > 0 ? `₹${selectedOrderForDetails.taxAmount.toFixed(2)}` : '₹0.00 (No Tax)'}</span>
              </div>
              <div className="flex justify-between font-bold text-sm text-[#70445B] pt-1">
                <span>Total Amount:</span>
                <span>₹{selectedOrderForDetails.totalAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between pt-1">
                <span>Cashier:</span>
                <span>{selectedOrderForDetails.cashierName}</span>
              </div>
              {selectedOrderForDetails.customerName && (
                <div className="flex justify-between">
                  <span>Customer:</span>
                  <span>
                    {selectedOrderForDetails.customerName}{' '}
                    {selectedOrderForDetails.customerPhone ? `(${selectedOrderForDetails.customerPhone})` : ''}
                  </span>
                </div>
              )}
              {selectedOrderForDetails.orderNotes && (
                <div className="p-2 bg-[#FFFCF8] rounded-lg text-[11px] text-[#493A3E] mt-2">
                  <strong>Notes:</strong> {selectedOrderForDetails.orderNotes}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[#EADBD6]">
              <button
                onClick={() => {
                  setSelectedOrderForPrint(selectedOrderForDetails);
                  setSelectedOrderForDetails(null);
                }}
                className="px-4 py-2 rounded-xl bg-[#70445B] text-white text-xs font-semibold hover:bg-[#D98591] flex items-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" />
                Reprint Receipt
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Refund Modal */}
      {selectedOrderForRefund && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-[#EADBD6] max-w-md w-full p-6 shadow-2xl space-y-4">
            <div>
              <h3 className="font-bold text-lg text-rose-700 flex items-center gap-2">
                <RotateCcw className="w-5 h-5" />
                Process Order Refund
              </h3>
              <p className="text-xs text-[#79696D]">
                Receipt #{selectedOrderForRefund.receiptNumber} • Original Total: ₹
                {selectedOrderForRefund.totalAmount.toFixed(2)}
              </p>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-[#493A3E] block mb-1">Refund Type:</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setRefundType('full');
                      setRefundAmount(selectedOrderForRefund.totalAmount);
                    }}
                    className={`py-2 rounded-xl font-bold border transition ${
                      refundType === 'full'
                        ? 'bg-rose-100 text-rose-800 border-rose-300'
                        : 'bg-neutral-50 text-[#493A3E] border-[#EADBD6]'
                    }`}
                  >
                    Full Refund (₹{selectedOrderForRefund.totalAmount.toFixed(2)})
                  </button>
                  <button
                    type="button"
                    onClick={() => setRefundType('partial')}
                    className={`py-2 rounded-xl font-bold border transition ${
                      refundType === 'partial'
                        ? 'bg-rose-100 text-rose-800 border-rose-300'
                        : 'bg-neutral-50 text-[#493A3E] border-[#EADBD6]'
                    }`}
                  >
                    Partial Refund
                  </button>
                </div>
              </div>

              {refundType === 'partial' && (
                <div>
                  <label className="font-bold text-[#493A3E] block mb-1">Refund Amount (₹):</label>
                  <input
                    type="number"
                    max={selectedOrderForRefund.totalAmount}
                    min="1"
                    value={refundAmount}
                    onChange={(e) => setRefundAmount(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 rounded-xl border border-[#EADBD6] bg-[#FFFCF8]"
                  />
                </div>
              )}

              <div>
                <label className="font-bold text-[#493A3E] block mb-1">Reason for Refund:</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Incorrect topping, customer cancelled before preparation..."
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#EADBD6] bg-[#FFFCF8]"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[#EADBD6]">
              <button
                type="button"
                onClick={() => setSelectedOrderForRefund(null)}
                className="px-4 py-2 rounded-xl border border-[#EADBD6] text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={processingRefund}
                onClick={handleExecuteRefund}
                className="px-5 py-2 rounded-xl bg-rose-700 hover:bg-rose-800 text-white text-xs font-bold transition disabled:opacity-50"
              >
                {processingRefund ? 'Refunding...' : 'Confirm Refund'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reprint Receipt Modal */}
      {selectedOrderForPrint && (
        <ReceiptModal
          order={selectedOrderForPrint}
          branch={branches.find((b) => b.id === selectedOrderForPrint.branchId)}
          onClose={() => setSelectedOrderForPrint(null)}
        />
      )}
    </div>
  );
};
