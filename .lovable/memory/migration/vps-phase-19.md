---
name: VPS Migration Phase 19
description: Employee Loan & EMI Tracker — multi-installment loans with auto-generated schedule, partial payments, waive, and salary-deduction linkage
type: feature
---

# Phase 19 — Employee Loan & EMI Tracker

## Tables (migration 045_employee_loans.ts)
- `employee_loans` — loan_code (`LN-YYYY-####`, unique per dealer), principal, tenure_months, emi_amount, issue_date, first_emi_date, payment_method (cash|bank), bank_account_id (FK), status (active|closed|cancelled), reason, notes
- `employee_loan_emis` — installment_no (unique per loan), due_date, amount_due, amount_paid, paid_date, status (pending|partial|paid|waived), payment_source (salary_deduction|manual|cash|bank), reference (e.g. salary period YYYY-MM)

## Backend (`/api/employee-loans`)
- `GET /summary` — outstanding, due_this_month, overdue_amount + count, active_loans
- `GET /employee/:employeeId/outstanding` — per-employee total (useful for salary processing integration)
- `GET /` `?employee_id=&status=` — list with paid_total + balance via subquery aggregation
- `GET /:id` — loan + full schedule
- `POST /` — atomic: validates active employee, generates EMI schedule (final installment absorbs rounding), auto-generates loan_code
- `POST /:id/cancel` — blocked once any EMI is paid/partial; waives all installments
- `POST /:id/close` — manual close, waives remaining
- `POST /emis/:emiId/pay` — atomic partial/full payment; auto-closes loan when no pending/partial EMIs remain
- `POST /emis/:emiId/waive` — write off single installment; auto-closes loan if last

## Frontend
- `employeeLoanService.ts` (VPS only)
- `EmployeeLoansPage.tsx`:
  - 5-card summary (Outstanding, Due This Month, Overdue ৳ + count, Active Loans, Active Employees)
  - Status + employee filters
  - Loans table with code, principal, EMI, paid, balance, status
  - **New Loan dialog**: live EMI calculator, bank-account picker for bank disbursement
  - **Detail dialog**: schedule grid with overdue highlight (rose tint), per-row Pay/Waive actions
  - **Pay dialog**: partial payment support with source enum (salary_deduction maps to payroll integration)
  - Cancel (only if no payments) vs Close (waives remaining) actions

## Wiring
- backend/src/index.ts → `/api/employee-loans`
- src/App.tsx → `/hrm/loans`
- src/components/AppLayout.tsx → nav "Employee Loans" (BadgeDollarSign icon, dealer_admin only)

## Future integration
- Payroll engine can call `employeeOutstanding()` to auto-deduct EMI from salary, then `payEmi()` with `payment_source: "salary_deduction"` and `reference: period`.

## Deploy
```bash
cd /var/www/tilessaas && git pull && \
cd /var/www/tilessaas/backend && npx knex migrate:latest --knexfile src/db/knexfile.ts && \
cd /var/www/tilessaas && npm install && npm run build && \
pm2 restart tilessaas-backend && sudo systemctl reload nginx
```
