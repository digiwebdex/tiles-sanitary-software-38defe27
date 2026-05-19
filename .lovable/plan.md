## Screenshot vs TilesERP — Feature Comparison

Screenshot-এ মোট ৭টি section ও ~৫০টি module আছে। আপনার software-এ কী আছে আর কী নেই:

---

### ✅ Customer & CRM (৮টির মধ্যে ৩টি আছে)
| Module | Status |
|---|---|
| Customer Opening | ✅ আছে (Customer form-এ opening balance) |
| Customer List | ✅ আছে (`/customers`) |
| Customer Statement | ✅ আছে (Customer Statement report) |
| Manage Leads | ❌ নাই |
| Leads Visiting | ❌ নাই |
| Customer Register | ❌ নাই (আলাদা register নেই) |
| Lead Register | ❌ নাই |
| Visiting Register | ❌ নাই |

---

### ✅ Accounts (৮টির মধ্যে ৬টি আছে)
| Module | Status |
|---|---|
| Account Transaction | ✅ আছে (Ledger) |
| Ledger Transaction | ✅ আছে (`/ledger`) |
| Cash & Bank Book | ✅ আছে (Cashbook + Bank Accounts) |
| Receipt & Payment | ✅ আছে (Collections + Payments) |
| Income & Expenses | ✅ আছে (Financials + Expenses) |
| Trial Balance | ✅ আছে (Financial Statements-এ) |
| Fund Transfer Request | ❌ নাই |
| Product Sending Request | ❌ নাই |

---

### ✅ Purchase (৮টির মধ্যে ৭টি আছে)
| Module | Status |
|---|---|
| Purchase Entry | ✅ আছে |
| Purchase List | ✅ আছে |
| Purchase Report | ✅ আছে |
| In/Out Report | ✅ আছে (Stock movement) |
| Warehouse Report | ✅ আছে (Warehouses) |
| Stock Report | ✅ আছে |
| Purchase Return | ✅ আছে |
| Warehouse In/Out | ⚠️ আংশিক (transfer module নাই) |

---

### ✅ Sales (৮টির মধ্যে ৮টি আছে)
| Module | Status |
|---|---|
| Sales Entry | ✅ আছে |
| POS Sales | ✅ আছে |
| Quick Sales | ✅ আছে (POS) |
| Sales Return | ✅ আছে |
| Create New Order | ✅ আছে (Quotations/Challan) |
| Daily Order | ✅ আছে (Dashboard) |
| Delivered Orders | ✅ আছে (Deliveries) |
| Sales Report | ✅ আছে |

---

### ⚠️ HRM (৭টির মধ্যে ৩টি আছে)
| Module | Status |
|---|---|
| Employee Register | ✅ আছে (HRM Page) |
| Salary Disbursement | ✅ আছে |
| Salary Disb. List | ✅ আছে |
| Start Time | ❌ নাই (attendance check-in) |
| End Time | ❌ নাই (attendance check-out) |
| Daily Att. Report | ❌ নাই |
| Emp. Disb. List | ⚠️ আংশিক |
| My Payslip | ❌ নাই (employee self-service portal) |

---

### ⚠️ SMS & Notification (৩টির মধ্যে ১টি আছে)
| Module | Status |
|---|---|
| SMS Sent History | ✅ আছে (Notification logs) |
| Single SMS Sent | ❌ নাই (manual SMS sender) |
| EMI Alert SMS Setup | ❌ নাই |

---

### ✅ Settings (৫টির মধ্যে ৪টি আছে)
| Module | Status |
|---|---|
| Employee Register | ✅ আছে |
| Director Register | ✅ আছে |
| Closing Business Day | ✅ আছে (Cash Closing) |
| File Manager | ❌ নাই |
| Manage Holiday Setup | ❌ নাই |

---

## Summary

- **মোট মিলেছে:** ~৩২/৫০ (64%)
- **মূল ERP (Purchase, Sales, Accounts, Stock):** প্রায় ১০০% কভার ✅
- **মিসিং features:**
  1. **CRM / Leads Management** (Lead, Visiting, Register) — ৫টি
  2. **HR Attendance** (Start/End Time, Daily Attendance Report, Payslip portal) — ৪টি
  3. **Fund Transfer & Product Sending Request** workflow — ২টি
  4. **File Manager** — ১টি
  5. **Holiday Setup** — ১টি
  6. **Single SMS / EMI Alert SMS** — ২টি

---

## পরবর্তী ধাপ

কোন missing module-গুলো add করতে চান, জানান। আমার suggestion priority অনুযায়ী:

1. **Leads Management** (CRM expansion) — sales pipeline-এর জন্য গুরুত্বপূর্ণ
2. **Attendance (Start/End Time + Daily Report)** — HRM complete করার জন্য
3. **Holiday Setup** — payroll-এর সাথে integrate হবে
4. **Single SMS Sender** — manual reminder পাঠানোর জন্য
5. **File Manager** — document storage
6. **Fund Transfer Request / Product Sending Request** — multi-branch workflow

কোনগুলো আগে চান বলুন, সেগুলোর জন্য detailed implementation plan দিব।
