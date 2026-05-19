import type { Knex } from 'knex';

/**
 * P1 — Add product_group, grade, description to products.
 * All optional, additive. No backfill required.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('products', (t) => {
    t.string('product_group', 100).nullable();
    t.string('grade', 50).nullable();
    t.text('description').nullable();
  });

  await knex.raw(
    `CREATE INDEX IF NOT EXISTS idx_products_product_group ON products(dealer_id, product_group) WHERE product_group IS NOT NULL`,
  );
  await knex.raw(
    `CREATE INDEX IF NOT EXISTS idx_products_grade ON products(dealer_id, grade) WHERE grade IS NOT NULL`,
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`DROP INDEX IF EXISTS idx_products_grade`);
  await knex.raw(`DROP INDEX IF EXISTS idx_products_product_group`);
  await knex.schema.alterTable('products', (t) => {
    t.dropColumn('description');
    t.dropColumn('grade');
    t.dropColumn('product_group');
  });
}
