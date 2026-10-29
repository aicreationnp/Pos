# Security Specification & Threat Model for Falooda Point POS

## 1. Data Invariants
1. **Zero Self-Promotion**: A user cannot modify their own `role` or self-assign `permissions`.
2. **Super Admin Invariant**: Only Super Admins (and the bootstrapped owner `aicreation.np@gmail.com`) can grant or revoke permissions or create Admin accounts.
3. **Branch Isolation**: Staff and Branch Admins can only create sales, adjustments, or view orders for their assigned branches.
4. **Sales Aggregate Secrecy**: Cashiers and Staff without `reports.sales.view` cannot read aggregate financial totals or sales reports.
5. **Immutable Records**: Completed orders cannot be deleted or have their historical prices mutated.
6. **Append-Only Auditing**: `auditLogs` and `permissionAuditLogs` cannot be updated or deleted by normal users.
7. **Inventory Non-Negativity**: Sales and transfers can only decrement stock if adequate stock is available, and transfers must follow states `draft` -> `dispatched` -> `received` with no double-receiving.

## 2. The Dirty Dozen Adversarial Payloads
1. **Self-Promotion to Super Admin**: Regular staff sending `{ role: "super_admin" }` update to `/users/{myUid}`. (Must be REJECTED).
2. **Self-Granting Sales Report Permission**: Admin adding `"reports.sales.view"` to their own permissions array. (Must be REJECTED).
3. **Cross-Branch Order Creation**: Staff assigned only to Branch A creating an order tagged with Branch B. (Must be REJECTED).
4. **Altering Historical Order Pricing**: Cashier modifying `totalAmount` on a completed order document. (Must be REJECTED).
5. **Direct Audit Log Erasure**: Admin attempting `deleteDoc(doc(db, "auditLogs", logId))`. (Must be REJECTED).
6. **Negative Transfer Attack**: Transfer dispatch attempting negative quantity to create phantom stock. (Must be REJECTED).
7. **Double Receive Vulnerability**: Attempting to transition a stock transfer from `received` to `received` again. (Must be REJECTED).
8. **PII Harvesting / Blanket Query**: Unauthenticated user trying to read user documents. (Must be REJECTED).
9. **Price Hijack**: Staff member without `products.change_price` attempting to update `globalSellingPrice` on a product. (Must be REJECTED).
10. **Ghost Field Injection**: Adding `{ backdoorUser: true }` into an order or user update. (Must be REJECTED by strict key whitelist).
11. **Id Poisoning**: Injecting 2KB string as `branchId` or `productId`. (Must be REJECTED by `isValidId`).
12. **Unverified Email Admin Claim**: Attempting admin write with fake unverified email claims. (Must be REJECTED).
