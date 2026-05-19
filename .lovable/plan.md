
# Tiles → SQFT-Based Inventory Refactor

## Current state (what's there today)

- Canonical stock unit for tiles is **pieces** (integer count).
- `sale_items.qty`, `purchase_items.qty`, `delivery_items.qty`, `product_batches.qty_remaining`, `stock.qty`, `stock_reservations.qty` are all stored as **decimal box-equivalent** (e.g. `6.42` = 6 box + 5 pcs when `pieces_per_box=12`).
- Product table has `per_box_sft` (display-only), `pieces_per_box`, `unit_type` (`box_sft` | `piece`).
- FIFO costing, reservations, backorder allocation, restore-on-cancel RPCs (`allocate_sale_batches`, `restore_sale_batches`, reservation RPCs) all assume the current unit.
- 30+ frontend files render qty as `formatStockUnit(qty, ppb, isTile)` from `src/lib/units.ts`.

## Target state

- For **tile** products only: canonical stored unit = **total SQFT** (decimal, 4 dp precision).
- Box + Pcs are derived purely for display, computed from `sqft_per_piece` and `pieces_per_box`.
- Piece-only products (sanitary) keep current behaviour unchanged.
- All entry forms (purchase, sale, return, adjustment, reservation) for tiles ask for **SQFT** as the primary input; Box/Pcs shown as auto-calculated read-only hints.

## Conversion formulas (single source of truth)

```text
sqft_per_piece = (tile_width * tile_height) / DIV     // DIV: in=144, cm=929.0304, ft=1
sqft_per_box   = sqft_per_piece * pieces_per_box
total_pieces   = total_sqft / sqft_per_piece          // float
full_box       = floor(total_pieces / pieces_per_box)
loose_pcs      = round(total_pieces - full_box*ppb)
```

A new helper `src/lib/tileUnits.ts` + `backend/src/lib/tileUnits.ts` will be the only place these formulas live. Used by frontend AND backend.

## Phased rollout

Each phase ships independently, is reversible, and leaves the app working.

### Phase T1 — Product schema + form (additive only, no behavior change)

- Migration `026_product_tile_dimensions.ts`:
  - Add columns: `tile_width numeric(8,3)`, `tile_height numeric(8,3)`, `size_unit text default 'inch'` (check: inch/cm/feet), `sqft_per_piece numeric(12,4)`, `sqft_per_box numeric(12,4)`.
  - Add `stock_base_unit text not null default 'piece'` (check: `piece` | `sqft`). Set `sqft` only for new tile products opting in; existing tiles stay `piece` for now.
  - Backfill `sqft_per_piece` for existing tiles where `per_box_sft` & `pieces_per_box` are known: `per_box_sft / pieces_per_box`.
- Update `productSchema.ts` + `ProductForm.tsx`:
  - New fields: Tile Size Width/Height, Size Unit, Pcs Per Box, auto-calc SQFT Per Piece, SQFT Per Box.
  - Show "Base Unit = SQFT" badge clearly for tile category.
  - Keep all existing fields working.
- No transaction or stock logic changes yet.

### Phase T2 — Read-side unit display

- New helper `tileUnits.ts` (FE + BE).
- New display helper `formatTileStock(sqft, product)` → `"250 SQFT | 15 box 0 pcs"`.
- Update read-only stock displays only (Product list, Stock Summary, Dashboard low-stock, Reports):
  - For products with `stock_base_unit='sqft'`: render SQFT + box/pcs derived.
  - For others: keep current rendering.
- Zero schema or write changes.

### Phase T3 — Backend transactional layer (mutations)

This is the heart of the change. Only affects products marked `stock_base_unit='sqft'`.

