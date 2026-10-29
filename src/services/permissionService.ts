import { PermissionDefinition, UserProfile } from '../types';

export const PERMISSIONS: Record<string, PermissionDefinition> = {
  // Dashboard
  'dashboard.view': {
    id: 'dashboard.view',
    label: 'View Dashboard',
    category: 'Dashboard',
    description: 'Access the operational dashboard',
  },
  'dashboard.view_sales': {
    id: 'dashboard.view_sales',
    label: 'View Sales Dashboard Cards',
    category: 'Dashboard',
    description: 'See live sales metrics and totals on the dashboard',
  },

  // Sales & POS
  'sales.create': {
    id: 'sales.create',
    label: 'Create POS Sales',
    category: 'Sales',
    description: 'Operate checkout counter, add products to cart, and complete transactions',
  },
  'sales.view_branch': {
    id: 'sales.view_branch',
    label: 'View Branch Sales Totals',
    category: 'Sales',
    description: 'View aggregate sales figures for assigned branch',
  },
  'sales.view_all': {
    id: 'sales.view_all',
    label: 'View Combined All-Branch Sales',
    category: 'Sales',
    description: 'View aggregated sales totals across all physical branches',
  },

  // Reports
  'reports.sales.view': {
    id: 'reports.sales.view',
    label: 'View Sales Reports',
    category: 'Reports',
    description: 'Access in-depth historical sales performance and category analysis',
  },
  'reports.profit.view': {
    id: 'reports.profit.view',
    label: 'View Profit & Margins',
    category: 'Reports',
    description: 'Inspect cost of goods, gross margins, and estimated operating profit',
  },
  'reports.expenses.view': {
    id: 'reports.expenses.view',
    label: 'View Expense Reports',
    category: 'Reports',
    description: 'Review operating and ingredient expenditures',
  },
  'reports.export': {
    id: 'reports.export',
    label: 'Export Data (CSV/Excel)',
    category: 'Reports',
    description: 'Download sales, tax, and inventory figures to external files',
  },

  'products.view': {
    id: 'products.view',
    label: 'View Products Catalog',
    category: 'Products',
    description: 'Browse master catalog and recipes',
  },
  'products.view_cost': {
    id: 'products.view_cost',
    label: 'View Product Cost Price',
    category: 'Products',
    description: 'Inspect purchase, recipe, and cost prices of menu items',
  },
  'products.create': {
    id: 'products.create',
    label: 'Create New Products',
    category: 'Products',
    description: 'Add new dessert items, variants, and add-ons',
  },
  'products.edit': {
    id: 'products.edit',
    label: 'Edit Product Details',
    category: 'Products',
    description: 'Modify names, recipes, variants, and descriptions',
  },
  'products.archive': {
    id: 'products.archive',
    label: 'Archive / Deactivate Products',
    category: 'Products',
    description: 'Disable products from the active POS menu',
  },
  'products.change_price': {
    id: 'products.change_price',
    label: 'Change Product Prices',
    category: 'Products',
    description: 'Alter base selling prices or branch price overrides',
  },
  'categories.manage': {
    id: 'categories.manage',
    label: 'Manage Categories',
    category: 'Products',
    description: 'Create and reorder product categories',
  },

  // Inventory & Stock
  'inventory.view': {
    id: 'inventory.view',
    label: 'View Branch Inventory',
    category: 'Inventory',
    description: 'Inspect stock on hand and stock levels at the branch',
  },
  'inventory.adjust': {
    id: 'inventory.adjust',
    label: 'Adjust Stock Quantities',
    category: 'Inventory',
    description: 'Manually record stock adjustments, wastage, or breakage',
  },
  'inventory.receive': {
    id: 'inventory.receive',
    label: 'Receive Inward Shipments',
    category: 'Inventory',
    description: 'Log vendor ingredient deliveries and restock inventory',
  },

  // Stock Transfers
  'transfers.create': {
    id: 'transfers.create',
    label: 'Create Stock Transfer',
    category: 'Transfers',
    description: 'Initiate inter-branch inventory transfer requests',
  },
  'transfers.dispatch': {
    id: 'transfers.dispatch',
    label: 'Dispatch Stock Transfer',
    category: 'Transfers',
    description: 'Approve departure and deduct stock from source branch',
  },
  'transfers.receive': {
    id: 'transfers.receive',
    label: 'Receive Stock Transfer',
    category: 'Transfers',
    description: 'Confirm physical arrival and increment destination stock',
  },
  'transfers.approve': {
    id: 'transfers.approve',
    label: 'Approve / Cancel Transfers',
    category: 'Transfers',
    description: 'Administrative approval or cancellation of branch transfers',
  },

  // Orders & Receipts
  'orders.view': {
    id: 'orders.view',
    label: 'View Orders',
    category: 'Orders',
    description: 'Browse recent operational orders and transaction history',
  },
  'orders.view_branch_history': {
    id: 'orders.view_branch_history',
    label: 'View Full Order History',
    category: 'Orders',
    description: 'Access complete multi-month historical transaction records',
  },

  // Refunds
  'refunds.create': {
    id: 'refunds.create',
    label: 'Initiate Refund Request',
    category: 'Refunds',
    description: 'Create a customer refund request for an existing order',
  },
  'refunds.approve': {
    id: 'refunds.approve',
    label: 'Approve & Execute Refunds',
    category: 'Refunds',
    description: 'Authorize financial reimbursement and reverse transaction',
  },

  // Expenses
  'expenses.view': {
    id: 'expenses.view',
    label: 'View Expenses',
    category: 'Expenses',
    description: 'Inspect logged operational expenses',
  },
  'expenses.create': {
    id: 'expenses.create',
    label: 'Record New Expense',
    category: 'Expenses',
    description: 'Log branch and operating costs',
  },
  'expenses.edit': {
    id: 'expenses.edit',
    label: 'Edit / Delete Expenses',
    category: 'Expenses',
    description: 'Modify or remove recorded expense items',
  },

  // Branch Management
  'branches.view': {
    id: 'branches.view',
    label: 'View Branches',
    category: 'Branches',
    description: 'Browse list of branch locations',
  },
  'branches.manage': {
    id: 'branches.manage',
    label: 'Manage Branches',
    category: 'Branches',
    description: 'Create new branches, configure tax rates, and branch details',
  },

  // Staff Management
  'staff.view': {
    id: 'staff.view',
    label: 'View Staff Accounts',
    category: 'Staff Management',
    description: 'View active employee profiles and rosters',
  },
  'staff.create': {
    id: 'staff.create',
    label: 'Create Staff Accounts',
    category: 'Staff Management',
    description: 'Invite or create new cashier and operational staff',
  },
  'staff.edit': {
    id: 'staff.edit',
    label: 'Edit Staff Accounts',
    category: 'Staff Management',
    description: 'Update employee names, roles, or branch assignments',
  },
  'staff.deactivate': {
    id: 'staff.deactivate',
    label: 'Deactivate / Reactivate Staff',
    category: 'Staff Management',
    description: 'Suspend or restore employee access',
  },
  'staff.assign_branch': {
    id: 'staff.assign_branch',
    label: 'Assign Branch Locations',
    category: 'Staff Management',
    description: 'Modify which physical branches an employee can access',
  },
  'staff.delete': {
    id: 'staff.delete',
    label: 'Delete Staff Accounts',
    category: 'Staff Management',
    description: 'Permanently remove staff user accounts',
  },

  // Settings & Audit
  'settings.view': {
    id: 'settings.view',
    label: 'View System Settings',
    category: 'Settings',
    description: 'Inspect shop configuration and POS preferences',
  },
  'settings.manage': {
    id: 'settings.manage',
    label: 'Modify Settings',
    category: 'Settings',
    description: 'Update business details, receipt footer, and global defaults',
  },
  'audit_logs.view': {
    id: 'audit_logs.view',
    label: 'View Audit Logs',
    category: 'Audit Logs',
    description: 'Review security audit trail and system activity logs',
  },
};

