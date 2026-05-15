## Goal

Tiles ক্রয় ও বিক্রয় উভয়ের সময় ব্যবহারকারী **SFT, Box, অথবা Box + অতিরিক্ত Piece** — যেকোন এককে এন্ট্রি দিতে পারবেন। সফটওয়্যার সব হিসাব করে স্টক দেখাবে: **X Box Y Pcs (≈ Z SFT)**।

এটি Phase 2B-এর tiles-নির্দিষ্ট সংস্করণ। শুধুমাত্র `category = Tiles` পণ্যের জন্য প্রযোজ্য; Sanitary পণ্য আগের মতই Pcs-এ চলবে।

---

## Foundation (ইতিমধ্যে আছে)

- `products.per_box_sft` — প্রতি বক্সে কত SFT (legacy column, tiles-এ বাধ্যতামূলক)
- `products.pieces_per_box` — প্রতি বক্সে কত pieces (Phase 1 / 2A)
- `purchase_items / sale_items / batches / stock` — সবগুলোতে `box_qty`, `piece_qty`, `total_pieces` কলাম আছে
- `dealers.dual_unit_enabled` toggle আছে
- `src/lib/areaCalculator.ts`, `tileRounding.ts` — SFT ↔ Box converter আছে

বাকি কাজ: form-এ unit selector, পেছনে total_pieces হিসাব, এবং stock display তিন এককে।

---

## Plan

### Step 1 — Tiles Purchase Form (SFT ভিত্তিক এন্ট্রি)

`src/modules/purchases/PurchaseForm.tsx` — tiles row-এ একটি **Entry Mode** selector যোগ করা হবে:

- **By SFT** — ব্যবহারকারী SFT লেখেন → auto round up করে boxes (next full box, `tileRounding.ts` দিয়ে) → `box_qty`, `piece_qty=0`, `total_pieces` হিসাব হয়
- **By Box** — শুধু box সংখ্যা
- **By Box + Pc** — box + আলাদা pieces (Phase 2A-র মতই)

Live preview দেখাবে: `5 Box = 111.10 SFT = 60 Pcs` (per_box_sft × box_qty)।

Rate field `৳/SFT` রাখা হবে (টাইলস ব্যবসার স্বাভাবিক ধরন)। Total = `final_sft × rate`।

Sanitary রো অপরিবর্তিত — শুধু Pcs।

### Step 2 — Tiles Sale Form (একই তিন মোড)

`src/modules/sales/SaleForm.tsx` — গ্রাহক চাইলে SFT-এ, Box-এ, বা Box + কয়েক Pc আলাদা — এই তিন মোডে বিক্রি। SFT মোডে `tileRounding` দিয়ে box-এ গোল করা হবে কিন্তু "Sell loose pieces" চেক করলে pieces আলাদাভাবে অনুমোদিত (যেমন 5 Box + 3 Pc)।

POS সেলেও একই UX।

### Step 3 — Backend: total_pieces canonical

Backend route ও service-এ ইতিমধ্যে `total_pieces` কলাম আছে কিন্তু পপুলেট হয় না। নিম্নলিখিতগুলোতে server-side compute যোগ করা হবে (frontend থেকে box_qty, piece_qty পাঠানো হবে; backend `pieces_per_box` lookup করে `total_pieces` লিখবে):

- `POST /api/purchases` → `purchase_items` + `product_batches` + `stock` সব total_pieces-এ
- `POST/PUT/DELETE /api/sales` → FIFO allocator total_pieces-এ
- Returns, reservations, backorders — একই

stock_ledger row প্রতিটি stock-পরিবর্তনে লেখা হবে (audit trail)।

### Step 4 — Stock Display: Box + Pcs + SFT

একটি reusable `<TileStockBadge total_pieces={..} pieces_per_box={..} per_box_sft={..} />` কম্পোনেন্ট:

```
12 Box 3 Pc  (≈ 268.89 SFT)
```

প্রয়োগ হবে: Stock list, Product detail, Sale form availability, Purchase form current stock, Dashboard low-stock, Reports।

Sanitary product হলে শুধু `15 Pc` দেখাবে (SFT অংশ বাদ)।

### Step 5 — Guardrails

- Tile product save করার সময় `per_box_sft > 0` ও `pieces_per_box > 0` বাধ্যতামূলক
- `dual_unit_enabled = false` ডিলারের জন্য পুরাতন single-quantity UI কাজ করতে থাকবে (regression-free)
- Migration আগে থেকেই deployed; নতুন কোন schema change নেই

---

## Technical notes

- Helper: `boxesToPieces(box, pc, ppb) = box*ppb + pc` and `piecesToSft(pieces, ppb, perBoxSft) = pieces / ppb * perBoxSft`
- Rounding: `tileRounding.ts` already returns next-full-box for an SFT input
- API contract change: clients send `{ box_qty, piece_qty, entry_mode, sft_input? }`; legacy `quantity` field still accepted for non-tile and non-dual-unit dealers (backward compat)
- All FIFO RPCs (`allocate_sale_batches`, `restore_sale_batches`, `create_stock_reservation`) need rewrite to operate on `total_pieces` — this is the highest-risk piece, will be done in a transaction with full test on demo dealer first
- Reports module touched: Stock report, Sales report — column changes only, math unchanged

---

## Suggested execution order

1. **2B-i** Step 1 + Step 4 (read-only) — Purchase by SFT + new stock display. Lowest risk, immediately useful.
2. **2B-ii** Step 3 backend writes (purchases path) + stock_ledger.
3. **2C** Step 2 + Step 3 sales path + FIFO RPC rewrite.
4. **2D** Returns + reservations + backorders.

প্রতিটি sub-step আলাদা approval নিয়ে করব। আজ শুরু করব **2B-i** দিয়ে?