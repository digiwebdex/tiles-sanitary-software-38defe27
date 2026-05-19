---
name: VPS Migration Phase 14
description: Shift Management — per-dealer shift templates with timing, grace, half-day threshold, working days, and employees.shift_id assignment
type: feature
---
Phase 14: shifts table (migration 041) with code, name, start_time, end_time, grace_minutes, half_day_after_minutes, working_days (CSV 0=Sun..6=Sat, default '0,1,2,3,4,6' = Sun-Thu+Sat), color, is_active. employees.shift_id FK added (SET NULL on delete).
Backend: /api/shifts CRUD + POST /api/shifts/evaluate returns {is_working_day, on_time, minutes_late, suggested_status} for a given shift_id + check_in HH:MM (used by attendance UI to auto-suggest present/late/half/absent).
EmployeeSchema accepts shift_id.
Frontend: /hrm/shifts page with table + dialog editor (weekday toggle buttons, time inputs, grace/half-day numerics, color picker). Sidebar link added.
