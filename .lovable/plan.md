# Role Management System

## Goal

Add a dealer-facing **Role Management** page modelled on the reference screenshot:
- Header cards for each role with live counts and description.
- Tabs: **Team Members** (searchable list with Status / Joined / Actions) and **Permission Matrix** (read-only grid).
- Dealer admin can invite, edit, deactivate, and reassign team members.

## Important constraint

The existing system has only three database roles baked into the `app_role` enum:
`super_admin`, `dealer_admin`, `salesman`. All RLS policies, backend middleware, and `usePermissions` rely on these. Inventing brand-new DB roles would touch every route.

To stay safe, we add **two new roles to the enum** that map cleanly to the dealer's day-to-day team, instead of the 5 generic roles in the screenshot (which are travel-agency specific):

| Role key (DB)      | Display label   | Description                                                        |
|--------------------|-----------------|--------------------------------------------------------------------|
| `dealer_admin`     | Owner           | Full access. Manages team, subscription, and all modules.          |
| `manager` *(new)*  | Manager         | All operational modules (sales, purchase, inventory, reports). No team / billing. |
| `accountant` *(new)* | Accountant    | Ledgers, collections, expenses, financial reports. Read-only on inventory. |
| `salesman`         | Sales Agent     | Insert-only on sales / quotations / customers (existing behaviour). |

Five role categories total (matching the screenshot's visual density), but mapped to permissions we can actually enforce today.

## Scope

### Backend
1. **Migration `016_role_management.ts`**
   - `ALTER TYPE app_role ADD VALUE 'manager'; ADD VALUE 'accountant';`
   - Add `invited_at`, `last_login_at` to `profiles` (nullable).
2. **New routes `/api/team`** (dealer_admin only, tenant-scoped)
   - `GET /api/team` — list profiles + their primary role + status + joined date + counts per role.
   - `POST /api/team` — invite member (creates auth user via existing `create-dealer-user` flow + assigns role).
   - `PUT /api/team/:userId` — change role / status / name.
   - `DELETE /api/team/:userId` — soft-deactivate (sets `status = 'inactive'`, never hard-deletes).
3. **`requireRole` middleware** updated to recognise `manager` and `accountant` where appropriate (e.g. allow `manager` on most write routes, `accountant` on ledger reads).

### Frontend
1. **`src/pages/settings/RoleManagementPage.tsx`** at route `/settings/roles`
   - Top header with role-count cards (one per role).
   - `Tabs`: **Team Members** and **Permission Matrix**.
   - Team Members table: name, email, role badge, status badge, joined, actions (view / edit).
   - Search box + "All Roles" filter dropdown.
   - "Invite Member" button → dialog with name, email, role, temp password.
2. **`src/components/team/InviteMemberDialog.tsx`** + **`EditMemberDialog.tsx`**
3. **`src/components/team/PermissionMatrix.tsx`** — static read-only grid built from a single `ROLE_PERMISSIONS` constant so it can never drift from `usePermissions`.
4. **`src/services/teamService.ts`** — thin VPS API wrapper.
5. **`usePermissions` extension** — recognise `manager` and `accountant`; map them to existing capability flags. Salesman behaviour unchanged.
6. **Settings page** — add a "Role Management" card linking to `/settings/roles`.
7. **Sidebar** — add "Roles" link in the dealer-admin navigation group.

### Out of scope
- No granular per-permission toggles (the matrix is read-only). A future v2 can add a `dealer_role_overrides` table.
- Existing `super_admin` flow is untouched.
- Portal users are not part of this page (separate system).

## Files

```text
backend/src/db/migrations/016_role_management.ts            (new)
backend/src/routes/team.ts                                   (new)
backend/src/index.ts                                         (register route)
backend/src/middleware/roles.ts                              (recognise new roles)
src/pages/settings/RoleManagementPage.tsx                    (new)
src/components/team/InviteMemberDialog.tsx                   (new)
src/components/team/EditMemberDialog.tsx                     (new)
src/components/team/PermissionMatrix.tsx                     (new)
src/services/teamService.ts                                  (new)
src/hooks/usePermissions.ts                                  (add manager/accountant)
src/pages/settings/SettingsPage.tsx                          (add card)
src/components/AppLayout.tsx                                 (sidebar link)
src/App.tsx                                                  (route)
```

## Deployment

Standard one-liner runs the new migration (`016_role_management.ts`) and rebuilds the frontend automatically — no extra steps.

## Open questions

1. Should **Manager** be allowed to delete records, or only edit? (default: edit only, no delete)
2. Should **Accountant** see cost prices? (default: yes — they need it for margin reports)
3. Do you want email invitations to new members, or just create the account and share the temp password manually? (default: temp password, matches current `create-dealer-user` flow)

Reply "go" to implement with the defaults above, or tell me what to change.
