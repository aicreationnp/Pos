import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { AuditLog } from '../types';
import { getAuditLogs } from '../services/dbService';
import { hasPermission } from '../services/permissionService';
import { History, Shield, Lock, Search, RefreshCw } from 'lucide-react';

export const AuditLogsView: React.FC = () => {
  const { userProfile } = useAuth();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const canView = userProfile?.role === 'super_admin' || hasPermission(userProfile, 'audit_logs.view');

  const loadLogs = async () => {
    if (!canView) return;
    try {
      setLoading(true);
      const list = await getAuditLogs(150);
      setLogs(list);
    } catch (e) {
      console.error('Error fetching audit logs:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, [canView]);

  if (!canView) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <div className="w-16 h-16 rounded-3xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto mb-4 border border-amber-200">
          <Lock className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-[#70445B]">Audit Log Access Restricted</h2>
        <p className="text-sm text-[#79696D] max-w-md mx-auto mt-2 leading-relaxed">
          Access to system activity logs and security audits requires Super Admin authorization.
        </p>
      </div>
    );
  }

  const filtered = logs.filter(
    (l) =>
      l.actorName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.details.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Banner */}
      <div className="bg-white rounded-2xl p-6 border border-[#EADBD6] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-[#70445B] flex items-center gap-2">
            <Shield className="w-5 h-5 text-[#D98591]" />
            Security & Activity Audit Trail
          </h2>
          <p className="text-xs text-[#79696D] mt-0.5">
            Immutable, append-only chronological record of system events, logins, and pricing changes
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative w-64">
            <Search className="w-4 h-4 text-[#79696D] absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search audit trail..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-[#EADBD6] bg-[#FFFCF8]"
            />
          </div>
          <button
            onClick={loadLogs}
            className="p-2 rounded-xl border border-[#EADBD6] hover:bg-[#F8E7E5] text-[#70445B]"
            title="Refresh logs"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-white rounded-2xl border border-[#EADBD6] shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#FFF9F0] border-b border-[#EADBD6] text-[#70445B] font-bold">
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Actor</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Entity</th>
                <th className="py-3 px-4">Event Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EADBD6]/60">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-[#79696D]">
                    No audit records matching criteria.
                  </td>
                </tr>
              ) : (
                filtered.map((log) => (
                  <tr key={log.id} className="hover:bg-[#FFFCF8] transition">
                    <td className="py-3 px-4 text-[#79696D]">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 font-bold text-[#493A3E]">{log.actorName}</td>
                    <td className="py-3 px-4 capitalize">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#F8E7E5] text-[#70445B]">
                        {log.actorRole.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono font-semibold text-[#70445B]">{log.action}</td>
                    <td className="py-3 px-4 text-[#79696D]">{log.entityType}</td>
                    <td className="py-3 px-4 text-[#493A3E]">{log.details}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
