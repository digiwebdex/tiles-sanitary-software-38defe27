---
name: VPS Migration Phase 16
description: Performance Reviews & KPIs — weighted KPI scoring with grades and finalization
type: feature
---

# Phase 16 — Performance Reviews & KPIs

## Database
Migration `042_performance_reviews.ts`:
- `performance_reviews` — header per (dealer, employee, period): reviewer, overall_rating (0–100), grade (A+/A/B/C/D/F), strengths, improvements, comments, status (draft|finalized). Unique on (dealer, employee, period).
- `performance_kpis` — line items per review: kpi_name, weight%, target, achieved, score (0–100), notes.

## Backend `/api/performance` (`backend/src/routes/performance.ts`)
- `GET /` list (filter `period`, `employee_id`) joined with employee name.
- `GET /:id` full review with KPIs.
- `POST /` create (optional seed KPIs); dedupes on unique constraint with 409.
- `PUT /:id` header text/reviewer.
- `DELETE /:id` cascade removes KPIs.
- `POST /:id/kpis`, `PUT /kpis/:kpiId`, `DELETE /kpis/:kpiId` — KPI CRUD; each mutation calls `recomputeOverall()` (weighted avg by KPI weight, then grade).
- `POST /:id/finalize` — recompute + mark `status=finalized`.

All write endpoints require `dealer_admin` or `manager`. Tenant scoped by `req.user.dealerId`.

## Frontend
- `src/services/performanceService.ts` — typed client + `gradeBadgeVariant()` helper.
- `src/pages/hrm/PerformanceReviewsPage.tsx`:
  - "All Reviews" table with period / employee filters, grade badges.
  - New Review dialog seeds 4 default KPIs (Sales 40%, CSAT 20%, Attendance 20%, Teamwork 20%).
  - Detail dialog: inline-edit text areas and KPI grid with on-blur autosave (each save recomputes overall). "Recompute & Finalize" button locks the review.
- Route `/hrm/performance` registered in `App.tsx`; nav entry "Performance Reviews" (Award icon, `dealerAdminOnly`) added to `AppLayout.tsx`.

## VPS Deployment
```bash
cd /var/www/tilessaas && git pull && \
cd /var/www/tilessaas/backend && npx knex migrate:latest --knexfile src/db/knexfile.ts && \
cd /var/www/tilessaas && npm install && npm run build && \
pm2 restart tilessaas-backend && sudo systemctl reload nginx
```
