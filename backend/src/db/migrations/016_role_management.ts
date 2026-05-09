import type { Knex } from 'knex';

/**
 * Role Management — adds two new dealer-scoped roles to the existing
 * `app_role` enum and tracking columns to `profiles`.
 *
 *   manager      — full operational access (no team, no billing)
 *   accountant   — ledger / collections / expenses / financial reports
 *
 * `dealer_admin` (Owner) and `salesman` (Sales Agent) keep their
 * existing semantics. `super_admin` is unchanged.
 *
 * Postgres requires ADD VALUE outside an explicit transaction, so we
 * disable knex's transaction wrapper here.
 */
export const config = { transaction: false };

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'manager'`);
  await knex.raw(`ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'accountant'`);

  await knex.raw(`
    ALTER TABLE public.profiles
      ADD COLUMN IF NOT EXISTS invited_at timestamptz,
      ADD COLUMN IF NOT EXISTS last_login_at timestamptz;
  `);
}

export async function down(_knex: Knex): Promise<void> {
  // Postgres does not support removing values from an enum without a
  // full type rebuild. Leaving enum values in place is safe.
}
