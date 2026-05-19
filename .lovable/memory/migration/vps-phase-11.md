---
name: VPS Phase 11 — Payroll Integration
description: Salary payments auto-apply assigned salary_components (allowances/deductions) with persisted snapshot
type: feature
---
Migration 039 extends `salary_payments` with `components_allowance` (decimal), `components_deduction` (decimal), and `components_snapshot` (jsonb of `[{component_id,code,name,kind,amount}]`).

`POST /api/employees/:id/salary-payments` now accepts `apply_components` (default `true`). When true it joins `employee_salary_components` with active `salary_components`, evaluates each line (`fixed` → override?.amount ?? default_amount; `percent_basic` → basic × override?.percent ?? default_percent / 100), then folds the totals into the gross/deduction sides before computing `net_payable`. The line-by-line snapshot is persisted on the payment row for audit + reprint.

Salary advance auto-settle behaviour is unchanged. Frontend payroll forms can pass `apply_components:false` to opt out for one-off manual disbursements.
