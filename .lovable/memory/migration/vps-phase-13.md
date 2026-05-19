---
name: VPS Migration Phase 13
description: Employee Documents — per-employee files with type, doc number, issue/expiry tracking, and 30-day expiry alerts
type: feature
---
Phase 13: employee_documents table (migration 040) with doc_type (nid/passport/contract/certificate/license/photo/other), title, doc_number, file_url, issue_date, expiry_date, notes; tenant-scoped via dealer_id.
Backend: /api/employee-documents CRUD + /expiring/list?days=N feed.
Frontend: /hrm/documents page with All Documents tab (filter by employee) and Expiring Soon tab (30-day window with red/yellow/green badges). Sidebar link added under HRM.
