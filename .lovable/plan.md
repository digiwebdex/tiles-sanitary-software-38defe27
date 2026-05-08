# Dealer Subscription Page

Add a dealer-facing **Subscription** page (like the first reference image) so a dealer admin can see the software plan they're on, what other plans are available, and request upgrades / view past payments.

## What the page shows

1. **Current Plan card**
   - Plan name (Basic/Pro/Business/Custom)
   - Status badge: Active / Expiring Soon / Grace / Expired / Suspended
   - Expiry date + days remaining
   - Billing cycle (Monthly / Yearly)

2. **Plan comparison grid** (4 cards, like the reference)
   - Pulls active plans from `plans` table
   - Shows monthly price in BDT (৳) with `/মাস` suffix
   - Highlights the dealer's current plan with a "Current" ribbon
   - Marks the most popular plan ("Most Popular") and the highest tier ("Best Value") via `sort_order`
   - Feature checklist per plan: max users, SMS, Email, Daily Summary, plus any plan-level features
   - Button states:
     - Current plan → disabled "Current Plan"
     - Other plans → "Select [Plan]" → opens an upgrade-request dialog (creates a record super admin sees in `SADealerPaymentsPage`); top tier shows "Contact Sales" with the support number `01674533303`

3. **Payment Requests / History section**
   - Lists this dealer's `subscription_payments` rows (date, amount, method, status, note)

## Backend (new dealer-scoped endpoints)

New router file `backend/src/routes/dealerSubscription.ts` mounted at `/api/dealer/subscription`, protected by `authenticate + requireRole('dealer_admin')` and scoped by `req.dealerId`:

- `GET /current` → dealer's active subscription joined with plan
- `GET /plans` → all `is_active = true` plans (id, name, price_monthly, price_yearly, max_users, sms/email/daily_summary flags, sort_order)
- `GET /payments` → `subscription_payments` for `req.dealerId`, newest first
- `POST /upgrade-request` → inserts into existing `subscription_payments` (or new `subscription_upgrade_requests`) with `payment_status = 'pending'` and target plan id, so super admin can review in their existing payments page

No DB migration needed if we reuse `subscription_payments` with a `requested_plan_id` column — if that column doesn't exist we'll add it via a new migration `015_subscription_upgrade_request.ts`.

## Frontend

- New page `src/pages/subscription/SubscriptionPage.tsx`
- New service `src/services/dealerSubscriptionService.ts` calling the four endpoints above via `vpsAuthedFetch`
- New components:
  - `CurrentPlanCard.tsx` (status badge + expiry)
  - `PlanCard.tsx` (single plan card, used in the 4-up grid)
  - `UpgradeRequestDialog.tsx` (billing cycle, note, submit)
- Route added to `src/App.tsx`: `/subscription` inside the protected dealer layout
- Sidebar entry added to `src/components/AppLayout.tsx` under Settings:
  `{ path: "/subscription", label: "Subscription", icon: Crown, dealerAdminOnly: true, readonlyAllowed: true }`
- Salesman role: hidden (financial info, dealer_admin only)
- Demo dealer (`is_demo`): page visible read-only, upgrade button disabled with tooltip "Demo account"

## Style

- Matches existing dark theme + orange/amber accent
- Currency via `formatCurrency` (৳, 2 decimals); month suffix `/মাস` (Bengali, matches reference)
- Card layout: 1 col mobile, 2 col tablet, 4 col desktop
- "Current" ribbon = orange pill; "Most Popular" = blue; "Best Value" = green (mirroring reference image)

## Out of scope

- Auto-charging / online payments (still manual review by super admin)
- Plan creation/editing (already done via super admin Plans page)
