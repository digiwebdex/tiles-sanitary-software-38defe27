## 2B-ii — Backend writes total_pieces + stock_ledger (purchases path) + stock-display rollout

Goal: পেছনের অংশে purchase সেভ হলে এখন থেকে `total_pieces` সঠিকভাবে পপুলেট হবে, প্রতি stock-পরিবর্তনে `stock_ledger`-এ একটি audit row লেখা হবে, এবং UI-তে stock দেখানোর জায়গাগুলোতে নতুন `<TileStockBadge>` (Box + Pc + ≈SFT) ব্যবহার হবে। Sales/Returns/Reservations 2C-2D-তে।

---

### A. Backend — `POST /api/purchases` (file: `backend/src/routes/purchases.ts`)

বর্তমান flow: header → items → batch upsert → stock upsert → backorder allocator। সব box-ভিত্তিক ছিল। পরিবর্তন:

1. **Item resolution stage** (যেখানে item.unit_type, perBoxSft লোড হয়) — সাথে `pieces_per_box` (default 1) লোড করব।
2. প্রতি আইটেমে compute `totalPieces = item.quantity * piecesPerBox` (legacy `quantity` = boxes for tiles, = pieces for piece-units; backward-compatible)। `box_qty = item.quantity`, `piece_qty = 0` (frontend আজও partial pcs পাঠায় না)।
3. `purchase_items` insert — `box_qty`, `piece_qty`, `total_pieces` কলামে লিখব (ইতিমধ্যেই migration দিয়েছে)।
4. `product_batches` insert/update — নতুন rows-এ `total_pieces` ও `pieces_per_box_snapshot` সেট। existing batch update করলে `total_pieces += delta`।
5. `stock` upsert — বিদ্যমান `box_qty`/`sft_qty`/`piece_qty` রাখব (regression-free), পাশাপাশি `total_pieces += delta` সেট।
6. **stock_ledger insert** প্রতি item-এ:
   - `txn_type='purchase_in'`
   - `reference_table='purchases'`, `reference_id=purchase.id`, `reference_no=invoice_number`
   - `box_qty`, `piece_qty=0`, `pieces_per_box`, `total_pieces`
   - `stock_before_pieces` / `stock_after_pieces` (SELECT-FOR-UPDATE নেওয়ার সময় ধরা)
   - `stock_before_display` / `stock_after_display` — `format_box_piece` সমতুল্য JS helper দিয়ে
7. সব এক transaction-এর ভিতরে — current code ইতিমধ্যে `trx` ব্যবহার করছে।

**Backward compat**: যেসব legacy ডিলারের `pieces_per_box=1`, total_pieces == box_qty — কোনো math নষ্ট হয় না। `dual_unit_enabled` toggle সরাসরি চেক করব না; কারণ `total_pieces` সবসময় সঠিক থাকা ভাল (ভবিষ্যৎ display layer এর জন্য)।

### B. Frontend — service & types

- `src/services/purchaseService.ts`: `PurchaseItemInput`-এ optional `box_qty`, `piece_qty`, `total_pieces` যোগ করব (পুরাতন `quantity` রেখে)। PurchaseForm এখনো শুধু `quantity` পাঠায় — backend resolve করে নেবে।

### C. UI — TileStockBadge প্রয়োগ (read-only sites)

আজকের scope-এ যে surfaces:
1. **Product list / detail page** stock cell — `src/pages/products/ProductList.tsx` (যা থাকে), `ProductDetailPage` যদি থাকে। Confirm by exploring।
2. **Dashboard low-stock card** — current low-stock alerts component।
3. **Stock adjust dialog summary** — `StockAdjustDialog` shows current stock।
4. **Sale form availability hint** — touches sale form, deferred to 2C।

Each consumer needs `total_pieces`, `pieces_per_box`, `per_box_sft`, `category`/`unit_type`। Stock GET endpoints already include these via products join; will verify and patch any missing fields.

### D. Migration / DB

Migration 018 ইতিমধ্যেই deployed — কোন নতুন schema নেই। শুধু code-level পরিবর্তন।

### E. Test

- Demo dealer-এ:
  1. Tile product (per_box_sft=22.22, pieces_per_box=12) — purchase 5 box → expect: stock.total_pieces +60, batch.total_pieces=60, stock_ledger row with `before/after_display='X Box (≈ Y SFT)'`।
  2. Sanitary product (pieces_per_box=1) — purchase 10 pcs → total_pieces +10।
  3. Backorder allocator অপরিবর্তিত — কোনো outstanding sale on backorder থাকলে fulfill হবে যথাবৎ।
- `bunx tsc --noEmit` ও backend `tsc` clean।

### F. Rollout

```bash
cd /var/www/tilessaas && git pull && cd backend && npm install && npm run build && pm2 restart tilessaas-backend && cd .. && npm install && npm run build
```

---

### Out of scope (পরবর্তী phase-এ)

- Sales POST/PUT/DELETE + FIFO RPC rewrite (2C)
- Returns + reservations + backorder allocator total_pieces switch (2D)
- SaleForm UI (Box + Pc + SFT) (2C)

---

বলুন **"start 2B-ii"** — আমি ব্যাকএন্ড রুট আপডেট, stock_ledger writer helper, এবং stock display surfaces এক টার্নে শেষ করে দেব।