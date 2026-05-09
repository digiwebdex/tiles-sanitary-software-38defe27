# ERP Modernization Plan — Safe, Phased, Non-Breaking

## Guiding rules (locked in)

- No POS work of any kind.
- No DB structure changes unless absolutely required (only additive: new tables/columns, never rename or drop).
- All existing modules, routes, forms, reports, ledgers, sales/purchase/delivery flows stay exactly as today.
- Automation level = **Suggest only**. The system surfaces alerts, draft suggestions, and reminders — the dealer always clicks to act.
- Reuse what already exists: low-stock service, approval workflow, audit logs, notification service (SMS/Email), daily summary cron, automated backups, credit control, RBAC.
- Every new screen ships with loading / empty / error / success states.

---

## Phase 1 — Interactivity Layer (quick wins, ~1 short build)

Goal: make the existing ERP feel modern and fast without touching business logic.

1. **Global Command Palette (Ctrl/Cmd+K)**
   - Floating search opened from header button + keyboard.
   - Searches: customers, suppliers, products (SKU/name), invoices, challans, purchases.
   - Quick-action commands: "New Sale", "New Purchase", "Record Payment", "New Customer", "New Product", "Open Reports", "Open Approvals".
   - Role-aware: salesman only sees insert actions allowed for them; financial jumps hidden.

2. **Notifications Bell (header)**
   - Live dropdown listing: new approval requests pending, low-stock items, overdue customers, expiring subscription, failed SMS/Email.
   - Unread badge count.
   - Each item links to the existing page (no new module).
   - Polled every 60s (no realtime infra change required).

3. **Header Quick-Actions bar**
   - Persistent buttons for the 4 most-used actions (New Sale, New Purchase, Record Payment, New Customer) with role checks.

4. **Sidebar polish**
   - Group items: Sales / Inventory / Purchases / Finance / Reports / Settings.
   - Highlight active route, keep current group expanded, collapsible to icon-rail.
   - Mobile: off-canvas drawer (already supported by shadcn sidebar).

5. **Global UI states pass**
   - Add reusable `<EmptyState>`, `<LoadingState>`, `<ErrorState>` components and apply to the top 10 list pages (Sales, Purchases, Customers, Suppliers, Products, Ledger, Collections, Deliveries, Approvals, Reports).
   - Standardize success toasts via existing `sonner`.

## Phase 2 — Smart Dashboard (~1 build)

Goal: replace the current near-empty Index with an actionable cockpit. Read-only — no write logic.

KPI cards (today + this month toggles), all sourced from existing `/api/dashboard`, `/api/reports/*`, `/api/collections`, `/api/ledger`:

- Sales (count + amount), Purchases, Collections, Expenses
- Receivable (total + overdue), Payable
- Gross Profit (already exposed in reports)
- Stock value (FIFO valuation already exists)

Action panels (each = list + "go to" link, no inline edits in Phase 2):

- **Low-stock items** (uses existing 2× reorder-buffer logic) with "Suggest reorder qty" column — a *suggestion only*, button just opens the existing Purchase form prefilled.
- **Overdue customers** (uses existing aging buckets) with "Send reminder" button → opens existing notification dispatch dialog.
- **Pending approvals** for the current user's role.
- **Today's activity feed** (last 10 audit events relevant to dealer_admin).

Layout: responsive grid, dark theme, orange/amber accents — matches existing tokens. No drag/drop in Phase 2 (kept simple).

## Phase 3 — Suggestion & Reminder Engine (~1 build)

All suggest-only, all opt-in via Settings → Automation.

1. **Auto reorder suggestions page**
   - Daily computed list: products at/under reorder point. Shows last purchase supplier, avg daily sales (last 30d), suggested order qty.
   - "Create draft purchase" button uses existing `CreatePurchaseDraftDialog` — dealer reviews/edits/saves as today.

2. **Payment due reminders queue**
   - Daily scan of receivables: groups customers with dues > X days (configurable).
   - Bulk-select → "Send SMS" or "Send Email" via existing notification service (Bengali SMS template, English email).
   - Logs every send to `notifications` table (already exists).

3. **Overdue alerts**
   - Surface in notification bell + dashboard panel; threshold reuses existing customer credit settings.

