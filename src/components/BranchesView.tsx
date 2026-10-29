import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Branch } from '../types';
import { saveBranch } from '../services/dbService';
import { hasPermission } from '../services/permissionService';
import { Building2, Plus, Edit, Phone, MapPin, CheckCircle, AlertCircle } from 'lucide-react';

export const BranchesView: React.FC = () => {
  const { userProfile, branches, reloadBranches } = useAuth();

  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [isNew, setIsNew] = useState<boolean>(false);
  const [formData, setFormData] = useState<{
    name: string;
    code: string;
    address: string;
    phone: string;
    status: 'active' | 'inactive';
    taxRate: number;
    timezone: string;
  }>({
    name: '',
    code: '',
    address: '',
    phone: '',
    status: 'active',
    taxRate: 5,
    timezone: 'Asia/Kolkata',
  });
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const isSuperAdmin = userProfile?.role === 'super_admin';
  const canManage = isSuperAdmin || hasPermission(userProfile, 'branches.manage');

  const handleOpenAdd = () => {
    setIsNew(true);
    setFormData({
      name: '',
      code: `FP-${Math.floor(100 + Math.random() * 900)}`,
      address: '',
      phone: '',
      status: 'active',
      taxRate: 0,
      timezone: 'Asia/Kolkata',
    });
    setEditingBranch({} as Branch);
  };

  const handleOpenEdit = (b: Branch) => {
    setIsNew(false);
    setEditingBranch(b);
    setFormData({
      name: b.name,
      code: b.code,
      address: b.address,
      phone: b.phone,
      status: b.status,
      taxRate: b.taxRate !== undefined ? Number(b.taxRate) : 0,
      timezone: b.timezone || 'Asia/Kolkata',
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.code.trim()) {
      setMessage({ type: 'error', text: 'Branch Name and Code are required.' });
      return;
    }

    try {
      await saveBranch({
        id: isNew ? undefined : editingBranch?.id,
        name: formData.name.trim(),
        code: formData.code.trim().toUpperCase(),
        address: formData.address.trim(),
        phone: formData.phone.trim(),
        status: formData.status,
        taxRate: formData.taxRate,
        timezone: formData.timezone,
        createdAt: isNew ? new Date().toISOString() : editingBranch?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      setMessage({
        type: 'success',
        text: isNew ? 'Branch created successfully!' : 'Branch details updated!',
      });
      setEditingBranch(null);
      await reloadBranches();
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to save branch. Permission denied.' });
    }
  };

  const handleSetAllTaxZero = async () => {
    if (!confirm('Are you sure you want to remove GST (set tax rate to 0%) across all branches?')) return;
    try {
      for (const b of branches) {
        await saveBranch({
          ...b,
          taxRate: 0,
        });
      }
      setMessage({ type: 'success', text: 'All branches have been updated to 0% GST (No Tax)!' });
      await reloadBranches();
    } catch (e) {
      setMessage({ type: 'error', text: 'Failed to update branch tax rates.' });
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Banner */}
      <div className="bg-white rounded-2xl p-6 border border-[#EADBD6] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-[#70445B] flex items-center gap-2">
            <Building2 className="w-5 h-5 text-[#D98591]" />
            Dessert Shop Branches
          </h2>
          <p className="text-xs text-[#79696D] mt-0.5">
            Configure physical shop outlets, GST/tax rates, and location details
          </p>
        </div>

        {canManage && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleSetAllTaxZero}
              className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold rounded-xl transition"
            >
              Set All to 0% GST (Remove Tax)
            </button>
            <button
              onClick={handleOpenAdd}
              className="flex items-center gap-2 px-4 py-2 bg-[#70445B] hover:bg-[#D98591] text-white text-xs font-bold rounded-xl shadow-xs transition"
            >
              <Plus className="w-4 h-4" />
              Add New Branch
            </button>
          </div>
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

      {/* Branches Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {branches.map((b) => (
          <div
            key={b.id}
            className="bg-white rounded-2xl p-5 border border-[#EADBD6] shadow-xs hover:border-[#D98591] transition flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-xs font-bold text-[#D98591] px-2 py-0.5 rounded-md bg-[#F8E7E5]">
                  {b.code}
                </span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                    b.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-neutral-100 text-neutral-600'
                  }`}
                >
                  {b.status}
                </span>
              </div>

              <h3 className="font-bold text-base text-[#70445B]">{b.name}</h3>

              <div className="space-y-1.5 mt-3 text-xs text-[#79696D]">
                <div className="flex items-start gap-2">
                  <MapPin className="w-3.5 h-3.5 text-[#D98591] shrink-0 mt-0.5" />
                  <span>{b.address || 'Address not configured'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 text-[#D98591] shrink-0" />
                  <span>{b.phone || 'Phone not set'}</span>
                </div>
                <div className="pt-2 flex justify-between font-medium text-[#493A3E]">
                  <span>GST / Tax Rate:</span>
                  <span className={`font-bold ${b.taxRate === 0 ? 'text-emerald-700' : 'text-[#70445B]'}`}>
                    {b.taxRate !== undefined ? Number(b.taxRate) : 0}% {b.taxRate === 0 && '(No Tax)'}
                  </span>
                </div>
              </div>
            </div>

            {canManage && (
              <div className="pt-4 mt-4 border-t border-[#EADBD6]/60 flex justify-end">
                <button
                  onClick={() => handleOpenEdit(b)}
                  className="px-3 py-1.5 rounded-xl border border-[#EADBD6] hover:bg-[#F8E7E5] text-xs font-semibold text-[#70445B] transition flex items-center gap-1.5"
                >
                  <Edit className="w-3.5 h-3.5" />
                  Edit Branch
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Edit / Create Modal */}
      {editingBranch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-[#EADBD6] max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-[#EADBD6] pb-3">
              <h3 className="font-bold text-lg text-[#70445B]">
                {isNew ? 'Create New Branch' : 'Edit Branch Configuration'}
              </h3>
              <button onClick={() => setEditingBranch(null)} className="text-neutral-400 font-bold">
                ✕
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-[#493A3E] block mb-1">Branch Name:</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Phoenix Mall Dessert Bar"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-[#EADBD6] bg-[#FFFCF8]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-[#493A3E] block mb-1">Branch Code:</label>
                  <input
                    type="text"
                    required
                    placeholder="FP-PHX"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-[#EADBD6] bg-[#FFFCF8] font-mono"
                  />
                </div>
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="font-bold text-[#493A3E]">GST/Tax Rate (%):</label>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, taxRate: 0 })}
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          formData.taxRate === 0
                            ? 'bg-emerald-600 text-white'
                            : 'bg-neutral-100 text-[#493A3E] hover:bg-neutral-200'
                        }`}
                      >
                        0% (No Tax)
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, taxRate: 5 })}
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          formData.taxRate === 5
                            ? 'bg-[#70445B] text-white'
                            : 'bg-neutral-100 text-[#493A3E] hover:bg-neutral-200'
                        }`}
                      >
                        5%
                      </button>
                    </div>
                  </div>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    value={formData.taxRate}
                    onChange={(e) =>
                      setFormData({ ...formData, taxRate: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-[#EADBD6] bg-[#FFFCF8]"
                  />
                  <span className="text-[10px] text-[#79696D] mt-0.5 block">
                    Set to 0 to eliminate all GST/taxes on POS billing and receipts.
                  </span>
                </div>
              </div>

              <div>
                <label className="font-bold text-[#493A3E] block mb-1">Address & Location:</label>
                <textarea
                  rows={2}
                  placeholder="Food Court, 3rd Floor, Mall Avenue"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-[#EADBD6] bg-[#FFFCF8]"
                />
              </div>

              <div>
                <label className="font-bold text-[#493A3E] block mb-1">Contact Phone:</label>
                <input
                  type="text"
                  placeholder="+91 98765 43210"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-[#EADBD6] bg-[#FFFCF8]"
                />
              </div>

              <div>
                <label className="font-bold text-[#493A3E] block mb-1">Status:</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                  className="w-full px-3 py-2 rounded-xl border border-[#EADBD6] bg-[#FFFCF8]"
                >
                  <option value="active">Active (Serving Orders)</option>
                  <option value="inactive">Inactive / Closed</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#EADBD6]">
                <button
                  type="button"
                  onClick={() => setEditingBranch(null)}
                  className="px-4 py-2 rounded-xl border border-[#EADBD6] font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#70445B] hover:bg-[#D98591] text-white font-bold"
                >
                  Save Branch
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
