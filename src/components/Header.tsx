import React from 'react';
import { useAuth } from '../context/AuthContext';
import { canViewSales, hasPermission } from '../services/permissionService';
import {
  CupSoda,
  Store,
  ShoppingCart,
  Receipt,
  LayoutDashboard,
  BarChart3,
  Package,
  Layers,
  ArrowLeftRight,
  ReceiptIndianRupee,
  ShieldCheck,
  History,
  LogOut,
  Building2,
  ChevronDown,
  User,
} from 'lucide-react';

interface HeaderProps {
  currentView: string;
  onSelectView: (view: string) => void;
}

export const Header: React.FC<HeaderProps> = ({ currentView, onSelectView }) => {
  const { userProfile, branches, currentBranchId, setCurrentBranchId, logout } = useAuth();

  const isSuperAdmin = userProfile?.role === 'super_admin';
  const isAdmin = userProfile?.role === 'admin';

  // Available branches according to role & assignments
  const selectableBranches = isSuperAdmin
    ? branches
    : branches.filter((b) => userProfile?.assignedBranchIds?.includes(b.id));

  const roleLabel =
    userProfile?.role === 'super_admin'
      ? 'Super Admin'
      : userProfile?.role === 'admin'
      ? 'Branch Admin'
      : 'Cashier / Staff';

  const roleBadgeStyle =
    userProfile?.role === 'super_admin'
      ? 'bg-[#70445B] text-white ring-1 ring-[#D98591]'
      : userProfile?.role === 'admin'
      ? 'bg-[#D98591] text-white'
      : 'bg-[#F8E7E5] text-[#70445B] border border-[#EADBD6]';

  // Navigation Items with RBAC visibility rules
  const navItems = [
    {
      id: 'pos',
      label: 'POS Billing',
      icon: ShoppingCart,
      visible: hasPermission(userProfile, 'sales.create'),
    },
    {
      id: 'orders',
      label: 'Orders',
      icon: Receipt,
      visible: hasPermission(userProfile, 'orders.view'),
    },
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
      visible: canViewSales(userProfile, currentBranchId),
    },
    {
      id: 'reports',
      label: 'Sales Reports',
      icon: BarChart3,
      visible: hasPermission(userProfile, 'reports.sales.view'),
    },
    {
      id: 'catalog',
      label: 'Products & Pricing',
      icon: Package,
      visible: userProfile?.role !== 'staff' && hasPermission(userProfile, 'products.view'),
    },
    {
      id: 'inventory',
      label: 'Inventory',
      icon: Layers,
      visible: hasPermission(userProfile, 'inventory.view'),
    },
    {
      id: 'transfers',
      label: 'Stock Transfers',
      icon: ArrowLeftRight,
      visible: hasPermission(userProfile, 'transfers.create') || hasPermission(userProfile, 'transfers.dispatch'),
    },
    {
      id: 'expenses',
      label: 'Expenses',
      icon: ReceiptIndianRupee,
      visible: hasPermission(userProfile, 'expenses.view'),
    },
    {
      id: 'branches',
      label: 'Branches',
      icon: Building2,
      visible: isSuperAdmin || hasPermission(userProfile, 'branches.manage'),
    },
    {
      id: 'permissions',
      label: 'Staff & Roles',
      icon: ShieldCheck,
      visible: isSuperAdmin || hasPermission(userProfile, 'staff.view'),
    },
    {
      id: 'audit',
      label: 'Audit Trail',
      icon: History,
      visible: isSuperAdmin || hasPermission(userProfile, 'audit_logs.view'),
    },
  ];

  return (
    <header className="sticky top-0 z-40 bg-[#FFF9F0]/95 backdrop-blur-md border-b border-[#EADBD6] shadow-xs no-print">
      {/* Top Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo & Name */}
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => onSelectView('pos')}>
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#D98591] to-[#70445B] flex items-center justify-center text-white shadow-md shadow-[#D98591]/20">
              <CupSoda className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-xl tracking-tight text-[#70445B]">Falooda Point</span>
                <span className="text-xs uppercase font-extrabold px-1.5 py-0.5 rounded-md bg-[#F8E7E5] text-[#70445B] tracking-wide border border-[#EADBD6]">
                  POS
                </span>
              </div>
              <p className="text-[11px] text-[#79696D] hidden sm:block">Multi-Branch Dessert Management</p>
            </div>
          </div>

          {/* Right Section: Branch Switcher & User Profile */}
          <div className="flex items-center gap-3">
            {/* Branch Selector */}
            <div className="relative flex items-center">
              <Store className="w-4 h-4 text-[#70445B] absolute left-3 pointer-events-none" />
              <select
                value={currentBranchId}
                onChange={(e) => setCurrentBranchId(e.target.value)}
                className="pl-9 pr-8 py-1.5 text-xs font-semibold rounded-xl border border-[#EADBD6] bg-[#FFFCF8] text-[#493A3E] focus:outline-none focus:ring-2 focus:ring-[#D98591] cursor-pointer appearance-none shadow-xs"
              >
                {isSuperAdmin && <option value="all">🌐 All Branches (Consolidated)</option>}
                {selectableBranches.map((b) => (
                  <option key={b.id} value={b.id}>
                    📍 {b.name} ({b.code})
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-[#79696D] absolute right-2.5 pointer-events-none" />
            </div>

            {/* User Badge */}
            <div className="flex items-center gap-2 pl-2 border-l border-[#EADBD6]">
              <div className="text-right hidden md:block">
                <div className="text-xs font-bold text-[#493A3E] leading-tight flex items-center justify-end gap-1.5">
                  <span>{userProfile?.displayName || 'User'}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${roleBadgeStyle}`}>
                    {roleLabel}
                  </span>
                </div>
                <div className="text-[10px] text-[#79696D] truncate max-w-[160px]">{userProfile?.email}</div>
              </div>

              {/* Logout Button */}
              <button
                onClick={logout}
                title="Sign out"
                className="p-2 rounded-xl text-[#79696D] hover:text-[#70445B] hover:bg-[#F8E7E5] transition"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Navigation Tabs Bar */}
        <nav className="flex space-x-1 overflow-x-auto pb-2 scrollbar-none">
          {navItems
            .filter((item) => item.visible)
            .map((item) => {
              const Icon = item.icon;
              const isActive = currentView === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onSelectView(item.id)}
                  className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-xl whitespace-nowrap transition-all duration-150 ${
                    isActive
                      ? 'bg-[#70445B] text-white shadow-sm'
                      : 'text-[#493A3E] hover:text-[#70445B] hover:bg-[#F8E7E5]'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-[#D98591]' : 'text-[#79696D]'}`} />
                  {item.label}
                </button>
              );
            })}
        </nav>
      </div>
    </header>
  );
};
