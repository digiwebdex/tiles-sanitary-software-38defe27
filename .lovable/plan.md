# Plan: Box + Piece Dual-Unit Stock System

This is a large, system-wide change touching the database schema, backend (VPS Node/Express), and frontend (React). I'll deliver it in phases so each phase is testable on its own and we don't break the live ERP.

## Scope confirmation (please review before I start)

A few things I need you to confirm before I touch the code, because they materially change the work:

1. **Tiles vs sanitary products.** Today tiles use **Box / SFT** logic (SFT pricing, SFT stock for tiles), and sanitary uses **Piece**. Your new spec replaces this with **Box + Piece** everywhere. Two options:
   - **(A) Replace SFT logic entirely** with Box+Piece (your spec as written). Simpler, but tiles will no longer track SFT in stock — only pieces.
   - **(B) Keep SFT as a *display/pricing* helper for tiles, but make pieces the canonical stock unit** for both categories. Box+Piece is shown everywhere; SFT is computed from `pieces × sft_per_piece` only where pricing needs it.
   
   I strongly recommend **(B)** — it matches your existing tile pricing without losing data. Please confirm.

2. **Existing data migration.** You said default `pieces_per_box = 1` for legacy products. That means every legacy "1 box" row becomes "1 piece" in stock terms. For sanitary products that's fine. For tile products it will under-count stock until you fix `pieces_per_box` per product. Acceptable?

3. **Batches & FIFO.** Stock is currently tracked per `product_batches` row (FIFO costing, reservations, backorder allocation, sales returns). Box+Piece must live at the **batch** level too (not just product totals), otherwise FIFO breaks. I'll add `box_qty / piece_qty / total_pieces` to batches and reservations.

4. **Reservations, backorders, display stock, sample issues, deliveries, challans** all touch stock. They will all be migrated to pieces. No behavior change beyond unit, just internal arithmetic.

5. **Rollout.** Because this rewrites stock math, I'll ship it behind a per-dealer feature flag (`dealers.dual_unit_enabled`) defaulted **off**. You enable it per dealer once you've set `pieces_per_box` on their products. Existing dealers continue working unchanged until flipped on.

If you want me to skip the flag and migrate everyone at once, say so.

---

## Phase 1 — Schema & migration (backend)

New migration `018_box_piece_units.ts`:

