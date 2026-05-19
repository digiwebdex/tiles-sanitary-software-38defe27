import type { Knex } from "knex";

/**
 * Phase T3 — Additive SQFT columns on transactional tables.
 *
 * Strategy (matches user-approved "Phased, Tiles only, Manual per-product, Rate per SQFT"):
 *  - All new columns are NULLABLE. Existing rows untouched.
 *  - No CHECK constraints, no RPC changes here. Stock semantics still piece-based.
 *  - T4 (forms) will start populating qty_sqft + rate_unit alongside quantity.
 *  - T5 (per-dealer cutover) will flip stock_base_unit='sqft' for opted-in products
 *    and switch the PL/pgSQL allocators to consume qty_sqft when that flag is set.
 *
 * Safe to roll back: drop the columns; nothing downstream reads them yet.
 */

const TABLES_QTY: Array<{ table: string; col?: string }> = [
  { table: "sale_items" },
  { table: "purchase_items" },
  { table: "delivery_items" },
  { table: "sales_return_items" },
  { table: "purchase_return_items" },
  { table: "product_batches", col: "qty_sqft_remaining" },
  { table: "stock", col: "qty_sqft" },
  { table: "stock_reservations" },
];

const TABLES_RATE: string[] = ["sale_items", "purchase_items"];

export async function up(knex: Knex): Promise<void> {
  // 1) qty_sqft columns (numeric, 4 dp, nullable)
  for (const t of TABLES_QTY) {
    const exists = await knex.schema.hasTable(t.table);
    if (!exists) continue;
    const colName = t.col ?? "qty_sqft";
    const hasCol = await knex.schema.hasColumn(t.table, colName);
    if (hasCol) continue;
    await knex.schema.alterTable(t.table, (tb) => {
      tb.decimal(colName, 14, 4).nullable();
    });
  }

  // 2) rate_unit on sale_items + purchase_items
  //    Values: 'per_piece' | 'per_box' | 'per_sqft'. NULL = legacy per_piece.
  for (const tbl of TABLES_RATE) {
    const exists = await knex.schema.hasTable(tbl);
    if (!exists) continue;
    const hasCol = await knex.schema.hasColumn(tbl, "rate_unit");
    if (hasCol) continue;
    await knex.schema.alterTable(tbl, (tb) => {
      tb.string("rate_unit", 16).nullable();
    });
  }

  // 3) Index product_batches.qty_sqft_remaining for FIFO scans when stock_base_unit='sqft'
  const hasBatches = await knex.schema.hasTable("product_batches");
  if (hasBatches) {
    await knex.raw(
      `CREATE INDEX IF NOT EXISTS idx_product_batches_qty_sqft_remaining
         ON product_batches (product_id, dealer_id)
         WHERE qty_sqft_remaining IS NOT NULL AND qty_sqft_remaining > 0`,
    );
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`DROP INDEX IF EXISTS idx_product_batches_qty_sqft_remaining`);

  for (const tbl of TABLES_RATE) {
    const exists = await knex.schema.hasTable(tbl);
    if (!exists) continue;
    const hasCol = await knex.schema.hasColumn(tbl, "rate_unit");
    if (hasCol) {
      await knex.schema.alterTable(tbl, (tb) => tb.dropColumn("rate_unit"));
    }
  }

  for (const t of TABLES_QTY) {
    const exists = await knex.schema.hasTable(t.table);
    if (!exists) continue;
    const colName = t.col ?? "qty_sqft";
    const hasCol = await knex.schema.hasColumn(t.table, colName);
    if (hasCol) {
      await knex.schema.alterTable(t.table, (tb) => tb.dropColumn(colName));
    }
  }
}
