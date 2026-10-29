import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { UserProfile, UserRole, PermissionAuditLog } from '../types';
import {
  getAllUsers,
  saveUserProfile,
  updateUserPermissions,
  updateUserRoleAndBranches,
  deleteUserProfile,
  getPermissionAuditLogs,
} from '../services/dbService';
import {
  PERMISSIONS,
  ALL_PERMISSION_KEYS,
  DEFAULT_ROLE_PERMISSIONS,
  getPermissionsByCategory,
  hasPermission,
} from '../services/permissionService';
import {
  ShieldCheck,
  UserPlus,
  Lock,
  Unlock,
  Key,
  CheckCircle,
  AlertCircle,
  User,
  Building2,
  History,
  Save,
  RotateCcw,
  Trash2,
} from 'lucide-react';

export const PermissionsView: React.FC = () => {
  const { userProfile, branches } = useAuth();

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [assignedBranches, setAssignedBranches] = useState<string[]>([]);
  const [selectedRole, setSelectedRole] = useState<UserRole>('staff');
  const [isActive, setIsActive] = useState<boolean>(true);

  // Invite / Create User Modal
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [newEmail, setNewEmail] = useState<string>('');
  const [newName, setNewName] = useState<string>('');
  const [newRole, setNewRole] = useState<UserRole>('staff');
  const [newBranchIds, setNewBranchIds] = useState<string[]>([]);

  // Permission history modal
  const [showHistoryModal, setShowHistoryModal] = useState<boolean>(false);
  const [auditLogs, setAuditLogs] = useState<PermissionAuditLog[]>([]);

  // Delete user modal state
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
  const [userToDelete, setUserToDelete] = useState<UserProfile | null>(null);
  const [deleteReason, setDeleteReason] = useState<string>('');
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [savingPermissions, setSavingPermissions] = useState<boolean>(false);

  const isSuperAdmin = userProfile?.role === 'super_admin';
  const isAdmin = userProfile?.role === 'admin';
  const canDelete = isSuperAdmin || hasPermission(userProfile, 'staff.delete');
  const isPrimaryOwner = (u: UserProfile | null | undefined) =>
    u?.email?.toLowerCase().trim() === 'aicreation.np@gmail.com';

  const groupedPermissions = useMemo(() => getPermissionsByCategory(), []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const list = await getAllUsers();
      setUsers(list);

      // Select first user if none selected
      if (!selectedUser && list.length > 0) {
        handleSelectUser(list[0]);
      } else if (selectedUser) {
        const fresh = list.find((u) => u.id === selectedUser.id);
        if (fresh) handleSelectUser(fresh);
      }
    } catch (e) {
      console.error('Failed to load users:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleSelectUser = (u: UserProfile) => {
    setSelectedUser(u);
    setSelectedPermissions(u.permissions || []);
    setAssignedBranches(u.assignedBranchIds || []);
    setSelectedRole(u.role);
    setIsActive(u.active);
    setMessage(null);
  };

  // Toggle single permission checkbox
  const handleTogglePermission = (permKey: string) => {
    if (!isSuperAdmin) return;
    if (selectedRole === 'staff' && (permKey.startsWith('products.') || permKey.startsWith('categories.'))) {
      setMessage({
        type: 'error',
        text: 'Products & Pricing and Cost Price permissions are barred for Staff accounts. Staff operate POS counters only.',
      });
      return;
    }
    if (selectedPermissions.includes(permKey)) {
      setSelectedPermissions(selectedPermissions.filter((p) => p !== permKey));
    } else {
      setSelectedPermissions([...selectedPermissions, permKey]);
    }
  };

  // Select all or clear category
  const handleToggleCategory = (catPermissions: string[]) => {
    if (!isSuperAdmin) return;
    const allowedCatPerms =
      selectedRole === 'staff'
        ? catPermissions.filter((p) => !p.startsWith('products.') && !p.startsWith('categories.'))
        : catPermissions;

    if (selectedRole === 'staff' && catPermissions.some((p) => p.startsWith('products.') || p.startsWith('categories.'))) {
      setMessage({
        type: 'error',
        text: 'Products & Pricing catalog permissions are barred from Staff accounts.',
      });
    }

    const allSelected = allowedCatPerms.length > 0 && allowedCatPerms.every((p) => selectedPermissions.includes(p));
    if (allSelected) {
      setSelectedPermissions(selectedPermissions.filter((p) => !allowedCatPerms.includes(p)));
    } else {
      const merged = Array.from(new Set([...selectedPermissions, ...allowedCatPerms]));
      setSelectedPermissions(merged);
    }
  };

  const handleRoleChange = (newRole: UserRole) => {
    setSelectedRole(newRole);
    if (newRole === 'staff') {
      setSelectedPermissions((prev) =>
        prev.filter((p) => !p.startsWith('products.') && !p.startsWith('categories.'))
      );
    }
  };

  // Reset to default role template
  const handleResetToRoleDefault = () => {
    if (!isSuperAdmin || !selectedUser) return;
    const defaults = DEFAULT_ROLE_PERMISSIONS[selectedRole] || [];
    setSelectedPermissions(defaults);
    setMessage({
      type: 'success',
      text: `Reset permissions to default ${selectedRole} template (Remember to Save Changes).`,
    });
  };

  // Save permission changes
  const handleSavePermissions = async () => {
    if (!selectedUser || !isSuperAdmin) return;

    // Last Super Admin deactivation guard
    if (selectedUser.role === 'super_admin' && !isActive) {
      const superAdminCount = users.filter((u) => u.role === 'super_admin' && u.active).length;
      if (superAdminCount <= 1) {
        setMessage({
          type: 'error',
          text: 'Security Rule Violation: Cannot deactivate the last active Super Admin account.',
        });
        return;
      }
    }

    try {
      setSavingPermissions(true);
      setMessage(null);

      // Save permissions
      await updateUserPermissions(
        selectedUser.id,
        selectedPermissions,
        {
          id: userProfile?.id || 'super_admin',
          name: userProfile?.displayName || 'Super Admin',
        },
        {
          name: selectedUser.displayName,
          email: selectedUser.email,
          role: selectedRole,
        },
        'Permissions modified in Super Admin Panel'
      );

      // If role or branches or active status changed
      if (
        selectedRole !== selectedUser.role ||
        isActive !== selectedUser.active ||
        JSON.stringify(assignedBranches.sort()) !== JSON.stringify((selectedUser.assignedBranchIds || []).sort())
      ) {
        await updateUserRoleAndBranches(
          selectedUser.id,
          selectedRole,
          assignedBranches,
          isActive,
          {
            id: userProfile?.id || 'super_admin',
            name: userProfile?.displayName || 'Super Admin',
          },
          {
            name: selectedUser.displayName,
            email: selectedUser.email,
          },
          `Updated role to ${selectedRole}`
        );
      }

      setMessage({ type: 'success', text: 'Permissions and account settings saved successfully!' });
      await loadUsers();
    } catch (err) {
      console.error('Failed to update permissions:', err);
      setMessage({ type: 'error', text: 'Failed to update permissions. Permission denied.' });
    } finally {
      setSavingPermissions(false);
    }
  };

  // Create new account
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim() || !newName.trim()) {
      setMessage({ type: 'error', text: 'Email and Name are required.' });
      return;
    }

    // Role creation rules: Admin cannot create Admin or Super Admin
    if (!isSuperAdmin && (newRole === 'admin' || newRole === 'super_admin')) {
      setMessage({ type: 'error', text: 'Admins can only create Staff accounts.' });
      return;
    }

    try {
      const tempId = `usr_${Date.now()}`;
      const initialPerms =
        newRole === 'super_admin' ? ALL_PERMISSION_KEYS : DEFAULT_ROLE_PERMISSIONS[newRole];

      const newAccount: UserProfile = {
        id: tempId,
        email: newEmail.trim().toLowerCase(),
        displayName: newName.trim(),
        role: newRole,
        active: true,
        assignedBranchIds: newBranchIds,
        permissions: initialPerms,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await saveUserProfile(newAccount);
      setMessage({ type: 'success', text: `Account for ${newName} created successfully!` });
      setShowCreateModal(false);
      setNewEmail('');
      setNewName('');
      setNewBranchIds([]);
      await loadUsers();
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to create user account.' });
    }
  };

  // Open history modal
  const handleOpenHistory = async () => {
    setShowHistoryModal(true);
    try {
      const logs = await getPermissionAuditLogs(50);
      setAuditLogs(logs);
    } catch (e) {
      console.error('Error fetching audit logs:', e);
    }
  };

  // Initiate user deletion
  const handleInitiateDelete = (u: UserProfile) => {
    if (!canDelete) {
      setMessage({ type: 'error', text: 'You do not have permission to delete accounts.' });
      return;
    }
    if (isPrimaryOwner(u)) {
      setMessage({
        type: 'error',
        text: 'Security Rule Violation: The root Super Admin account (aicreation.np@gmail.com) cannot be deleted.',
      });
      return;
    }
    if (u.id === userProfile?.id) {
      setMessage({ type: 'error', text: 'You cannot delete your own logged-in account.' });
      return;
    }
    if (u.role === 'super_admin') {
      const activeSuperAdmins = users.filter((x) => x.role === 'super_admin' && x.active).length;
      if (activeSuperAdmins <= 1) {
        setMessage({
          type: 'error',
          text: 'Security Rule Violation: Cannot delete the last active Super Admin account.',
        });
        return;
      }
    }

    setUserToDelete(u);
    setDeleteReason('');
    setShowDeleteModal(true);
  };

  // Confirm user deletion
  const handleConfirmDelete = async () => {
    if (!userToDelete || !canDelete) return;

    try {
      setIsDeleting(true);
      await deleteUserProfile(
        userToDelete.id,
        {
          id: userProfile?.id || 'admin',
          name: userProfile?.displayName || 'Admin',
          role: userProfile?.role || 'admin',
        },
        {
          name: userToDelete.displayName,
          email: userToDelete.email,
          role: userToDelete.role,
        },
        deleteReason.trim() || 'Account permanently deleted from system'
      );

      const remainingUsers = users.filter((u) => u.id !== userToDelete.id);
      setUsers(remainingUsers);
      if (selectedUser?.id === userToDelete.id) {
        const nextUser = remainingUsers[0] || null;
        setSelectedUser(nextUser);
        if (nextUser) {
          handleSelectUser(nextUser);
        }
      }

      setMessage({
        type: 'success',
        text: `Account for "${userToDelete.displayName}" (${userToDelete.email}) was permanently deleted.`,
      });
      setShowDeleteModal(false);
      setUserToDelete(null);
      setDeleteReason('');
    } catch (err: unknown) {
      console.error('Error deleting user profile:', err);
      const errText = err instanceof Error ? err.message : 'Failed to delete user account.';
      setMessage({ type: 'error', text: errText });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Top Banner */}
      <div className="bg-white rounded-2xl p-6 border border-[#EADBD6] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-[#70445B] flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-[#D98591]" />
            Role & Permission Management Panel
          </h2>
          <p className="text-xs text-[#79696D] mt-0.5">
            Configure individual permissions, branch assignments, and role boundaries for Admins & Cashiers
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isSuperAdmin && (
            <button
              onClick={handleOpenHistory}
              className="px-3.5 py-2 text-xs font-semibold rounded-xl border border-[#EADBD6] hover:bg-[#F8E7E5] text-[#493A3E] transition flex items-center gap-1.5"
            >
              <History className="w-4 h-4 text-[#D98591]" />
              Permission History
            </button>
          )}

          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[#70445B] hover:bg-[#D98591] text-white text-xs font-bold rounded-xl shadow-xs transition"
          >
            <UserPlus className="w-4 h-4" />
            Create Account
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

      {/* Main Grid: User List on Left (4 cols), Permission Editor on Right (8 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Accounts Roster */}
        <div className="lg:col-span-4 bg-white rounded-2xl border border-[#EADBD6] shadow-xs overflow-hidden">
          <div className="p-4 bg-[#FFF9F0] border-b border-[#EADBD6] font-bold text-xs text-[#70445B] flex justify-between items-center">
            <span>Staff & Admin Accounts ({users.length})</span>
            <span className="text-[10px] text-[#79696D]">Select to configure</span>
          </div>

          <div className="divide-y divide-[#EADBD6]/60 max-h-[600px] overflow-y-auto">
            {users.map((u) => {
              const isSelected = selectedUser?.id === u.id;
              const roleTag =
                u.role === 'super_admin' ? 'Super Admin' : u.role === 'admin' ? 'Admin' : 'Staff';
              const roleColor =
                u.role === 'super_admin'
                  ? 'bg-[#70445B] text-white'
                  : u.role === 'admin'
                  ? 'bg-[#D98591] text-white'
                  : 'bg-[#F8E7E5] text-[#70445B]';

              return (
                <div
                  key={u.id}
                  onClick={() => handleSelectUser(u)}
                  className={`p-3.5 cursor-pointer transition ${
                    isSelected ? 'bg-[#F8E7E5]/70 border-l-4 border-l-[#70445B]' : 'hover:bg-[#FFFCF8]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-[#493A3E]">{u.displayName}</span>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${roleColor}`}>
                      {roleTag}
                    </span>
                  </div>
                  <div className="text-[11px] text-[#79696D] truncate mt-0.5">{u.email}</div>
                  <div className="flex items-center justify-between mt-2 text-[10px]">
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-block w-1.5 h-1.5 rounded-full ${
                          u.active ? 'bg-emerald-500' : 'bg-rose-500'
                        }`}
                      />
                      <span className="text-[#79696D]">{u.active ? 'Active' : 'Suspended'}</span>
                      <span className="text-[#79696D]">•</span>
                      <span className="text-[#79696D]">
                        {u.role === 'super_admin'
                          ? 'All Branches'
                          : `${u.assignedBranchIds?.length || 0} branches`}
                      </span>
                    </div>

                    {canDelete && !isPrimaryOwner(u) && u.id !== userProfile?.id && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleInitiateDelete(u);
                        }}
                        className="p-1 rounded-md text-[#79696D] hover:text-rose-600 hover:bg-rose-50 transition"
                        title="Delete User Account"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Detailed Permission Matrix & Configuration */}
        {selectedUser ? (
          <div className="lg:col-span-8 bg-white rounded-2xl border border-[#EADBD6] shadow-xs p-6 space-y-6">
            {/* User Meta Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#EADBD6]">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-lg text-[#70445B]">{selectedUser.displayName}</h3>
                  <span
                    className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase ${
                      isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    {isActive ? 'Account Active' : 'Account Suspended'}
                  </span>
                </div>
                <p className="text-xs text-[#79696D] mt-0.5">{selectedUser.email}</p>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                {canDelete && !isPrimaryOwner(selectedUser) && selectedUser.id !== userProfile?.id && (
                  <button
                    type="button"
                    onClick={() => handleInitiateDelete(selectedUser)}
                    className="px-3 py-1.5 rounded-xl border border-rose-200 hover:bg-rose-50 text-rose-700 text-xs font-bold transition flex items-center gap-1.5"
                    title="Permanently remove user"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                    Delete User
                  </button>
                )}
                {isSuperAdmin && (
                  <>
                    <button
                      type="button"
                      onClick={handleResetToRoleDefault}
                      className="px-3 py-1.5 rounded-xl border border-[#EADBD6] hover:bg-[#F8E7E5] text-xs font-semibold text-[#493A3E] transition flex items-center gap-1"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-[#D98591]" />
                      Reset to Defaults
                    </button>
                    <button
                      type="button"
                      disabled={savingPermissions}
                      onClick={handleSavePermissions}
                      className="px-4 py-1.5 rounded-xl bg-[#70445B] hover:bg-[#D98591] text-white text-xs font-bold transition flex items-center gap-1.5 shadow-xs disabled:opacity-50"
                    >
                      <Save className="w-3.5 h-3.5" />
                      {savingPermissions ? 'Saving...' : 'Save Changes'}
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Role & Branch Configuration */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-[#FFF9F0] rounded-xl border border-[#EADBD6] text-xs">
              {/* Role Switcher */}
              <div>
                <label className="font-bold text-[#493A3E] block mb-1.5">User Primary Role:</label>
                <select
                  disabled={!isSuperAdmin || selectedUser.id === userProfile?.id}
                  value={selectedRole}
                  onChange={(e) => handleRoleChange(e.target.value as UserRole)}
                  className="w-full px-3 py-2 rounded-xl border border-[#EADBD6] bg-white font-semibold text-[#493A3E] disabled:opacity-50"
                >
                  <option value="staff">Staff / Cashier (Counter Sales only by default)</option>
                  <option value="admin">Branch Admin (Manager without sales report access)</option>
                  <option value="super_admin">Super Admin (Full Business Authority)</option>
                </select>
                <span className="text-[10px] text-[#79696D] mt-1 block">
                  Role sets the maximum boundary. Individual permissions below govern feature access.
                </span>
              </div>

              {/* Account Status Toggle */}
              <div>
                <label className="font-bold text-[#493A3E] block mb-1.5">Account Status:</label>
                <div className="flex items-center gap-3 pt-1">
                  <button
                    type="button"
                    disabled={!isSuperAdmin}
                    onClick={() => setIsActive(!isActive)}
                    className={`px-4 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border ${
                      isActive
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                        : 'bg-rose-50 text-rose-800 border-rose-300'
                    }`}
                  >
                    {isActive ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                    {isActive ? 'Active (Permitted to Log In)' : 'Suspended (Access Denied)'}
                  </button>
                </div>
                <span className="text-[10px] text-[#79696D] mt-1 block">
                  Deactivated accounts are denied on the very next operation.
                </span>
              </div>

              {/* Branch Assignment */}
              <div className="sm:col-span-2 pt-2 border-t border-[#EADBD6]/60">
                <label className="font-bold text-[#493A3E] block mb-1.5">
                  Assigned Branch Locations (Branch Scope):
                </label>
                {selectedRole === 'super_admin' ? (
                  <p className="text-xs text-[#70445B] font-semibold italic">
                    Super Admins automatically have unrestricted authority over all branches.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {branches.map((b) => {
                      const isAssigned = assignedBranches.includes(b.id);
                      return (
                        <div
                          key={b.id}
                          onClick={() => {
                            if (!isSuperAdmin) return;
                            if (isAssigned) {
                              setAssignedBranches(assignedBranches.filter((id) => id !== b.id));
                            } else {
                              setAssignedBranches([...assignedBranches, b.id]);
                            }
                          }}
                          className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition ${
                            isAssigned
                              ? 'bg-white border-[#D98591] text-[#70445B] font-semibold'
                              : 'bg-white/60 border-[#EADBD6] text-[#79696D]'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={isAssigned}
                              readOnly
                              className="rounded text-[#D98591] focus:ring-[#D98591]"
                            />
                            <span>{b.name}</span>
                          </div>
                          <span className="font-mono text-[10px] uppercase">{b.code}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Staff role restriction banner */}
            {selectedRole === 'staff' && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs flex items-center gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 text-amber-700" />
                <span>
                  <strong>Staff Security Policy:</strong> Staff accounts are restricted to POS checkout and orders. The Products & Pricing tab and Cost Prices are strictly barred from Staff.
                </span>
              </div>
            )}

            {/* Granular Permissions Registry Matrix */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-bold text-sm text-[#70445B] flex items-center gap-1.5">
                  <Key className="w-4 h-4 text-[#D98591]" />
                  Granular Permission Registry (Explicit ABAC)
                </h4>
                <span className="text-xs text-[#79696D]">
                  {selectedPermissions.length} of {ALL_PERMISSION_KEYS.length} granted
                </span>
              </div>

              {/* Category-by-Category Permission Cards */}
              <div className="space-y-4">
                {Object.entries(groupedPermissions).map(([categoryName, perms]) => {
                  const permKeys = perms.map((p) => p.id);
                  const isAllSelected = permKeys.every((k) => selectedPermissions.includes(k));

                  return (
                    <div
                      key={categoryName}
                      className="border border-[#EADBD6] rounded-xl overflow-hidden bg-white"
                    >
                      {/* Category Header */}
                      <div className="px-4 py-2.5 bg-[#FFF9F0] border-b border-[#EADBD6] flex items-center justify-between">
                        <span className="font-bold text-xs text-[#70445B]">{categoryName}</span>
                        {isSuperAdmin && (
                          <button
                            type="button"
                            onClick={() => handleToggleCategory(permKeys)}
                            className="text-[11px] font-semibold text-[#D98591] hover:underline"
                          >
                            {isAllSelected ? 'Deselect All' : 'Select All'}
                          </button>
                        )}
                      </div>

                      {/* Permissions in Category */}
                      <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        {perms.map((perm) => {
                          const isGranted = selectedPermissions.includes(perm.id);
                          const isStaffRestricted =
                            selectedRole === 'staff' &&
                            (perm.id.startsWith('products.') || perm.id.startsWith('categories.'));
                          const isSalesRelated =
                            perm.id.includes('sales') ||
                            perm.id.includes('profit') ||
                            perm.id.includes('report');

                          return (
                            <div
                              key={perm.id}
                              onClick={() => !isStaffRestricted && handleTogglePermission(perm.id)}
                              className={`p-2.5 rounded-xl border flex items-start gap-2.5 transition ${
                                isStaffRestricted
                                  ? 'opacity-50 cursor-not-allowed bg-neutral-50 border-[#EADBD6]'
                                  : isGranted
                                  ? 'bg-[#F8E7E5]/50 border-[#D98591] cursor-pointer'
                                  : 'bg-[#FFFCF8] border-[#EADBD6] hover:bg-neutral-50 cursor-pointer'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isGranted && !isStaffRestricted}
                                onChange={() => {}}
                                disabled={!isSuperAdmin || isStaffRestricted}
                                className="mt-0.5 rounded text-[#D98591] focus:ring-[#D98591]"
                              />
                              <div className="flex-1">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-bold text-xs text-[#493A3E]">{perm.label}</span>
                                  {isStaffRestricted && (
                                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-rose-100 text-rose-800 font-semibold">
                                      Staff Barred
                                    </span>
                                  )}
                                  {isSalesRelated && (
                                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 font-semibold">
                                      Sales Data
                                    </span>
                                  )}
                                </div>
                                <p className="text-[10px] text-[#79696D] mt-0.5 leading-snug">
                                  {isStaffRestricted
                                    ? 'Products and Cost Pricing access is prohibited for Staff role.'
                                    : perm.description}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <div className="lg:col-span-8 bg-white rounded-2xl border border-[#EADBD6] p-12 text-center text-[#79696D]">
            Select an account on the left to configure permissions.
          </div>
        )}
      </div>

      {/* Create Account Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-[#EADBD6] max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-[#EADBD6] pb-3">
              <h3 className="font-bold text-lg text-[#70445B]">Create New User Account</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-neutral-400 font-bold">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-[#493A3E] block mb-1">Full Name:</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Zoya Khan"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#EADBD6] bg-[#FFFCF8]"
                />
              </div>

              <div>
                <label className="font-bold text-[#493A3E] block mb-1">Google Email Address:</label>
                <input
                  type="email"
                  required
                  placeholder="staff@faloodapoint.com"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#EADBD6] bg-[#FFFCF8]"
                />
                <span className="text-[10px] text-[#79696D] mt-0.5 block">
                  The user can sign in with this Google account to access authorized features.
                </span>
              </div>

              <div>
                <label className="font-bold text-[#493A3E] block mb-1">Role:</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as UserRole)}
                  className="w-full px-3 py-2 rounded-xl border border-[#EADBD6] bg-[#FFFCF8]"
                >
                  <option value="staff">Staff (Cashier / POS checkout)</option>
                  {isSuperAdmin && <option value="admin">Branch Admin</option>}
                  {isSuperAdmin && <option value="super_admin">Super Admin</option>}
                </select>
              </div>

              <div>
                <label className="font-bold text-[#493A3E] block mb-1">Assign Initial Branches:</label>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {branches.map((b) => (
                    <label key={b.id} className="flex items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        checked={newBranchIds.includes(b.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setNewBranchIds([...newBranchIds, b.id]);
                          } else {
                            setNewBranchIds(newBranchIds.filter((id) => id !== b.id));
                          }
                        }}
                        className="rounded text-[#D98591]"
                      />
                      <span>{b.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#EADBD6]">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl border border-[#EADBD6] font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#70445B] hover:bg-[#D98591] text-white font-bold"
                >
                  Create Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete User Confirmation Modal */}
      {showDeleteModal && userToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-rose-200 max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-full bg-rose-100 text-rose-600 shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="font-bold text-base text-[#70445B]">Permanently Delete Account?</h3>
                <p className="text-xs text-[#79696D]">
                  You are about to delete the user profile for{' '}
                  <strong className="text-[#493A3E]">{userToDelete.displayName}</strong> ({userToDelete.email}).
                </p>
              </div>
            </div>

            <div className="p-3 bg-rose-50/70 border border-rose-200 rounded-xl text-[11px] text-rose-800 space-y-1">
              <p className="font-semibold flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                Security Note (Closed Enrollment):
              </p>
              <p>
                Deleting this account will immediately revoke all POS, catalog, and management access. 
                If this user attempts to sign in with Google, they will be blocked with an &quot;Access Denied&quot; screen unless pre-added again.
              </p>
            </div>

            <div className="text-xs">
              <label className="font-bold text-[#493A3E] block mb-1">Reason for deletion (Optional):</label>
              <input
                type="text"
                placeholder="e.g. Employee resigned, redundant test account"
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[#EADBD6] bg-[#FFFCF8]"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-[#EADBD6]">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => {
                  setShowDeleteModal(false);
                  setUserToDelete(null);
                  setDeleteReason('');
                }}
                className="px-4 py-2 rounded-xl border border-[#EADBD6] text-xs font-semibold hover:bg-neutral-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold flex items-center gap-1.5 transition disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {isDeleting ? 'Deleting...' : 'Confirm & Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Permission Change Audit History Modal */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-[#EADBD6] max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-[#EADBD6] pb-3">
              <h3 className="font-bold text-lg text-[#70445B] flex items-center gap-2">
                <History className="w-5 h-5 text-[#D98591]" />
                Permission Modification History (Immutable Audit Log)
              </h3>
              <button onClick={() => setShowHistoryModal(false)} className="text-neutral-400 font-bold">
                ✕
              </button>
            </div>

            <div className="space-y-2 text-xs">
              {auditLogs.length === 0 ? (
                <p className="text-center py-8 text-[#79696D]">No permission changes recorded yet.</p>
              ) : (
                auditLogs.map((log) => (
                  <div
                    key={log.id}
                    className="p-3 rounded-xl border border-[#EADBD6] bg-[#FFF9F0] space-y-1"
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-[#70445B]">
                        {log.actorUserName} modified {log.targetUserName}
                      </span>
                      <span className="text-[10px] text-[#79696D]">
                        {new Date(log.timestamp).toLocaleString()}
                      </span>
                    </div>
                    <div className="text-[11px] text-[#493A3E]">
                      <strong>Action:</strong> <span className="uppercase">{log.action}</span> (Role: {log.role})
                    </div>
                    <div className="text-[11px] text-[#79696D]">
                      <strong>Reason:</strong> {log.reason}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-end pt-3 border-t border-[#EADBD6]">
              <button
                onClick={() => setShowHistoryModal(false)}
                className="px-4 py-2 rounded-xl bg-[#70445B] text-white font-semibold text-xs"
              >
                Close History
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
