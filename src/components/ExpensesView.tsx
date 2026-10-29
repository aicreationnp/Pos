import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Expense } from '../types';
import { getExpenses, saveExpense } from '../services/dbService';
import { hasPermission } from '../services/permissionService';
import { ReceiptIndianRupee, Plus, CheckCircle, AlertCircle, Calendar, Tag } from 'lucide-react';

export const ExpensesView: React.FC = () => {
  const { userProfile, currentBranchId, branches } = useAuth();

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [showModal, setShowModal] = useState<boolean>(false);

  // Form State
  const [description, setDescription] = useState<string>('');
  const [category, setCategory] = useState<string>('Ingredients');
  const [amount, setAmount] = useState<number>(0);
  const [branchId, setBranchId] = useState<string>('all');
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState<string>('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const canView = hasPermission(userProfile, 'expenses.view');
  const canCreate = hasPermission(userProfile, 'expenses.create');

  const loadExpenses = async () => {
    if (!canView) return;
    try {
      setLoading(true);
      const list = await getExpenses(currentBranchId);
      setExpenses(list);
    } catch (e) {
      console.error('Error fetching expenses:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadExpenses();
  }, [currentBranchId, canView]);

  const handleSaveExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim() || amount <= 0) {
      setMessage({ type: 'error', text: 'Description and a valid amount are required.' });
      return;
    }

    try {
      const bName =
        branchId === 'all'
          ? 'Shared Business'
          : branches.find((b) => b.id === branchId)?.name || 'Branch';

      await saveExpense({
        branchId,
        branchName: bName,
        description: description.trim(),
        category,
        amount,
        date,
        notes: notes.trim() || '',
        createdBy: userProfile?.id || 'staff',
        createdByName: userProfile?.displayName || 'Staff',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      setMessage({ type: 'success', text: 'Expense logged successfully!' });
      setShowModal(false);
      setDescription('');
      setAmount(0);
      setNotes('');
      await loadExpenses();
    } catch (err: unknown) {
      console.error('Failed to save expense:', err);
      const errText = err instanceof Error ? err.message : 'Failed to record expense.';
      setMessage({ type: 'error', text: errText });
    }
  };

  const totalExpenseSum = expenses.reduce((s, e) => s + e.amount, 0);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Banner */}
      <div className="bg-white rounded-2xl p-6 border border-[#EADBD6] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-[#70445B] flex items-center gap-2">
            <ReceiptIndianRupee className="w-5 h-5 text-[#D98591]" />
            Operating & Branch Expenses
          </h2>
          <p className="text-xs text-[#79696D] mt-0.5">
            Log procurement, packaging, utility bills, maintenance, and facility overheads
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="bg-[#FFF9F0] px-4 py-2 rounded-xl border border-[#EADBD6] text-xs">
            <span className="text-[#79696D]">Total Logged:</span>{' '}
            <strong className="text-sm font-bold text-[#70445B]">₹{totalExpenseSum.toFixed(2)}</strong>
          </div>
          {canCreate && (
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-[#70445B] hover:bg-[#D98591] text-white text-xs font-bold rounded-xl shadow-xs transition"
            >
              <Plus className="w-4 h-4" />
              Log Expense
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

      {/* Expenses Table */}
      <div className="bg-white rounded-2xl border border-[#EADBD6] shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#FFF9F0] border-b border-[#EADBD6] text-[#70445B] font-bold">
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Description</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Branch Scope</th>
                <th className="py-3 px-4">Recorded By</th>
                <th className="py-3 px-4 text-right">Amount (₹)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EADBD6]/60">
              {expenses.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-[#79696D]">
                    No expenses recorded.
                  </td>
                </tr>
              ) : (
                expenses.map((exp) => (
                  <tr key={exp.id} className="hover:bg-[#FFFCF8] transition">
                    <td className="py-3 px-4 text-[#79696D]">{exp.date}</td>
                    <td className="py-3 px-4 font-bold text-[#493A3E]">
                      {exp.description}
                      {exp.notes && (
                        <div className="text-[10px] text-[#79696D] font-normal">{exp.notes}</div>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#F8E7E5] text-[#70445B]">
                        {exp.category}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-medium text-[#493A3E]">{exp.branchName}</td>
                    <td className="py-3 px-4 text-[#79696D]">{exp.createdByName}</td>
                    <td className="py-3 px-4 text-right font-extrabold text-sm text-[#70445B]">
                      ₹{exp.amount.toFixed(2)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Log Expense Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-[#EADBD6] max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-[#EADBD6] pb-3">
              <h3 className="font-bold text-lg text-[#70445B]">Record New Expense</h3>
              <button onClick={() => setShowModal(false)} className="text-neutral-400 font-bold">
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveExpense} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-[#493A3E] block mb-1">Expense Description:</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Milk & Rabri replenishment batch"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#EADBD6] bg-[#FFFCF8]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-[#493A3E] block mb-1">Category:</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#EADBD6] bg-[#FFFCF8]"
                  >
                    <option value="Ingredients">Ingredients & Dairy</option>
                    <option value="Packaging">Packaging & Cups</option>
                    <option value="Rent">Shop Rent</option>
                    <option value="Electricity">Electricity & Chillers</option>
                    <option value="Equipment">Equipment & Repairs</option>
                    <option value="Maintenance">Maintenance</option>
                    <option value="Other">Other Operating Cost</option>
                  </select>
                </div>
                <div>
                  <label className="font-bold text-[#493A3E] block mb-1">Amount (₹):</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={amount || ''}
                    onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 rounded-xl border border-[#EADBD6] bg-[#FFFCF8] font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-[#493A3E] block mb-1">Branch Scope:</label>
                  <select
                    value={branchId}
                    onChange={(e) => setBranchId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#EADBD6] bg-[#FFFCF8]"
                  >
                    <option value="all">🌐 Shared Business Cost</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        📍 {b.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="font-bold text-[#493A3E] block mb-1">Date:</label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#EADBD6] bg-[#FFFCF8]"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-[#493A3E] block mb-1">Notes / Vendor Invoice (Optional):</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Paid to Royal Dairy Supply via UPI"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#EADBD6] bg-[#FFFCF8]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#EADBD6]">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl border border-[#EADBD6] font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#70445B] hover:bg-[#D98591] text-white font-bold"
                >
                  Save Expense
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