4. **Daily business summary**
   - Already exists via pg_cron; add a Settings toggle UI (per dealer) and a "Send me a test summary now" button.

5. **Scheduled backup/export UI**
   - Existing rclone backup runs on VPS. Add a **Data Export** screen (already partially built) listing daily exports + on-demand "Export now" (Sales/Purchases/Customers/Suppliers/Products/Ledger as CSV/Excel via existing SheetJS util).

## Phase 4 — Approval & Audit polish (~½ build)

All using existing `approval_requests` + `audit_logs` tables — no schema change.

1. **Unified Approvals inbox** (already exists at `/approvals`) — add filter chips (type, requester, date), bulk approve for low-risk types only (note: high-risk types `credit_override`, `sale_cancel`, `stock_adjustment` keep mandatory note as enforced by `decide_approval_request`).
2. **Approval triggers config UI** — per-dealer toggles for: discount > X%, credit-limit change, purchase > ৳Y, return value > ৳Z, payment write-off. Stored in existing approval settings.
3. **Audit Log viewer** — filterable table over `audit_logs`: action type, table, user, date range. Read-only, dealer_admin only. Export to Excel.

---

## RBAC enforcement (every phase)

- Salesman: cannot see KPI amounts, profit, payable, audit log, approvals inbox, automation settings.
- Bell only shows items the role is allowed to act on.
- Command-palette commands filter by `usePermissions`.
- All new backend endpoints reuse existing `requireDealer` + `requireRole`.

## What we will NOT touch

- `sales`, `purchases`, `stock`, `product_batches`, `customer_ledger`, `supplier_ledger`, `deliveries`, `challans`, `sale_items`, `purchase_items` tables.
- Existing form behaviors, invoice numbering, FIFO logic, batch allocation RPCs.
- Subscription/portal/super-admin flows.

## Technical details (for reviewer)

- New routes only: `/dashboard` (replaces Index content), `/automation/reorder-suggestions`, `/automation/payment-reminders`, `/audit-logs`. All other routes unchanged.
- New components only — no modifications to existing service files except adding read-only helpers if needed.
- New backend endpoints (read-only or wrappers around existing logic): `GET /api/dashboard/kpis`, `GET /api/notifications/inbox`, `GET /api/automation/reorder-suggestions`, `GET /api/automation/payment-reminders`, `GET /api/audit-logs`. All reuse existing services.
- No new DB tables required for Phases 1–4. If Phase 3 needs a `dealer_automation_settings` row, it will be a single additive table with sensible defaults.

---

## Testing checklist (run after each phase)

**Sales:** create direct invoice, create with challan-mode, edit unpaid sale, cancel paid sale (blocked), partial payment, full payment, customer ledger updates, audit log entry created, notification settings honored.

**Purchase:** create with landed cost, edit, cancel, supplier ledger entry, batch + stock + avg cost updated atomically, backorder allocation runs, barcode print works.

**Inventory:** product CRUD, stock adjustment requires approval if enabled, batch tracking intact, low-stock alert appears, FIFO valuation matches, display-stock move works.

**Customer / Supplier:** CRUD, opening balance trigger fires, credit limit enforced, follow-up status updates, opening balance ledger entry created.

**Payment / Ledger:** record collection, base36 receipt generated, customer + cash ledger updated, due aging buckets recalc, expense entry creates expense + cash ledger.

**Delivery:** partial delivery, full delivery, stock reservation consumed, sale delivery status syncs, commission promotion fires.

**Reports:** all 13 reports load, salesman blocked from financial reports, Excel export works, date filters honor UTC+6.

**Approvals:** request created with correct fingerprint, approve/reject with note enforcement, consume on action, stale on edit, expire after TTL, audit log entry per transition.

**New surface:** Cmd+K opens & searches, bell shows unread + items, dashboard KPIs match reports, low-stock list matches inventory page, reorder draft prefills correctly, payment reminder sends via SMS/Email and logs, audit viewer filters correctly, all empty/loading/error states render.

**RBAC:** log in as salesman → no KPIs, no profit, no approvals inbox, no automation, no audit; log in as dealer_admin → full access; log in as super_admin → bypasses normal dealer scope.

**Mobile:** sidebar drawer opens, dashboard cards stack, command palette usable, no horizontal scroll on lists.
