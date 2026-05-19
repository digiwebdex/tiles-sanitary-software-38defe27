# Codex Feature Checklist — Coverage Audit

Walked the codebase (`src/pages`, `src/modules`, `src/services`, `backend/src/routes`) against your 8 priority lists. Legend: **✅ built** · **🟡 partial** · **❌ missing**.

---

## P1 — Product + Inventory Foundation

| Field / Rule | Status | Notes |
|---|---|---|
| Product Brand | ✅ | `brand` text field |
| Product Group | ❌ | No `product_group` column/field |
| Product Grade | ❌ | No `grade` column/field |
| Base Unit (piece / sqft) | ✅ | `stock_base_unit` (T1 shipped) |
| Tile Width / Height / Size Unit | ✅ | T1 — inch/cm/feet |
| Pcs per Box | ✅ | |
| SQFT/Piece + SQFT/Box auto | ✅ | live recompute in ProductForm |
| Barcode | ✅ | `barcode` + jsbarcode print |
| Purchase Price (cost) | ✅ | `cost_price` |
| Sales Price | ✅ | `default_sale_rate` |
| Wholesale + Dealer Price | 🟡 | Pricing Tiers module exists — but no fixed "wholesale"/"dealer" columns on product. Tier-per-customer instead |
| Stock Alert | ✅ | `reorder_level` + low-stock dashboard |
| Product Description | 🟡 | no `description` column today (only `material`/`weight`/`warranty` for sanitary) |
| Stock stored in SQFT | 🟡 | Columns added (T3), per-product cutover RPC shipped (T5). Allocators still piece-canonical until the per-product switch is flipped |
| Display "250 SQFT \| 15 box 0 Pcs" | 🟡 | helpers exist (`tileUnits.ts`), display swap planned in T2 |
| Purchase/Sale/Return/Damage/Transfer update SQFT | 🟡 | `qty_sqft` persisted (T4a/b); stock-update path is still box/piece-based until T5 cutover RPC v2 lands |

## P2 — Purchase Module

| Item | Status |
|---|---|
| Supplier Opening Balance | ✅ (trigger `supplier_opening_balance_ledger`) |
| Purchase Entry (SQFT input) | 🟡 form persists `qty_sqft`, primary input still Box+Pcs |
| Purchase Return + List | ✅ |
| Damage Entry | 🟡 `StockAdjustDialog` + `BrokenStockDialog` exist (adjustments `broken` type). No dedicated "Damage Entry" page |
| Damage List | ❌ no list page — lives inside audit/adjustments |
| Product Stock Inventory Report | ✅ |
| Inventory Batch Report | ✅ `BatchReports.tsx` |
| Purchase Report | ✅ |
| Purchase & Return Details | ✅ ViewPurchase + return list |
| Supplier Statement | ✅ `supplierService` + ledger |

## P3 — Sales Module

| Item | Status |
|---|---|
| Sales Entry | ✅ |
| POS Sales | ✅ `POSSalePage` |
| Quick Sales | 🟡 POS doubles as quick sale — no separate "Quick" mode |
| Invoice List | ✅ `SalesPage` |
| Sales Return + List | ✅ |
| Create Order / Order List | 🟡 Quotations + Sales exist; no separate "Order" entity (sales acts as order) |
| Order Delivery List | ✅ Deliveries module |
| Daily Sales Details | ✅ in Reports |
| Sales & Return Statement | ✅ |
| Sales Details Report | ✅ |
| Cash Sales Invoice | ✅ (cash mode on sales) |
| Due & Advance Invoice | 🟡 due tracked via ledger; no dedicated "advance" workflow |
| EMI Details Report | ❌ no EMI module |
| Profit & Loss Report | ✅ |
| SQFT-validated stock check | 🟡 validates piece-stock today; SQFT validation lives after T5 cutover |

## P4 — Warehouse / Godown

| Item | Status |
|---|---|
| Add Warehouse | ✅ |
| Warehouse In/Out (transfer) | ✅ `warehouse_transfers` table + route |
| In/Out List | ✅ |
| Warehouse Inventory Report | 🟡 stock report exists; not warehouse-scoped per-product yet |
| In/Out Details Report | 🟡 list yes, dedicated detail report no |
| Product Sending Request / Receive Approval | ❌ no request→approve workflow (transfer is single-step) |
| Branch-wise transfer approval | ❌ |
| SQFT-aware transfer | ❌ transfer uses box/piece qty today |

## P5 — Accounts Reports (direct access)

| Item | Status |
|---|---|
| Account Transaction | ✅ Ledger |
| Ledger Transaction / Statement | ✅ |
| Journal Entry | ❌ no manual journal UI |
| Contra Voucher | ❌ |
| Voucher List | 🟡 only Director + Salary vouchers |
| Cash & Bank Book | ✅ Cashbook + Bank Accounts |
| Cash Transaction Details | ✅ |
| Receipt & Payment | 🟡 payments yes, no formal "Receipt & Payment" statement |
| Trial Balance | ❌ |
| Balance Sheet | ❌ |
| Profit & Loss | ✅ |
| Income & Expenses | ✅ Expenses + Cashbook |
| Customer / Supplier Statement | ✅ |
| Transaction cancel request | ✅ approvals (`sale_cancel`) |
| Authorization/approval list | ✅ `ApprovalsPage` |
| Back-date control | ❌ no back-date guard configurable |

## P6 — CRM

| Item | Status |
|---|---|
| Customer Opening Balance | ✅ (trigger) |
| Customer Closing | 🟡 no "close" status, only active/inactive |
| Manage Leads | ✅ `LeadsPage` |
| Lead Visiting / Visiting Register | ❌ no visit-tracking table |
| Lead Options / Action Settings | 🟡 leads have status + next_action; no admin-config of option lists |
| Customer / Lead Register | ✅ |
| Customer Statement | ✅ |

## P7 — Notifications

| Item | Status |
|---|---|
| WhatsApp/SMS due reminder | ✅ `notificationService` + `payment_reminder` |
| SMS sent history | ✅ |
| Single SMS send | ✅ `SingleSmsPage` |
| EMI/Due alert setup | 🟡 due alert yes, EMI no |
| Invoice share via WhatsApp | ✅ `whatsappService` |

## P8 — Settings

| Item | Status |
|---|---|
| Manage Branch | ❌ multi-branch not modelled (warehouse ≈ branch) |
| Employee Register | ✅ HRM |
| Director Register | ✅ |
| File Manager | ✅ |
| Notice Setup | ❌ |
| Holiday Setup | ✅ |
| Closing Business Day | ✅ `cash_closing` |
| Role/Permission per module | ✅ `RoleManagementPage` |

---

## Concrete gaps to close (suggested build order)

```text
1. Product schema: add `product_group`, `grade`, `description` columns + form fields
2. Finish T5 cutover: SQFT-aware allocator RPCs (v2) so stock truly moves in SQFT
3. Damage: dedicated Damage Entry page + Damage List (reuse adjustments 'broken')
4. Accounts: Journal Entry + Contra Voucher screens, Trial Balance, Balance Sheet
5. Warehouse: SQFT-aware transfers + send-request / receive-approval flow
6. CRM: Lead Visiting register, configurable Lead Options
7. EMI plans: schedule table + EMI Details Report + due alerts
8. Branches & Notice board (lower priority — warehouse can stand in)
```

Want me to break any of these into its own phased plan? Pick the gaps and I'll draft the migration + UI work for those next.
