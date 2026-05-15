## Phase 2C — Sales path: Box+Pc+SFT input, `total_pieces` writes, stock_ledger audit

লক্ষ্য: Purchase-এর পর এখন Sale path-কেও dual-unit (Box + Piece + SFT) করতে হবে।
- Salesman একই টাইল বিক্রিতে box ও extra pieces (যেমন `5 box + 3 pcs`) বা শুধু SFT দিয়ে quantity দিতে পারবে।
- Backend FIFO/legacy দুই পথেই `total_pieces` সঠিকভাবে ডিডাক্ট হবে এবং প্রতি item-এ `stock_ledger` audit row লেখা হবে।
- Cancel/Edit-এ symmetric restore হবে (RPC ইতিমধ্যে updated — ২B-শেষে migration গেছে)।

Out of scope (পরবর্তী 2D-তে): Sales return restocking, reservations consumption display, Challan/Delivery item totals — পৃথক phase-এ।

---

### A. Schema check (no migration আশা করি)

`sale_items` টেবিলে `box_qty`, `piece_qty`, `total_pieces` কলাম migration 018 দিয়ে আগেই যোগ হয়েছে — verify করব। যদি না থাকে, ছোট migration যোগ করব (additive only)।

### B. Frontend — `src/modules/sales/saleSchema.ts`

`saleItemSchema` এ পরিবর্তন:
- `quantity` field-কে computed হিসেবে রাখব (legacy backend compat)
- নতুন fields: `box_qty` (≥0), `piece_qty` (≥0), `entry_mode: 'box_piece' | 'sft'`
- Validation: `box_qty + piece_qty > 0` অথবা SFT-mode-এ `quantity > 0`
- Tile (box_sft + ppb>1): UI দেখাবে Box + Pc inputs পাশাপাশি SFT preview
- Sanitary (piece): শুধু Pc input
- Tile কিন্তু SFT-mode toggle: শুধু SFT input → backend-এর জন্য box_qty = floor(sft / per_box_sft), piece_qty = round((sft % per_box_sft)/per_box_sft * ppb)

### C. Frontend — `src/modules/sales/SaleForm.tsx`

প্রতি sale item row-এ:
- ছোট segmented toggle: **Box+Pc** | **SFT** (শুধু tile-এ visible)
- Box+Pc মোডে দুটো numeric input + below: `≈ X.XX SFT` preview
- SFT মোডে একটিই input + below: `≈ A box B pcs` preview
- Stock availability hint `<TileStockBadge>` দিয়ে — `Available: 7 box 9 pcs (≈ 169.4 SFT)`
- Submit-এ `quantity` field auto-compute করব (box-unit products: `box_qty + piece_qty/ppb` decimal; piece products: `piece_qty`) — backend backward-compat বজায় থাকবে।

### D. Backend — `POST /api/sales`

`backend/src/routes/sales.ts` (lines ~290-650):
1. `sale_items` schema — accept optional `box_qty`, `piece_qty`. যদি না আসে, legacy `quantity` থেকে derive (tile: `box=floor(q)`, `piece=round((q - floor(q)) * ppb)`; piece: `piece=q`)।
2. Item resolution-এ `pieces_per_box` লোড (আগের মতই)। Compute `totalPieces = box_qty * ppb + piece_qty`।
3. Stock check — `stock_before_pieces = stock.total_pieces - reserved_total_pieces`। Shortage display `formatBoxPiece` দিয়ে।
4. `sale_items` insert-এ `box_qty`, `piece_qty`, `total_pieces` লিখব।
5. FIFO RPC (`allocate_sale_batches`) — RPC ইতিমধ্যে total_pieces সামলায়, কিন্তু allocation `quantity` (box বা pcs single number) input নেয়। Mixed box+piece tile sale-এর জন্য আমরা allocator-কে **decimal box-equivalent** পাঠাব (`box_qty + piece_qty/ppb`)। RPC-এর math: `delta_pieces = qty * ppb` সঠিকই থাকে। কিন্তু `box_qty`/`sft_qty` decimal হয়ে যাবে — ঠিক আছে কারণ `total_pieces` source of truth। Display alternative: ভবিষ্যতে allocator-কে `total_pieces` accept করতে rewrite, এই phase-এ scope বাইরে।
6. Legacy `deduct_stock_unbatched` — same decimal trick।
7. **stock_ledger insert** প্রতি item-এ:
   - `txn_type='sale_out'`, `reference_table='sales'`, `reference_id=sale.id`, `reference_no=invoice_number`
   - `box_qty`, `piece_qty`, `pieces_per_box`, `total_pieces` (negative direction handled by sign)
   - `stock_before_pieces`/`stock_after_pieces`/`_display`

### E. Backend — `PUT /api/sales/:id` ও `DELETE /api/sales/:id` (cancel)

Same dual-unit handling। RPC `restore_sale_batches` (already total_pieces-aware) ব্যবহার করব। Re-deduct path-এ একই box+piece input নেব।

### F. Service — `src/services/salesService.ts`

`SaleItemInput`-এ optional `box_qty`, `piece_qty` যোগ করব। Frontend-from-form mapper এই fields পাঠাবে।

### G. Test plan

1. Tile (ppb=12, per_box_sft=22.22) sale: `4 box + 5 pcs` → expected `total_pieces=53`, FIFO কনজিউম 53 pcs, ledger row `before=600 after=547`।
2. SFT-mode sale: enter `120 SFT` → derive `5 box 5 pcs` (≈111.1 + 9.26 = 120.36) — round-down নাকি best-fit? Decision: floor SFT→box, residue→pcs (floor)। Preview UI-তে `≈ X SFT (back to Y SFT after rounding)` দেখাব। User কে confirm দিতে দেব।
3. Sanitary 10 pcs sale → unchanged behavior।
4. Edit সেল `4 box + 5 pcs` → `6 box + 0 pcs`: restore + re-deduct সঠিক।
5. Cancel: restore সঠিক, ledger reverse rows।

### H. Out of scope explicitly

- Sales-return restocking with box+pc (next phase 2D)
- Reservation create/consume Box+Pc UI (2D)
- POS quick-sale page (separate)
- Challan delivery line totals (2D)

### I. Rollout

```
cd /var/www/tilessaas && git pull && cd backend && npm install && npm run build \
  && pm2 restart tilessaas-backend && cd .. && npm install && npm run build
```

---

Approve বললেই 2C শুরু করব — order: schema verify → schema/types → backend POST → backend PUT/DELETE → SaleForm UI → manual test।