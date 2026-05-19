import type { Knex } from "knex";

/**
 * Phase T4a — corrective follow-up to migration 027.
 *
 * 027 targeted `sales_return_items` (plural) which does NOT exist in this
 * schema — sales returns are stored as one row per return in `sales_returns`
 * with column `qty`. This migration adds the canonical SQFT column there.
 *
 * Additive + nullable. Safe rollback.
 */
export async function up(knex: Knex): Promise<void> {
  const has = await knex.schema.hasTable("sales_returns");
  if (!has) return;
  const hasCol = await knex.schema.hasColumn("sales_returns", "qty_sqft");
  if (hasCol) return;
  await knex.schema.alterTable("sales_returns", (t) => {
    t.decimal("qty_sqft", 14, 4).nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  const has = await knex.schema.hasTable("sales_returns");
  if (!has) return;
  const hasCol = await knex.schema.hasColumn("sales_returns", "qty_sqft");
  if (hasCol) {
    await knex.schema.alterTable("sales_returns", (t) => t.dropColumn("qty_sqft"));
  }
}
