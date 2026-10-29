# Falooda Point POS — Multi-Branch Dessert Management System

**Falooda Point POS** is a comprehensive, production-grade Point of Sale and dessert-shop management system built with React 19, TypeScript, Tailwind CSS, Firebase Authentication, and Cloud Firestore.

---

## 🎨 Dessert Shop Aesthetic & Theme
The application is styled with the dessert shop design palette:
- **Cream Background**: `#FFF9F0`
- **Soft Pink**: `#F8E7E5`
- **Primary Rose Pink**: `#D98591`
- **Hover Rose**: `#C66F7D`
- **Dark Berry Plum**: `#70445B`
- **Main Text**: `#493A3E`
- **Secondary Text**: `#79696D`
- **Border**: `#EADBD6`
- **White Cards**: `#FFFFFF`
- **Input Background**: `#FFFCF8`

---

## 👑 Three-Role Hierarchy with Granular Permissions

### 1. Super Admin
- Full application authority across all branches.
- Master permission grant/revoke panel for Admins and Staff.
- Create Admin and Staff accounts, change roles, assign branches.
- Consolidated multi-branch revenue and profit analytics.
- Protection against accidental deactivation of the last active Super Admin.
- Bootstrapped owner: `aicreation.np@gmail.com`.

### 2. Admin (Branch Manager)
- Manages assigned physical branches and counter staff.
- Operational access to POS billing and catalog management (if authorized).
- **Default Financial Guard**: Cannot view sales totals, revenue dashboards, or financial profit reports unless explicitly granted `reports.sales.view` or `dashboard.view_sales` by the Super Admin.
- Cannot create Admins or Super Admins; cannot grant permissions to themselves or promote themselves.

### 3. Staff (Cashier)
- Fast touch-friendly checkout for the assigned branch.
- Product search, size variants, add-ons (extra rabri, nuts, scoops), cart modifiers, discount applicator, and payment recording (Cash with tender/change calculator, UPI/QR, Card).
- Thermal receipt preview and printing (58mm and 80mm).
- By default, strictly denied access to sales totals, financial analytics, price modifications, and branch management.

---

## 🚀 Key Modules & Capabilities

1. **POS Billing & Checkout Counter (`src/components/PosView.tsx`)**:
   - Quick category filtering (Falooda, Milkshakes, Ice Cream, Juices, Cold Drinks, Snacks, Toppings).
   - Variant selection (Regular, Large, Jumbo) and custom add-ons.
   - Real-time stock verification: prevents checkout if items exceed branch inventory.
   - Preserves cart if connection fails.
   - Generates thermal receipts on completion.

2. **Thermal Receipt Printing & Preview (`src/components/ReceiptModal.tsx`)**:
   - Supports 58 mm and 80 mm thermal roll layouts.
   - Browser print stylesheet (`@media print`) rendering high-contrast black-and-white receipts.
   - Reprinting receipts without creating duplicate orders.

3. **Orders & Refunds (`src/components/OrdersView.tsx`)**:
   - Filter transactions by date, status, branch, or payment method.
   - Authorized Full and Partial refunds recording actor, amount, and reason.
   - Immutable orders: completed orders are never deleted.

4. **Owner & Sales Dashboard (`src/components/DashboardView.tsx`)**:
   - Filter by Today, Yesterday, Last 7 Days, Last 30 Days, This Month.
   - Net sales, gross sales, completed orders, average order value, cash vs digital split.
   - Estimated gross profit and operating results (guarded by permission).
   - Multi-branch performance comparison.
   - Real-time low-stock alerts.

5. **Sales & Itemized Reports (`src/components/ReportsView.tsx`)**:
   - Product-wise, Category-wise, and Cashier efficiency tables.
   - Permission-governed CSV data export (`reports.export`).

6. **Catalog & Branch Overrides (`src/components/CatalogView.tsx`)**:
   - Global catalog items with base prices, recipe notes, and cost prices.
   - Branch-specific price overrides (e.g. airport or mall branches charging customized rates).

7. **Branch Inventory & Stock Control (`src/components/InventoryView.tsx`)**:
   - Stock tracked separately per branch; sales at one branch never affect another.
   - Inward shipment restock, wastage logging, and audit logs.

8. **Inter-Branch Stock Transfers (`src/components/TransfersView.tsx`)**:
   - Audited workflow: Draft → Dispatch (deducts source stock) → Receive (increments destination stock).
   - Prevents double-receiving or duplicate dispatch.

9. **Expense Management (`src/components/ExpensesView.tsx`)**:
   - Branch-specific or shared business expense tracking (Dairy ingredients, packaging, electricity, rent).

10. **Super Admin Permission Control Panel (`src/components/PermissionsView.tsx`)**:
    - Centralized permission registry across 16 categories.
    - Checkbox matrix for instant granting and revoking without requiring user re-login.
    - Immutable permission audit log history.

11. **Security & System Audit Trail (`src/components/AuditLogsView.tsx`)**:
    - Append-only chronological event log.

---

## 🔒 Firebase Security Rules & Architecture

- **`firestore.rules`**:
  - ABAC and RBAC security model.
  - Strict default deny `match /{document=**} { allow read, write: if false; }`.
  - Identity verification and self-promotion prevention.
  - Orders are immutable and cannot be deleted.
  - Audit logs and permission logs are append-only.
- **`firebase-blueprint.json`**: Intermediate Representation documenting all entities and collection schemas.
- **`firestore.indexes.json`**: Optimized compound query indexes for orders, inventory, and branch products.

---

## 🌐 Free Hosting & Deployment Guide

### Publishing through Google AI Studio vs. Firebase Hosting
1. **Google AI Studio Preview & Dev Server**:
   - The applet runs continuously within the AI Studio managed cloud environment on port 3000.
   - Shareable with team members via the Shared App URL.
2. **Static Frontend on Firebase Hosting**:
   - Can be built using `npm run build` which outputs to `/dist`.
   - Free within the Firebase Spark plan limits (10 GB storage, 360 MB/day transfer).
   - Configure with `firebase.json` (already created).
   - Run `firebase deploy --only hosting` to publish to your custom domain on Firebase Hosting.

### Backend & Quota Considerations
- Authentication and Cloud Firestore are configured under Firebase's **Spark Free Tier** (50,000 document reads, 20,000 document writes, 20,000 document deletes per day).
- No paid billing is required for this configuration.

---

## 💾 Backup Recommendations
1. **Firestore Managed Backups**: Use `gcloud firestore export gs://[YOUR_BUCKET_NAME]` to periodically snapshot collections (`orders`, `branchProducts`, `users`, `auditLogs`).
2. **CSV Reports Export**: Authorized Super Admins can periodically use the "Export Product Sales (CSV)" feature in the Reports module for local offline bookkeeping.
