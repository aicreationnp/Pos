export type UserRole = 'super_admin' | 'admin' | 'staff';

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  active: boolean;
  assignedBranchIds: string[];
  permissions: string[];
  createdAt: string;
  updatedAt: string;
  lastLogin?: string;
}

export interface Branch {
  id: string;
  name: string;
  code: string;
  address: string;
  phone: string;
  managerId?: string;
  managerName?: string;
  status: 'active' | 'inactive';
  timezone: string;
  taxRate: number; // percentage e.g. 5
  openingDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  name: string;
  description: string;
  sortOrder: number;
  active: boolean;
}

export interface ProductVariant {
  id: string;
  name: string; // e.g. "Small", "Regular", "Large"
  priceOffset: number; // e.g. +30
}

export interface ProductAddOn {
  id: string;
  name: string; // e.g. "Extra Scoop Ice Cream", "Roasted Pistachios"
  price: number;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  categoryId: string;
  sku: string;
  globalSellingPrice: number;
  costPrice: number;
  active: boolean;
  imageUrl?: string;
  variants: ProductVariant[];
  addOns: ProductAddOn[];
  createdAt: string;
  updatedAt: string;
}

export interface BranchProduct {
  id: string; // usually `${branchId}_${productId}`
  branchId: string;
  productId: string;
  priceOverride?: number; // optional custom price for this branch
  stockQuantity: number;
  lowStockAlert: number;
  stockTrackingEnabled: boolean;
  active: boolean;
  updatedAt: string;
}

export interface OrderItem {
  productId: string;
  productName: string;
  categoryName?: string;
  variant?: ProductVariant;
  selectedAddOns?: ProductAddOn[];
  unitPrice: number;
  quantity: number;
  itemSubtotal: number;
  itemNotes?: string;
}

export type PaymentMethod = 'cash' | 'card' | 'digital_wallet' | 'other';
export type OrderStatus = 'completed' | 'refunded' | 'partially_refunded' | 'cancelled';

export interface Order {
  id: string;
  receiptNumber: string;
  branchId: string;
  branchName: string;
  cashierId: string;
  cashierName: string;
  status: OrderStatus;
  items: OrderItem[];
  subtotal: number;
  discountAmount: number;
  discountType?: 'flat' | 'percentage';
  discountValue?: number;
  taxAmount: number;
  taxRate: number;
  totalAmount: number;
  paymentMethod: PaymentMethod;
  paymentStatus: 'paid' | 'pending' | 'refunded';
  amountTendered?: number;
  changeDue?: number;
  customerName?: string;
  customerPhone?: string;
  orderNotes?: string;
  createdAt: string;
  updatedAt: string;
}

export type MovementType =
  | 'sale'
  | 'restock'
  | 'adjustment'
  | 'transfer_out'
  | 'transfer_in'
  | 'waste'
  | 'return';

export interface InventoryMovement {
  id: string;
  branchId: string;
  productId: string;
  productName: string;
  quantityChange: number; // can be negative (sale/transfer_out/waste) or positive (restock/transfer_in)
  movementType: MovementType;
  reason: string;
  actorId: string;
  actorName: string;
  relatedOrderId?: string;
  relatedTransferId?: string;
  createdAt: string;
}

export type TransferStatus = 'draft' | 'dispatched' | 'received' | 'cancelled';

export interface TransferItem {
  productId: string;
  productName: string;
  quantity: number;
}

export interface StockTransfer {
  id: string;
  transferNumber: string;
  sourceBranchId: string;
  sourceBranchName: string;
  destinationBranchId: string;
  destinationBranchName: string;
  items: TransferItem[];
  status: TransferStatus;
  createdBy: string;
  createdByName: string;
  dispatchedBy?: string;
  dispatchedByName?: string;
  receivedBy?: string;
  receivedByName?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Expense {
  id: string;
  branchId: string; // or 'all' for shared business expense
  branchName: string;
  description: string;
  category: string; // e.g. "Ingredients", "Packaging", "Rent", "Electricity", "Equipment", "Maintenance", "Other"
  amount: number;
  date: string;
  createdBy: string;
  createdByName: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Refund {
  id: string;
  orderId: string;
  receiptNumber: string;
  branchId: string;
  branchName: string;
  amount: number;
  reason: string;
  refundType: 'full' | 'partial';
  status: 'approved' | 'pending' | 'rejected';
  actorId: string;
  actorName: string;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  actorId: string;
  actorName: string;
  actorRole: string;
  action: string;
  entityType: string;
  entityId: string;
  branchId?: string;
  timestamp: string;
  details: string;
}

export interface PermissionAuditLog {
  id: string;
  targetUserId: string;
  targetUserName: string;
  targetUserEmail: string;
  actorUserId: string;
  actorUserName: string;
  action: 'grant' | 'revoke' | 'role_change' | 'activate' | 'deactivate' | 'delete';
  role: string;
  permissionsChanged: string[];
  timestamp: string;
  reason: string;
}

export interface PermissionDefinition {
  id: string;
  label: string;
  category: string;
  description: string;
}