export const ALL_PERMISSION_KEYS = Object.keys(PERMISSIONS);

// Default permissions for newly assigned roles (configurable by Super Admin)
export const DEFAULT_ROLE_PERMISSIONS: Record<string, string[]> = {
  super_admin: ALL_PERMISSION_KEYS,
  admin: [
    'dashboard.view',
    'sales.create',
    'products.view',
    'products.view_cost',
    'products.create',
    'products.edit',
    'categories.manage',
    'inventory.view',
    'inventory.adjust',
    'inventory.receive',
    'transfers.create',
    'transfers.dispatch',
    'transfers.receive',
    'orders.view',
    'staff.view',
    'staff.create',
    'staff.edit',
    'staff.delete',
    'branches.view',
    // NOTE: Explicitly NO 'reports.sales.view', 'reports.profit.view', 'dashboard.view_sales', or 'sales.view_all' by default!
  ],
  staff: [
    'sales.create',
    'orders.view',
    // Cashiers only get POS checkout by default. No products catalog or cost prices!
  ],
};

/**
 * Check if a user has a specific permission.
 * Super Admin has all permissions unless deactivated.
 * Admin and Staff must have the explicit permission granted.
 */
export function hasPermission(
  user: UserProfile | null | undefined,
  permissionKey: string,
  targetBranchId?: string
): boolean {
  if (!user || !user.active) return false;

  // Super Admin has full application authority
  if (user.role === 'super_admin') {
    return true;
  }

  // Branch check if branch is specified
  if (targetBranchId && targetBranchId !== 'all') {
    if (!user.assignedBranchIds || !user.assignedBranchIds.includes(targetBranchId)) {
      return false;
    }
  }

  // Check explicit permissions
  return Array.isArray(user.permissions) && user.permissions.includes(permissionKey);
}

/**
 * Check if user is allowed to view product cost prices.
 * Staff role is strictly barred from seeing cost prices under all circumstances.
 */
export function canViewCostPrice(user: UserProfile | null | undefined): boolean {
  if (!user || !user.active) return false;
  // Staff users must NEVER see cost price
  if (user.role === 'staff') return false;
  if (user.role === 'super_admin') return true;
  return hasPermission(user, 'products.view_cost') || hasPermission(user, 'reports.profit.view');
}

/**
 * Check if user is allowed to view sales dashboards and sales figures
 */
export function canViewSales(user: UserProfile | null | undefined, targetBranchId?: string): boolean {
  if (!user || !user.active) return false;
  if (user.role === 'super_admin') return true;

  if (targetBranchId === 'all') {
    return hasPermission(user, 'sales.view_all');
  }

  return (
    hasPermission(user, 'dashboard.view_sales', targetBranchId) ||
    hasPermission(user, 'sales.view_branch', targetBranchId) ||
    hasPermission(user, 'reports.sales.view', targetBranchId)
  );
}

/**
 * Group permissions by their category for the permission management UI
 */
export function getPermissionsByCategory(): Record<string, PermissionDefinition[]> {
  const grouped: Record<string, PermissionDefinition[]> = {};
  for (const perm of Object.values(PERMISSIONS)) {
    if (!grouped[perm.category]) {
      grouped[perm.category] = [];
    }
    grouped[perm.category].push(perm);
  }
  return grouped;
}
