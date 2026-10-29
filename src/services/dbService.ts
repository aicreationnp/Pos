import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  writeBatch,
  increment,
  onSnapshot,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase/config';
import {
  UserProfile,
  Branch,
  Category,
  Product,
  BranchProduct,
  Order,
  InventoryMovement,
  StockTransfer,
  Expense,
  Refund,
  AuditLog,
  PermissionAuditLog,
} from '../types';
import { DEFAULT_ROLE_PERMISSIONS } from './permissionService';

// ================= USERS =================
export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  const path = `users/${userId}`;
  try {
    const snap = await getDoc(doc(db, 'users', userId));
    if (!snap.exists()) return null;
    return { id: snap.id, ...(snap.data() as Omit<UserProfile, 'id'>) };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function getAllUsers(): Promise<UserProfile[]> {
  const path = 'users';
  try {
    const snap = await getDocs(collection(db, 'users'));
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<UserProfile, 'id'>) }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function findUserByEmail(email: string): Promise<UserProfile | null> {
  const path = 'users';
  try {
    const q = query(collection(db, 'users'), where('email', '==', email.toLowerCase().trim()));
    const snap = await getDocs(q);
    if (snap.empty) return null;
    const docSnap = snap.docs[0];
    return { id: docSnap.id, ...(docSnap.data() as Omit<UserProfile, 'id'>) };
  } catch (error) {
    console.error('Error finding user by email:', error);
    return null;
  }
}

export async function linkFirebaseUidToProfile(
  tempDocId: string,
  firebaseUid: string,
  profile: UserProfile,
  displayName?: string | null
): Promise<UserProfile> {
  try {
    const batch = writeBatch(db);
    if (tempDocId !== firebaseUid) {
      batch.delete(doc(db, 'users', tempDocId));
    }
    const updatedProfile: UserProfile = {
      ...profile,
      id: firebaseUid,
      displayName: displayName || profile.displayName,
      updatedAt: new Date().toISOString(),
      lastLogin: new Date().toISOString(),
    };
    batch.set(doc(db, 'users', firebaseUid), updatedProfile);
    await batch.commit();
    return updatedProfile;
  } catch (error) {
    console.error('Error linking user profile:', error);
    return profile;
  }
}

export async function saveUserProfile(user: UserProfile): Promise<void> {
  const path = `users/${user.id}`;
  try {
    await setDoc(doc(db, 'users', user.id), {
      displayName: user.displayName,
      email: user.email,
      role: user.role,
      active: user.active,
      assignedBranchIds: user.assignedBranchIds || [],
      permissions: user.permissions || DEFAULT_ROLE_PERMISSIONS[user.role] || [],
      createdAt: user.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...(user.lastLogin ? { lastLogin: user.lastLogin } : {}),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function updateUserPermissions(
  targetUserId: string,
  newPermissions: string[],
  actor: { id: string; name: string },
  targetUser: { name: string; email: string; role: string },
  reason: string
): Promise<void> {
  const userPath = `users/${targetUserId}`;
  try {
    const batch = writeBatch(db);
    batch.update(doc(db, 'users', targetUserId), {
      permissions: newPermissions,
      updatedAt: new Date().toISOString(),
    });

    const auditRef = doc(collection(db, 'permissionAuditLogs'));
    const auditRecord: Omit<PermissionAuditLog, 'id'> = {
      targetUserId,
      targetUserName: targetUser.name,
      targetUserEmail: targetUser.email,
      actorUserId: actor.id,
      actorUserName: actor.name,
      action: 'grant',
      role: targetUser.role,
      permissionsChanged: newPermissions,
      timestamp: new Date().toISOString(),
      reason: reason || 'Permissions updated by Super Admin',
    };
    batch.set(auditRef, auditRecord);

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, userPath);
  }
}

export async function updateUserRoleAndBranches(
  targetUserId: string,
  role: 'super_admin' | 'admin' | 'staff',
  assignedBranchIds: string[],
  active: boolean,
  actor: { id: string; name: string },
  targetUser: { name: string; email: string },
  reason: string
): Promise<void> {
  const userPath = `users/${targetUserId}`;
  try {
    const batch = writeBatch(db);
    batch.update(doc(db, 'users', targetUserId), {
      role,
      assignedBranchIds,
      active,
      updatedAt: new Date().toISOString(),
    });

    const auditRef = doc(collection(db, 'permissionAuditLogs'));
    const auditRecord: Omit<PermissionAuditLog, 'id'> = {
      targetUserId,
      targetUserName: targetUser.name,
      targetUserEmail: targetUser.email,
      actorUserId: actor.id,
      actorUserName: actor.name,
      action: 'role_change',
      role,
      permissionsChanged: assignedBranchIds,
      timestamp: new Date().toISOString(),
      reason: reason || `Updated role to ${role} and branch assignments`,
    };
    batch.set(auditRef, auditRecord);

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, userPath);
  }
}

export async function deleteUserProfile(
  targetUserId: string,
  actor: { id: string; name: string; role: string },
  targetUser: { name: string; email: string; role: string },
  reason?: string
): Promise<void> {
  const userPath = `users/${targetUserId}`;
  try {
    const batch = writeBatch(db);
    batch.delete(doc(db, 'users', targetUserId));

    const auditRef = doc(collection(db, 'permissionAuditLogs'));
    const auditRecord: Omit<PermissionAuditLog, 'id'> = {
      targetUserId,
      targetUserName: targetUser.name,
      targetUserEmail: targetUser.email,
      actorUserId: actor.id,
      actorUserName: actor.name,
      action: 'delete',
      role: targetUser.role,
      permissionsChanged: ['DELETED'],
      timestamp: new Date().toISOString(),
      reason: reason || 'User profile permanently deleted',
    };
    batch.set(auditRef, auditRecord);

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, userPath);
  }
}

// ================= BRANCHES =================
export async function getBranches(): Promise<Branch[]> {
  const path = 'branches';
  try {
    const snap = await getDocs(collection(db, 'branches'));
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Branch, 'id'>) }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function saveBranch(branch: Omit<Branch, 'id'> & { id?: string }): Promise<string> {
  const isNew = !branch.id;
  const branchRef = isNew ? doc(collection(db, 'branches')) : doc(db, 'branches', branch.id!);
  const path = `branches/${branchRef.id}`;
  try {
    const payload = sanitizeForFirestore({
      ...branch,
      id: branchRef.id,
      createdAt: branch.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    await setDoc(branchRef, payload, { merge: true });
    return branchRef.id;
  } catch (error) {
    handleFirestoreError(error, isNew ? OperationType.CREATE : OperationType.UPDATE, path);
  }
}

// ================= CATEGORIES & PRODUCTS =================
export async function getCategories(): Promise<Category[]> {
  const path = 'categories';
  try {
    const snap = await getDocs(query(collection(db, 'categories'), orderBy('sortOrder', 'asc')));
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Category, 'id'>) }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function saveCategory(category: Omit<Category, 'id'> & { id?: string }): Promise<string> {
  const catRef = category.id ? doc(db, 'categories', category.id) : doc(collection(db, 'categories'));
  const path = `categories/${catRef.id}`;
  try {
    const payload = sanitizeForFirestore({ ...category, id: catRef.id });
    await setDoc(catRef, payload, { merge: true });
    return catRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function getProducts(): Promise<Product[]> {
  const path = 'products';
  try {
    const snap = await getDocs(collection(db, 'products'));
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Product, 'id'>) }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function saveProduct(product: Omit<Product, 'id'> & { id?: string }): Promise<string> {
  const prodRef = product.id ? doc(db, 'products', product.id) : doc(collection(db, 'products'));
  const path = `products/${prodRef.id}`;
  try {
    const payload = sanitizeForFirestore({
      ...product,
      id: prodRef.id,
      createdAt: product.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    await setDoc(prodRef, payload, { merge: true });
    return prodRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

// ================= BRANCH INVENTORY & OVERRIDES =================
export async function getBranchProducts(branchId: string): Promise<BranchProduct[]> {
  const path = 'branchProducts';
  try {
    const q = query(collection(db, 'branchProducts'), where('branchId', '==', branchId));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<BranchProduct, 'id'>) }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function getAllBranchProducts(): Promise<BranchProduct[]> {
  const path = 'branchProducts';
  try {
    const snap = await getDocs(collection(db, 'branchProducts'));
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<BranchProduct, 'id'>) }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function adjustBranchStock(
  branchId: string,
  productId: string,
  productName: string,
  quantityChange: number,
  movementType: InventoryMovement['movementType'],
  reason: string,
  actor: { id: string; name: string }
): Promise<void> {
  const bpId = `${branchId}_${productId}`;
  const bpRef = doc(db, 'branchProducts', bpId);
  const movRef = doc(collection(db, 'inventoryMovements'));
  try {
    const batch = writeBatch(db);
    batch.set(
      bpRef,
      {
        branchId,
        productId,
        stockQuantity: increment(quantityChange),
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    const movement: Omit<InventoryMovement, 'id'> = {
      branchId,
      productId,
      productName,
      quantityChange,
      movementType,
      reason,
      actorId: actor.id,
      actorName: actor.name,
      createdAt: new Date().toISOString(),
    };
    batch.set(movRef, movement);

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `branchProducts/${bpId}`);
  }
}

export async function updateBranchProductPriceAndAlert(
  branchId: string,
  productId: string,
  priceOverride: number | undefined,
  lowStockAlert: number,
  stockTrackingEnabled: boolean
): Promise<void> {
  const bpId = `${branchId}_${productId}`;
  const bpRef = doc(db, 'branchProducts', bpId);
  try {
    await setDoc(
      bpRef,
      {
        branchId,
        productId,
        ...(priceOverride !== undefined ? { priceOverride } : {}),
        lowStockAlert,
        stockTrackingEnabled,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `branchProducts/${bpId}`);
  }
}

export function sanitizeForFirestore<T>(data: T): T {
  if (data === null || data === undefined) {
    return data;
  }
  if (Array.isArray(data)) {
    return data
      .filter((v) => v !== undefined)
      .map((v) => sanitizeForFirestore(v)) as unknown as T;
  }
  if (typeof data === 'object') {
    const res: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) {
        res[key] = sanitizeForFirestore(value);
      }
    }
    return res as T;
  }
  return data;
}

// ================= ORDERS & CHECKOUT =================
export async function createOrder(order: Omit<Order, 'id'>): Promise<string> {
  const orderRef = doc(collection(db, 'orders'));
  const path = `orders/${orderRef.id}`;
  try {
    const batch = writeBatch(db);
    const fullOrder: Order = sanitizeForFirestore({
      ...order,
      id: orderRef.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    batch.set(orderRef, fullOrder);

    // Decrement stock for tracked items
    for (const item of order.items) {
      const bpId = `${order.branchId}_${item.productId}`;
      const bpRef = doc(db, 'branchProducts', bpId);
      batch.set(
        bpRef,
        sanitizeForFirestore({
          branchId: order.branchId,
          productId: item.productId,
          stockQuantity: increment(-item.quantity),
          updatedAt: new Date().toISOString(),
        }),
        { merge: true }
      );

      // Record movement
      const movRef = doc(collection(db, 'inventoryMovements'));
      const mov: Omit<InventoryMovement, 'id'> = sanitizeForFirestore({
        branchId: order.branchId,
        productId: item.productId,
        productName: item.productName,
        quantityChange: -item.quantity,
        movementType: 'sale',
        reason: `Order #${order.receiptNumber}`,
        actorId: order.cashierId,
        actorName: order.cashierName,
        relatedOrderId: orderRef.id,
        createdAt: new Date().toISOString(),
      });
      batch.set(movRef, mov);
    }

    await batch.commit();
    return orderRef.id;
  } catch (error) {
    console.error('Error during createOrder batch write:', error);
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function getOrders(branchId?: string, maxLimit = 100): Promise<Order[]> {
  const path = 'orders';
  try {
    let q;
    if (branchId && branchId !== 'all') {
      q = query(
        collection(db, 'orders'),
        where('branchId', '==', branchId),
        orderBy('createdAt', 'desc'),
        limit(maxLimit)
      );
    } else {
      q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'), limit(maxLimit));
    }
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Order, 'id'>) }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function processRefund(
  order: Order,
  refundAmount: number,
  refundType: 'full' | 'partial',
  reason: string,
  actor: { id: string; name: string }
): Promise<void> {
  const orderRef = doc(db, 'orders', order.id);
  const refundRef = doc(collection(db, 'refunds'));
  try {
    const batch = writeBatch(db);

    batch.update(orderRef, {
      status: refundType === 'full' ? 'refunded' : 'partially_refunded',
      updatedAt: new Date().toISOString(),
    });

    const refundDoc: Omit<Refund, 'id'> = {
      orderId: order.id,
      receiptNumber: order.receiptNumber,
      branchId: order.branchId,
      branchName: order.branchName,
      amount: refundAmount,
      reason,
      refundType,
      status: 'approved',
      actorId: actor.id,
      actorName: actor.name,
      createdAt: new Date().toISOString(),
    };
    batch.set(refundRef, refundDoc);

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `orders/${order.id}`);
  }
}

// ================= STOCK TRANSFERS =================
export async function getStockTransfers(branchId?: string): Promise<StockTransfer[]> {
  const path = 'stockTransfers';
  try {
    const snap = await getDocs(query(collection(db, 'stockTransfers'), orderBy('createdAt', 'desc')));
    let list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<StockTransfer, 'id'>) }));
    if (branchId && branchId !== 'all') {
      list = list.filter((t) => t.sourceBranchId === branchId || t.destinationBranchId === branchId);
    }
    return list;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function createStockTransfer(transfer: Omit<StockTransfer, 'id' | 'transferNumber'>): Promise<string> {
  const tRef = doc(collection(db, 'stockTransfers'));
  const path = `stockTransfers/${tRef.id}`;
  try {
    const transferNumber = `TRF-${Date.now().toString().slice(-6)}`;
    const fullTransfer: StockTransfer = sanitizeForFirestore({
      ...transfer,
      id: tRef.id,
      transferNumber,
      notes: transfer.notes ? transfer.notes.trim() : '',
      status: 'draft',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    await setDoc(tRef, fullTransfer);
    return tRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function dispatchStockTransfer(
  transfer: StockTransfer,
  actor: { id: string; name: string }
): Promise<void> {
  const tRef = doc(db, 'stockTransfers', transfer.id);
  try {
    const batch = writeBatch(db);
    batch.update(tRef, {
      status: 'dispatched',
      dispatchedBy: actor.id,
      dispatchedByName: actor.name,
      updatedAt: new Date().toISOString(),
    });

    // Deduct stock from source branch
    for (const item of transfer.items) {
      const bpId = `${transfer.sourceBranchId}_${item.productId}`;
      const bpRef = doc(db, 'branchProducts', bpId);
      batch.set(
        bpRef,
        {
          branchId: transfer.sourceBranchId,
          productId: item.productId,
          stockQuantity: increment(-item.quantity),
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );

      const movRef = doc(collection(db, 'inventoryMovements'));
      const mov: Omit<InventoryMovement, 'id'> = {
        branchId: transfer.sourceBranchId,
        productId: item.productId,
        productName: item.productName,
        quantityChange: -item.quantity,
        movementType: 'transfer_out',
        reason: `Dispatched to ${transfer.destinationBranchName} (#${transfer.transferNumber})`,
        actorId: actor.id,
        actorName: actor.name,
        relatedTransferId: transfer.id,
        createdAt: new Date().toISOString(),
      };
      batch.set(movRef, mov);
    }

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `stockTransfers/${transfer.id}`);
  }
}

export async function receiveStockTransfer(
  transfer: StockTransfer,
  actor: { id: string; name: string }
): Promise<void> {
  const tRef = doc(db, 'stockTransfers', transfer.id);
  try {
    const batch = writeBatch(db);
    batch.update(tRef, {
      status: 'received',
      receivedBy: actor.id,
      receivedByName: actor.name,
      updatedAt: new Date().toISOString(),
    });

    // Add stock to destination branch
    for (const item of transfer.items) {
      const bpId = `${transfer.destinationBranchId}_${item.productId}`;
      const bpRef = doc(db, 'branchProducts', bpId);
      batch.set(
        bpRef,
        {
          branchId: transfer.destinationBranchId,
          productId: item.productId,
          stockQuantity: increment(item.quantity),
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );

      const movRef = doc(collection(db, 'inventoryMovements'));
      const mov: Omit<InventoryMovement, 'id'> = {
        branchId: transfer.destinationBranchId,
        productId: item.productId,
        productName: item.productName,
        quantityChange: item.quantity,
        movementType: 'transfer_in',
        reason: `Received from ${transfer.sourceBranchName} (#${transfer.transferNumber})`,
        actorId: actor.id,
        actorName: actor.name,
        relatedTransferId: transfer.id,
        createdAt: new Date().toISOString(),
      };
      batch.set(movRef, mov);
    }

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `stockTransfers/${transfer.id}`);
  }
}

// ================= EXPENSES =================
export async function getExpenses(branchId?: string): Promise<Expense[]> {
  const path = 'expenses';
  try {
    const q = query(collection(db, 'expenses'), orderBy('date', 'desc'), limit(100));
    const snap = await getDocs(q);
    let list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Expense, 'id'>) }));
    if (branchId && branchId !== 'all') {
      list = list.filter((e) => e.branchId === branchId || e.branchId === 'all');
    }
    return list;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function saveExpense(expense: Omit<Expense, 'id'> & { id?: string }): Promise<string> {
  const expRef = expense.id ? doc(db, 'expenses', expense.id) : doc(collection(db, 'expenses'));
  const path = `expenses/${expRef.id}`;
  try {
    const payload = sanitizeForFirestore({
      ...expense,
      id: expRef.id,
      notes: expense.notes ? expense.notes.trim() : '',
      createdAt: expense.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    await setDoc(expRef, payload, { merge: true });
    return expRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

// ================= AUDIT LOGS =================
export async function getAuditLogs(maxLimit = 100): Promise<AuditLog[]> {
  const path = 'auditLogs';
  try {
    const q = query(collection(db, 'auditLogs'), orderBy('timestamp', 'desc'), limit(maxLimit));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AuditLog, 'id'>) }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function getPermissionAuditLogs(maxLimit = 100): Promise<PermissionAuditLog[]> {
  const path = 'permissionAuditLogs';
  try {
    const q = query(collection(db, 'permissionAuditLogs'), orderBy('timestamp', 'desc'), limit(maxLimit));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<PermissionAuditLog, 'id'>) }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function logSystemEvent(
  actor: { id: string; name: string; role: string },
  action: string,
  entityType: string,
  entityId: string,
  details: string,
  branchId?: string
): Promise<void> {
  try {
    const ref = doc(collection(db, 'auditLogs'));
    const log: Omit<AuditLog, 'id'> = {
      actorId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      action,
      entityType,
      entityId,
      branchId,
      timestamp: new Date().toISOString(),
      details,
    };
    await setDoc(ref, log);
  } catch (error) {
    console.error('Failed to log system audit event:', error);
  }
}

// ================= SEED INITIAL SHOP DATA =================
export async function seedDemoDataIfEmpty(): Promise<boolean> {
  try {
    const branchSnap = await getDocs(collection(db, 'branches'));
    if (!branchSnap.empty) {
      return false; // Already initialized
    }

    const batch = writeBatch(db);

    // Initial 2 Branches
    const b1Ref = doc(collection(db, 'branches'));
    const b2Ref = doc(collection(db, 'branches'));

    const branch1: Branch = {
      id: b1Ref.id,
      name: 'Gulshan Delight Branch',
      code: 'FP-GLS',
      address: 'Shop 4, Rose Avenue, Gulshan Food Square',
      phone: '+91 98765 43210',
      status: 'active',
      timezone: 'Asia/Kolkata',
      taxRate: 0,
      openingDate: '2025-01-15',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const branch2: Branch = {
      id: b2Ref.id,
      name: 'Kothrud Sunset Galleria',
      code: 'FP-KTR',
      address: 'Unit 12, Paud Road, Kothrud',
      phone: '+91 98765 43211',
      status: 'active',
      timezone: 'Asia/Kolkata',
      taxRate: 0,
      openingDate: '2025-04-01',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    batch.set(b1Ref, branch1);
    batch.set(b2Ref, branch2);

    // Initial Categories
    const categoriesData = [
      { name: 'Falooda', description: 'Traditional creamy layered royal faloodas', sortOrder: 1 },
      { name: 'Milkshakes', description: 'Thick, creamy shakes with rich toppings', sortOrder: 2 },
      { name: 'Ice Cream', description: 'Handcrafted kulfi and premium scoops', sortOrder: 3 },
      { name: 'Juices', description: 'Fresh fruit juices and coolers', sortOrder: 4 },
      { name: 'Cold Drinks', description: 'Chilled syrups, mocktails and iced tea', sortOrder: 5 },
      { name: 'Snacks', description: 'Crispy dessert shop savory bites', sortOrder: 6 },
      { name: 'Toppings', description: 'Extra dry fruits, sabja seeds, and syrup', sortOrder: 7 },
    ];

    const categoryMap: Record<string, string> = {};
    for (const c of categoriesData) {
      const cRef = doc(collection(db, 'categories'));
      categoryMap[c.name] = cRef.id;
      batch.set(cRef, {
        id: cRef.id,
        name: c.name,
        description: c.description,
        sortOrder: c.sortOrder,
        active: true,
      });
    }

    // Initial Dessert Menu
    const productsData: Array<{
      name: string;
      category: string;
      sku: string;
      price: number;
      cost: number;
      desc: string;
      variants: Array<{ id: string; name: string; priceOffset: number }>;
      addOns: Array<{ id: string; name: string; price: number }>;
    }> = [
      {
        name: 'Royal Shahi Rose Falooda',
        category: 'Falooda',
        sku: 'FAL-001',
        price: 180,
        cost: 65,
        desc: 'Signature dessert with vermicelli, basil seeds (sabja), rose syrup, rabri, and rich pistachio kulfi',
        variants: [
          { id: 'v1', name: 'Regular', priceOffset: 0 },
          { id: 'v2', name: 'Large', priceOffset: 40 },
          { id: 'v3', name: 'Jumbo Royal', priceOffset: 80 },
        ],
        addOns: [
          { id: 'a1', name: 'Extra Rabri', price: 35 },
          { id: 'a2', name: 'Roasted Almonds & Pista', price: 25 },
          { id: 'a3', name: 'Extra Kulfi Scoop', price: 40 },
        ],
      },
      {
        name: 'Kesar Pista Supreme Falooda',
        category: 'Falooda',
        sku: 'FAL-002',
        price: 210,
        cost: 80,
        desc: 'Infused with royal saffron milk, loaded with crushed Iranian pistachios and creamy saffron ice cream',
        variants: [
          { id: 'v1', name: 'Regular', priceOffset: 0 },
          { id: 'v2', name: 'Large', priceOffset: 45 },
        ],
        addOns: [
          { id: 'a1', name: 'Extra Saffron Glaze', price: 30 },
          { id: 'a2', name: 'Extra Roasted Pista', price: 30 },
        ],
      },
      {
        name: 'Alphonso Mango Rabri Falooda',
        category: 'Falooda',
        sku: 'FAL-003',
        price: 220,
        cost: 85,
        desc: 'Pure Alphonso mango pulp layered with vermicelli, chia seeds, fresh mango chunks, and vanilla cream',
        variants: [
          { id: 'v1', name: 'Regular', priceOffset: 0 },
          { id: 'v2', name: 'Large', priceOffset: 50 },
        ],
        addOns: [{ id: 'a1', name: 'Extra Mango Cubes', price: 35 }],
      },
      {
        name: 'Belgian Chocolate Brownie Falooda',
        category: 'Falooda',
        sku: 'FAL-004',
        price: 230,
        cost: 90,
        desc: 'Decadent chocolate vermicelli, warm brownie bits, chocolate gelato, and roasted hazelnut syrup',
        variants: [
          { id: 'v1', name: 'Regular', priceOffset: 0 },
          { id: 'v2', name: 'Mega Shake Tub', priceOffset: 60 },
        ],
        addOns: [
          { id: 'a1', name: 'Warm Fudge Drizzle', price: 25 },
          { id: 'a2', name: 'Choco Chips', price: 20 },
        ],
      },
      {
        name: 'Strawberries & Cream Milkshake',
        category: 'Milkshakes',
        sku: 'SHK-001',
        price: 160,
        cost: 50,
        desc: 'Fresh strawberry puree blended with organic whole milk and strawberry ice cream',
        variants: [
          { id: 'v1', name: 'Regular (350ml)', priceOffset: 0 },
          { id: 'v2', name: 'Large (500ml)', priceOffset: 35 },
        ],
        addOns: [{ id: 'a1', name: 'Whipped Cream Cloud', price: 25 }],
      },
      {
        name: 'Lotus Biscoff Thickshake',
        category: 'Milkshakes',
        sku: 'SHK-002',
        price: 210,
        cost: 75,
        desc: 'Spiced speculoos cookie spread churned into velvety thick milkshake topped with cookie crumb',
        variants: [
          { id: 'v1', name: 'Regular', priceOffset: 0 },
          { id: 'v2', name: 'Large', priceOffset: 40 },
        ],
        addOns: [{ id: 'a1', name: 'Extra Biscoff Cookie', price: 30 }],
      },
      {
        name: 'Matka Malai Kulfi Sundae',
        category: 'Ice Cream',
        sku: 'ICE-001',
        price: 130,
        cost: 40,
        desc: 'Slow-cooked condensed milk kulfi served in a traditional clay pot garnished with cardamom',
        variants: [{ id: 'v1', name: 'Single Pot', priceOffset: 0 }],
        addOns: [{ id: 'a1', name: 'Rose Petal Preserve', price: 20 }],
      },
      {
        name: 'Fresh Pomegranate Refresher Juice',
        category: 'Juices',
        sku: 'JUC-001',
        price: 120,
        cost: 35,
        desc: 'Cold-pressed ruby red pomegranate with fresh mint and a pinch of black salt',
        variants: [
          { id: 'v1', name: 'Medium', priceOffset: 0 },
          { id: 'v2', name: 'Large', priceOffset: 30 },
        ],
        addOns: [],
      },
      {
        name: 'Rooh Afza Botanical Cooler',
        category: 'Cold Drinks',
        sku: 'DRK-001',
        price: 90,
        cost: 20,
        desc: 'Classic herbal rose syrup with freshly squeezed lemon juice, sparkling soda, and soaked sabja',
        variants: [{ id: 'v1', name: 'Glass', priceOffset: 0 }],
        addOns: [{ id: 'a1', name: 'Extra Basil Seeds', price: 15 }],
      },
      {
        name: 'Crispy Veg Cheese Bites',
        category: 'Snacks',
        sku: 'SNK-001',
        price: 110,
        cost: 35,
        desc: 'Golden fried herb bites stuffed with melted cheddar and sweet corn',
        variants: [{ id: 'v1', name: '6 Pcs', priceOffset: 0 }],
        addOns: [{ id: 'a1', name: 'Spicy Mint Mayo Dip', price: 20 }],
      },
    ];

    for (const p of productsData) {
      const pRef = doc(collection(db, 'products'));
      const catId = categoryMap[p.category] || '';
      const prod: Product = {
        id: pRef.id,
        name: p.name,
        categoryId: catId,
        sku: p.sku,
        globalSellingPrice: p.price,
        costPrice: p.cost,
        description: p.desc,
        active: true,
        variants: p.variants,
        addOns: p.addOns,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      batch.set(pRef, prod);

      // Seed stock for Branch 1 and Branch 2
      const bp1Ref = doc(db, 'branchProducts', `${b1Ref.id}_${pRef.id}`);
      const bp2Ref = doc(db, 'branchProducts', `${b2Ref.id}_${pRef.id}`);

      batch.set(bp1Ref, {
        id: `${b1Ref.id}_${pRef.id}`,
        branchId: b1Ref.id,
        productId: pRef.id,
        stockQuantity: 45,
        lowStockAlert: 10,
        stockTrackingEnabled: true,
        active: true,
        updatedAt: new Date().toISOString(),
      });

      batch.set(bp2Ref, {
        id: `${b2Ref.id}_${pRef.id}`,
        branchId: b2Ref.id,
        productId: pRef.id,
        stockQuantity: 30,
        lowStockAlert: 10,
        stockTrackingEnabled: true,
        active: true,
        updatedAt: new Date().toISOString(),
      });
    }

    await batch.commit();
    return true;
  } catch (error) {
    console.error('Error seeding initial demo data:', error);
    return false;
  }
}