- `products.pieces_per_box INT NOT NULL DEFAULT 1` (+ CHECK > 0)
- `dealers.dual_unit_enabled BOOLEAN NOT NULL DEFAULT false`
- `purchase_items`: add `box_qty NUMERIC, piece_qty NUMERIC, total_pieces NUMERIC` (keep existing `quantity` for back-compat; backfill `total_pieces = quantity`, `box_qty = quantity`, `piece_qty = 0`)
- `sale_items`: same three columns, same backfill
- `sales_returns`, `purchase_returns`: same three columns
- `product_batches`: add `total_pieces NUMERIC` and `pieces_per_box_snapshot INT` (snapshot at purchase time so historical FIFO is stable even if the product's pieces_per_box changes later); backfill from current qty
- `stock_reservations`: add `total_pieces NUMERIC`
- New table `stock_ledger` (product_id, dealer_id, txn_type, reference_table, reference_id, reference_no, box_qty, piece_qty, pieces_per_box, total_pieces, stock_before_pieces, stock_after_pieces, stock_before_display, stock_after_display, created_at)
- Helper SQL function `format_box_piece(total_pieces, ppb) RETURNS text`
- Trigger or service-side writer to populate `stock_ledger` on every stock-changing RPC

## Phase 2 — Backend RPCs & routes

Update the atomic PL/pgSQL functions used by the VPS routes (purchase create, sale create/update/cancel, returns, deliveries, reservations, backorder allocation):

- Accept `box_qty` + `piece_qty`, normalize (`pieces = box*ppb + piece`, then re-split if `piece >= ppb`), write all three columns
- Stock arithmetic in pieces only (`product_batches.total_pieces`, `stock_reservations.total_pieces`)
- Insufficient-stock errors return the deficit as `"Available: X box Y pcs"`
- Write `stock_ledger` row inside the same transaction
- Endpoints affected: `/api/products`, `/api/purchases` (POST/PUT), `/api/sales` (POST/PUT/DELETE), `/api/returns/*`, `/api/deliveries`, `/api/challans`, `/api/reservations`, `/api/adjustments`, `/api/stock`, `/api/reports/*`

Stock read endpoints add `box_qty`, `piece_qty`, `total_pieces`, `display` to every stock payload.

## Phase 3 — Frontend (React)

- **ProductForm**: required `pieces_per_box` field with validation (`> 0`), warning banner when value is 1 on legacy products.
- **PurchaseForm row**: replace single Qty input with `Box Qty` + `Piece Qty` + read-only `Pieces/Box` + read-only `Total Pieces`. Auto-normalize on blur.
- **SaleForm / POSSalePage row**: same Box+Piece inputs, plus inline "Available: X box Y pcs" before adding, and "Remaining: X box Y pcs" after entry. Block submit if insufficient stock (unless `allow_backorder`).
- **PurchaseReturnForm, SalesReturnForm**: Box+Piece inputs, capped at original sold/purchased pieces.
- **Stock displays** (StockReport, ProductList, product picker dropdown, dashboard widgets, low-stock alerts): show `"7 box 9 pcs"` with subtle `"Total: 93 pcs"` underneath. Remove decimal box displays.
- **Reports** (Stock, Product, Purchase, Sales, Ledger, Aging, Valuation): add Box / Piece / Total Pieces / Remaining (Box+Piece) columns.
- **Subtotal math**: tile pricing keeps SFT (option B above) — `subtotal = total_pieces × sft_per_piece × rate_per_sft`; sanitary — `subtotal = total_pieces × rate_per_piece` (or per-box mode `subtotal = (total_pieces / ppb) × rate_per_box`).
- Schemas (`saleSchema.ts`, `purchaseSchema.ts`, returns) updated with Zod `box_qty`/`piece_qty` and refinement rule.

## Phase 4 — Edit / delete integrity

Sale/Purchase update and cancel flows already use the atomic restore→reapply pattern (phases 3M, 3N). I'll extend those RPCs to operate on pieces and write reversal `stock_ledger` rows. No behavior change for users.

## Phase 5 — QA checklist (your acceptance test, automated)

I'll add a Vitest scenario reproducing your final acceptance test (Wall Tiles, ppb=12, the four operations) and a backend integration test against a scratch dealer to verify ledger and batch totals end at `9 box 2 pcs / 110 pcs`.

---

## Technical details (reference)

- All stock math in **pieces** (NUMERIC to allow fractional pieces if a tile is ever cut, but UI uses integers).
- Display helper `formatBoxPiece(pieces, ppb)` lives in `src/lib/units.ts` and the SQL `format_box_piece()` mirror.
- Normalization helper `normalizeBoxPiece({box, piece}, ppb)` shared between Zod schemas and backend.
- Feature flag check: `if (dealer.dual_unit_enabled) { use new path } else { legacy path }` in services until you flip everyone over.
- No changes to: auth, subscription, CMS, notifications, audit log shape (audit gets the new ledger reference).

---

## Effort & risk

- ~1 large migration, ~12 backend route/RPC updates, ~20 frontend file edits, ~6 Zod schema updates, ~5 report updates.
- Highest risk: FIFO batch math + reservations + backorder allocation (already complex). Feature flag mitigates.
- I will **not** run the migration until you approve this plan.

**Please confirm:**
1. Option A or **B** for tile SFT (I recommend B).
2. OK to ship behind `dual_unit_enabled` per-dealer flag (default off).
3. OK with `pieces_per_box = 1` default for legacy products.

Once you confirm, I'll start with Phase 1 (migration) and check in with you before Phase 2.
