---
name: VPS Phase 10 — Salary Structure
description: salary_components library + employee assignments with allowance/deduction breakdown preview; UI at /hrm/salary-structure
type: feature
---
Migration 038 created `salary_components` (dealer-level library: code, name, kind allowance|deduction, calc fixed|percent_basic, default_amount, default_percent, is_taxable, active) and `employee_salary_components` (per-employee overrides for amount/percent + active flag).

Backend `/api/salary-components` provides full CRUD on the library plus `/employee/:employeeId` for assignments and `/preview/:employeeId?basic=` returning gross/net breakdown with each line.

Frontend `src/pages/hrm/SalaryStructurePage.tsx` exposes two tabs (Components / Employee Assignments) with live basic-salary preview card. Route `/hrm/salary-structure` + sidebar (Wallet icon, dealer_admin only).

Payroll integration (auto-apply allowances/deductions in salary payment endpoint) deferred to a later phase to avoid regression.