- Add new columns alongside existing ones (don't drop):
  - `sale_items.qty_sqft`, `purchase_items.qty_sqft`, `delivery_items.qty_sqft`, `sales_returns.qty_sqft`, `purchase_return_items.qty_sqft`, `product_batches.qty_sqft_remaining`, `stock.qty_sqft`, `stock_reservations.qty_sqft`.
- Update PL/pgSQL RPCs to a unit-aware variant:
  - `allocate_sale_batches_v2`, `restore_sale_batches_v2`, `reserve_stock_v2`, `consume_reservation_v2`, `release_reservation_v2`.
  - Each branches on `products.stock_base_unit`: sqft-mode uses the new columns, piece-mode keeps current behavior.
- Update backend routes:
  - `POST /api/purchases` — accept `qty_sqft`; increment `qty_sqft_remaining` + `stock.qty_sqft`.
  - `POST/PUT/DELETE /api/sales` — FIFO over `qty_sqft_remaining`; write `qty_sqft`.
  - `/api/returns/*` — symmetric.
  - `/api/deliveries`, `/api/adjustments`, `/api/reservations` — symmetric.
- Rate calculations: `line_total = rate_per_sqft * qty_sqft` for tile products. Add `rate_unit` column on sale_items / purchase_items (`per_sqft` | `per_box` | `per_piece`) so legacy rates aren't broken.

### Phase T4 — Frontend forms (entry side)

Once T3 is live for new products, migrate forms:

- `PurchaseForm`, `SaleForm`, POS, `SalesReturnForm`, `PurchaseReturnForm`, `StockAdjustDialog`, `CreateReservationDialog`, `CreateDeliveryDialog`.
- When selected product is `stock_base_unit='sqft'`:
  - Primary input: **Quantity (SQFT)** — decimal, 4 dp.
  - Read-only hints below: `= X box Y pcs`, `= Z total pieces`.
  - Rate field labelled `Rate / SQFT`.
  - Pre-submit validation: available SQFT ≥ requested SQFT.
- Piece-mode products keep current Box+Pcs entry.

### Phase T5 — Data migration + cutover (per-dealer, opt-in)

- Super-admin tool: "Migrate to SQFT base" per dealer (or per product).
  - Requires `tile_width`, `tile_height`, `size_unit`, `pieces_per_box` filled.
  - Backfills `product_batches.qty_sqft_remaining = qty_remaining * pieces_per_box * sqft_per_piece`.
  - Backfills `stock.qty_sqft` from sum of batches.
  - Flips `products.stock_base_unit` to `sqft`.
  - All open sales/purchases/deliveries retain their original `qty` AND get `qty_sqft` populated for consistency.
- Provides a dry-run report + rollback (set flag back to `piece`; legacy columns are untouched).

## Out of scope (intentionally)

- No change to piece-only sanitary products' behaviour.
- No drop of legacy `qty` columns until a follow-up cleanup phase after all dealers cut over.
- Reports' historical figures use whichever unit each line was recorded in (we'll display both side by side in the transitional period).

## File map (rough estimate)

```text
Phase T1 →  1 migration + productSchema.ts + ProductForm.tsx + tileUnits helpers (~5 files)
Phase T2 →  ProductList, StockSummaryDialog, dashboard widgets, reports (~10 files, read-only)
Phase T3 →  1 migration + 5 RPC updates + sales/purchases/returns/deliveries/reservations/adjustments routes (~10 backend files)
Phase T4 →  8 frontend forms
Phase T5 →  1 migration + super-admin migrate tool page + service + backfill script
```

Total: ~35-40 files across 5 deploys.

## Decision needed

1. **Approve the phased approach**, or do you want a single big-bang migration (riskier, but one deploy)?
2. **Should this also apply to sanitary products** (e.g. piece-based items get a new "size" field), or **tiles only**?
3. **Existing live tile data**: do you want auto-migration (we'll fill `tile_width/height` per product where possible from the `size` text field like `"8x12"`), or **manual product-by-product opt-in**?
4. **Rate convention going forward**: should the default sale rate field for tiles become **Rate / SQFT** (more intuitive given the change) or stay **Rate / Box**?

Once you answer those four, I'll start with Phase T1 (product schema + form — safe additive change, zero impact on existing transactions).
