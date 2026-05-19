---
name: VPS Migration Phase 15
description: Shift-based attendance integration — auto-fill status from check-in time using assigned shift
type: feature
---

# Phase 15 — Shift-Aware Attendance

Wired Phase 14's `shifts` table into the Attendance UI (`HRMPage.tsx`).

## Frontend changes
- **`employeeService.Employee`**: added `shift_id?: string | null`.
- **`HRMPage.tsx`**:
  - Loads `shiftService.list()` and exposes a shift selector column in the Employees table → calls `employeeService.update({ shift_id })` to assign/unassign.
  - Attendance tab:
    - New **Shift** column showing assigned shift + start time.
    - Per-row **check-in time** input + wand button → `shiftService.evaluate(shift_id, check_in, att_date)` → sets `bulkStatus` to `suggested_status` (present/late/half/absent).
    - Header gets a **Default Check-in** time + **Auto-fill All** button that batch-evaluates every active employee with a shift, using per-row check-in if set else default.
    - Status pill column unchanged; user can still override before **Save Marks** which calls existing `bulkAttendance`.

## Backend
No backend changes — reuses `/api/shifts/evaluate` from Phase 14 and `PUT /api/employees/:id` (already accepts `shift_id`).

## Deployment
Frontend-only — no migration needed:
```bash
cd /var/www/tilessaas && git pull && \
cd /var/www/tilessaas && npm install && npm run build && \
sudo systemctl reload nginx
```
