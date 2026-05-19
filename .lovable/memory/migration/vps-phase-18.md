---
name: VPS Migration Phase 18
description: Asset Assignment Tracking — assets catalog + assign/return workflow with immutable history
type: feature
---

# Phase 18 — Asset Assignment Tracking

## Tables (migration 044_assets.ts)
- `assets` — tag (unique per dealer), name, category, serial_no, brand, model, purchase_date, purchase_cost, condition (new|good|fair|damaged|lost), status (available|assigned|retired|lost), assigned_to (FK employees, SET NULL), assigned_at
- `asset_assignments` — immutable history: asset_id, employee_id, assigned_date, returned_date, condition_at_assignment, condition_at_return, notes, created_by

## Backend (`/api/assets`)
- CRUD: GET/POST/PUT/DELETE (delete blocked while `status='assigned'`)
- `POST /:id/assign` — transactional: validates `status='available'`, inserts assignment row, flips asset to `assigned` with `assigned_to/assigned_at`
- `POST /:id/return` — closes open assignment row, sets `returned_date/condition_at_return`, asset → `available` (or `lost` if condition_at_return='lost'), clears assignment
- `GET /assignments/active` — joined view of currently-held assets

## Frontend
- `assetService.ts` (VPS only, `vpsAuthedFetch`)
- `AssetsPage.tsx` — 2-tab UI:
  - **Catalog**: status filter, search by tag/name/serial, summary cards (total / assigned / available / total cost), per-row Assign / Return / History / Edit / Delete actions
  - **Active Assignments**: condensed view of currently held assets with one-click return
- 3 dialogs: Add/Edit, Assign (employee + handover condition), Return (with optional "lost" flag), History (per-asset chronological)

## Wiring
- backend/src/index.ts → register `assetsRoutes` at `/api/assets`
- src/App.tsx → route `/hrm/assets`
- src/components/AppLayout.tsx → nav "Asset Management" (Laptop icon, dealer_admin only)

## Deploy
```bash
cd /var/www/tilessaas && git pull && \
cd /var/www/tilessaas/backend && npx knex migrate:latest --knexfile src/db/knexfile.ts && \
cd /var/www/tilessaas && npm install && npm run build && \
pm2 restart tilessaas-backend && sudo systemctl reload nginx
```
