---
name: VPS Phase 12 — Payslip View
description: Printable payslip page with full component breakdown from Phase 11 snapshot
type: feature
---
Backend `GET /api/employees/salary-payments/:id` returns the salary payment joined with employee + bank account info. Frontend route `/hrm/payslip/:id` renders a printable Tailwind payslip that splits earnings (basic, house rent, medical, transport, other allowance, plus all allowance lines from `components_snapshot`) from deductions (component deductions + advances/other), computes Gross, and highlights Net Payable. `window.print()` triggers a print-friendly layout (`print:` utilities, header chrome hidden, card shadow stripped). A `FileText` icon button in HRM → Salary Disbursements opens each row's payslip.
