## Bangla ERP ভিডিও বনাম TilesERP — Feature Gap Analysis

আপনার রেফারেন্স ভিডিওর প্রতিটি ফিচার আমি বর্তমান TilesERP-এর সাথে মিলিয়ে দেখেছি। নিচে কী আছে এবং কী যোগ করা দরকার তার পরিষ্কার তালিকা দিলাম।

---

### ✅ ইতোমধ্যে আছে (Already Implemented)

| Bangla ERP Feature | TilesERP Equivalent |
|---|---|
| Login / Module navigation | Auth + Sidebar modules |
| Item Group / Brand / Item create | Products module (group, brand, SKU) |
| Box / SFT / Piece units + Tile size + pcs/box | `src/lib/units.ts`, ProductForm |
| Stock alert level | Low Stock Alerts (2× reorder buffer) |
| Supplier register + statement | Suppliers module + Ledger |
| Purchase Entry (multi-unit, discount, partial pay) | PurchaseForm + landed cost |
| Purchase / Sales / Stock reports (SFT+pcs+box) | Reports module (10+ reports) |
| Customer register + CRM | Customers module |
| Sales Entry / Quick Sale / POS | SaleForm + POSSalePage |
| Cash & Credit sale, partial payment | Sales + Collections |
| Invoice & Challan print | InvoicePage, ChallanPage |
| Sales / Purchase return | sales-returns, purchase-returns modules |
| Customer statement + Due Receipt (DUCR) | Ledger + CollectionTracker |
| Profit per sale (FIFO) | salesService FIFO breakdown |
| Expense entry | Expenses route + service |
| Cancelled invoice tracking | Sales cancel flow + audit log |
| EMI / Wholesale price | Pricing Tiers module |
| SMS notification | BulkSMSBD integration |
| Backup | Automated GDrive backup |

---

### ❌ অনুপস্থিত — যোগ করা প্রয়োজন (Missing Features)

নিচের ৭টি বড় গ্যাপ পেয়েছি। ভিডিওতে যেগুলো আছে কিন্তু আমাদের সিস্টেমে নেই:

#### 1. HRM Module (কর্মচারী ও বেতন)
- Employee Register (নাম, পদ, যোগদান তারিখ, ফোন, NID)
- Employee Salary Setup — Basic + House Rent % + Medical % + Transport % auto-calc
- Monthly Salary Disbursement (all/selected employees)
- Salary voucher + Accounts-এ auto-posting (cash কমে যাবে)
- Employee-wise salary history report

#### 2. Director / Investor Module
- Director Register (নাম, ফোন, ঠিকানা, share %)
- "Director Deposit Receive" transaction type → cashbook auto-update
- Director Withdrawal transaction
- Director-wise investment statement
- Owner's Equity রিপোর্টে ব্যবহার

#### 3. Warehouse / Godown Management (Multi-location stock)
- Warehouse Register (store name, manager, phone, address, opening date)
- Warehouse In-Out (showroom ↔ godown stock transfer)
- Transfer cost as expense
- Warehouse-wise stock report
- In-Out transaction history

#### 4. Consolidated Cashbook View
- একটি unified Cashbook page যেখানে সব cash in/out একসাথে: Director deposit, purchase payment, supplier bill, customer collection, sales receipt, expense, salary
- Date-range filter, opening/closing balance
- Print + Excel export

#### 5. Multi-Bank Account Management
- Bank Account Register (bank name, account no, branch, opening balance)
- প্রতিটি payment-এ "Cash" বা নির্দিষ্ট "Bank Account" select
- Bank-wise transaction ledger ও balance
- Bank statement print

#### 6. Financial Statements (Accounting Reports)
- **Income Statement** — মোট sales income vs total expense, period-filtered
- **Profit & Loss Statement** — Gross profit, operating expense, net profit, print-ready format
- **Balance Sheet** — Assets (cash, bank, stock value, receivables) vs Liabilities (payables, owner equity, retained earnings)
- বর্তমানে শুধু `AccountingSummary` আছে; formal P&L / Balance Sheet নেই

#### 7. Tile Auto-Rounding to Full Tiles (Quality-of-life)
- ভিডিওতে: 200 SFT লিখলে সিস্টেম auto round করে 222.22 SFT (full tile boundary)
- বর্তমানে SaleForm/PurchaseForm-এ manual; auto-round option toggle যোগ করা যেতে পারে

---

### 🟡 আংশিক আছে (Partial — Optional Enhancement)

- **Account Transaction unified screen** — ভিডিওতে এক ড্রপডাউন থেকে "Director Deposit / Supplier Payment / Customer Collection / Expense" সব select করা যায়। আমাদের separate page আছে; চাইলে একটা unified "Account Transaction" entry page বানানো যায়।
- **Voucher print** — Supplier bill payment, salary payment ইত্যাদির আলাদা voucher print

---

### Implementation Priority (আমার সুপারিশ)

| Priority | Feature | Effort | Business Impact |
|---|---|---|---|
| 🔴 High | Financial Statements (P&L + Balance Sheet) | Medium | High — accounting/audit |
| 🔴 High | Multi-Bank Account | Medium | High — সব dealer-এর দরকার |
| 🔴 High | Consolidated Cashbook | Small | High — daily use |
| 🟠 Med | HRM (Employee + Salary) | Large | Medium — সব dealer চায় না |
| 🟠 Med | Warehouse / Godown | Large | Medium — বড় dealer-এর জন্য |
| 🟡 Low | Director / Investor module | Small | Low — অনেকে spreadsheet-এ রাখে |
| 🟡 Low | Tile auto-round toggle | Small | Low — convenience |

---

### আপনার সিদ্ধান্ত দরকার

আমি কোনগুলো এখনই বানানো শুরু করব? অনুগ্রহ করে confirm করুন:

1. **সবগুলো একসাথে** (বড় work, কয়েকটি phase-এ deliver হবে)
2. **শুধু High-priority ৩টি** (Financial Statements + Multi-Bank + Cashbook)
3. **আপনি custom select করবেন** — কোন কোন feature আগে চাই বলুন
4. **শুধু analysis দরকার ছিল**, এখনই কিছু বানাতে হবে না

আপনার উত্তর পেলে আমি প্রতিটি selected feature-এর জন্য detailed technical plan (DB migration + API + UI) আলাদা করে তৈরি করব।
