import type { Knex } from 'knex';

/**
 * Phase 1 of the Box + Piece dual-unit stock system.
 *
 * Adds — purely additive, behind a per-dealer `dual_unit_enabled` flag:
 *   - products.pieces_per_box            (default 1, > 0)
 *   - dealers.dual_unit_enabled          (default false)
 *   - purchase_items / sale_items / sales_returns / purchase_return_items:
 *         box_qty, piece_qty, total_pieces (back-filled)
 *   - product_batches.total_pieces, pieces_per_box_snapshot   (if table exists)
 *   - stock.total_pieces, reserved_total_pieces
 *   - stock_reservations.total_pieces                          (if table exists)
 *   - stock_ledger (new audit table)
 *   - format_box_piece(pieces, ppb) -> text  SQL helper
 *
 * Pieces is the canonical unit going forward. SFT remains for tile pricing.
 * Existing Box / SFT / Piece columns are NOT removed in this migration.
 */
export async function up(knex: Knex): Promise<void> {
  // ---------------------------------------------------------------- products
  await knex.schema.alterTable('products', (t) => {
    t.integer('pieces_per_box').notNullable().defaultTo(1);
  });
  await knex.raw(
    `ALTER TABLE public.products
       ADD CONSTRAINT chk_products_pieces_per_box_positive
       CHECK (pieces_per_box > 0)`,
  );

  // ----------------------------------------------------------------- dealers
  await knex.schema.alterTable('dealers', (t) => {
    t.boolean('dual_unit_enabled').notNullable().defaultTo(false);
  });

  // ---------------------------------------------------------- purchase_items
  await knex.schema.alterTable('purchase_items', (t) => {
    t.decimal('box_qty', 12, 2).notNullable().defaultTo(0);
    t.decimal('piece_qty', 12, 2).notNullable().defaultTo(0);
    t.decimal('total_pieces', 14, 2).notNullable().defaultTo(0);
  });
  await knex.raw(`
    UPDATE public.purchase_items pi
       SET box_qty       = pi.quantity,
           piece_qty     = 0,
           total_pieces  = pi.quantity * COALESCE(p.pieces_per_box, 1)
      FROM public.products p
     WHERE p.id = pi.product_id
  `);

  // -------------------------------------------------------------- sale_items
  await knex.schema.alterTable('sale_items', (t) => {
    t.decimal('box_qty', 12, 2).notNullable().defaultTo(0);
    t.decimal('piece_qty', 12, 2).notNullable().defaultTo(0);
    t.decimal('total_pieces', 14, 2).notNullable().defaultTo(0);
  });
  await knex.raw(`
    UPDATE public.sale_items si
       SET box_qty       = si.quantity,
           piece_qty     = 0,
           total_pieces  = si.quantity * COALESCE(p.pieces_per_box, 1)
      FROM public.products p
     WHERE p.id = si.product_id
  `);

  // ---------------------------------------------------- purchase_return_items
  if (await knex.schema.hasTable('purchase_return_items')) {
    await knex.schema.alterTable('purchase_return_items', (t) => {
      t.decimal('box_qty', 12, 2).notNullable().defaultTo(0);
      t.decimal('piece_qty', 12, 2).notNullable().defaultTo(0);
      t.decimal('total_pieces', 14, 2).notNullable().defaultTo(0);
    });
    await knex.raw(`
      UPDATE public.purchase_return_items pri
         SET box_qty      = COALESCE(pri.quantity, 0),
             piece_qty    = 0,
             total_pieces = COALESCE(pri.quantity, 0) * COALESCE(p.pieces_per_box, 1)
        FROM public.products p
       WHERE p.id = pri.product_id
    `);
  }

  // --------------------------------------------------------- sales_returns
  // VPS schema uses `sales_returns` with column `qty`.
  if (await knex.schema.hasTable('sales_returns')) {
    await knex.schema.alterTable('sales_returns', (t) => {
      t.decimal('box_qty', 12, 2).notNullable().defaultTo(0);
      t.decimal('piece_qty', 12, 2).notNullable().defaultTo(0);
      t.decimal('total_pieces', 14, 2).notNullable().defaultTo(0);
    });
    await knex.raw(`
      UPDATE public.sales_returns sr
         SET box_qty      = COALESCE(sr.qty, 0),
             piece_qty    = 0,
             total_pieces = COALESCE(sr.qty, 0) * COALESCE(p.pieces_per_box, 1)
        FROM public.products p
       WHERE p.id = sr.product_id
    `);
  }

  // ---------------------------------------------------------- product_batches
  // Optional — only present on installations that use FIFO batch tracking.
  if (await knex.schema.hasTable('product_batches')) {
    await knex.schema.alterTable('product_batches', (t) => {
      t.decimal('total_pieces', 14, 2).notNullable().defaultTo(0);
      t.integer('pieces_per_box_snapshot').notNullable().defaultTo(1);
    });
    await knex.raw(`
      UPDATE public.product_batches pb
         SET pieces_per_box_snapshot = COALESCE(p.pieces_per_box, 1),
             total_pieces            = (COALESCE(pb.box_qty, 0)
                                        + COALESCE(pb.piece_qty, 0))
                                       * COALESCE(p.pieces_per_box, 1)
        FROM public.products p
       WHERE p.id = pb.product_id
    `);
  }

  // ------------------------------------------------------------------- stock
  await knex.schema.alterTable('stock', (t) => {
    t.decimal('total_pieces', 14, 2).notNullable().defaultTo(0);
    t.decimal('reserved_total_pieces', 14, 2).notNullable().defaultTo(0);
  });
  await knex.raw(`
    UPDATE public.stock s
       SET total_pieces = (COALESCE(s.box_qty, 0) + COALESCE(s.piece_qty, 0))
                          * COALESCE(p.pieces_per_box, 1),
           reserved_total_pieces =
                  (COALESCE(s.reserved_box_qty, 0) + COALESCE(s.reserved_piece_qty, 0))
                  * COALESCE(p.pieces_per_box, 1)
      FROM public.products p
     WHERE p.id = s.product_id
  `);
  await knex.raw(`
    ALTER TABLE public.stock
      ADD CONSTRAINT chk_stock_total_pieces_non_negative
        CHECK (total_pieces >= 0),
      ADD CONSTRAINT chk_stock_reserved_total_pieces_non_negative
        CHECK (reserved_total_pieces >= 0)
  `);

  // ------------------------------------------------------ stock_reservations
  if (await knex.schema.hasTable('stock_reservations')) {
    await knex.schema.alterTable('stock_reservations', (t) => {
      t.decimal('total_pieces', 14, 2).notNullable().defaultTo(0);
    });
    await knex.raw(`
      UPDATE public.stock_reservations sr
         SET total_pieces = COALESCE(sr.reserved_qty, 0)
                            * COALESCE(p.pieces_per_box, 1)
        FROM public.products p
       WHERE p.id = sr.product_id
    `);
  }

  // ------------------------------------------------------------ stock_ledger
  await knex.schema.createTable('stock_ledger', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('dealer_id').notNullable().references('id').inTable('dealers').onDelete('CASCADE');
    t.uuid('product_id').notNullable().references('id').inTable('products');
    t.string('txn_type', 32).notNullable();
    t.string('reference_table', 64).nullable();
    t.uuid('reference_id').nullable();
    t.string('reference_no', 64).nullable();
    t.decimal('box_qty', 12, 2).notNullable().defaultTo(0);
    t.decimal('piece_qty', 12, 2).notNullable().defaultTo(0);
    t.integer('pieces_per_box').notNullable();
    t.decimal('total_pieces', 14, 2).notNullable();
    t.decimal('stock_before_pieces', 14, 2).notNullable();
    t.decimal('stock_after_pieces', 14, 2).notNullable();
    t.string('stock_before_display', 32).notNullable();
    t.string('stock_after_display', 32).notNullable();
    t.uuid('created_by').nullable();
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());

    t.index(['dealer_id', 'product_id', 'created_at'], 'idx_stock_ledger_dealer_product');
    t.index(['dealer_id', 'created_at'], 'idx_stock_ledger_dealer_recent');
    t.index(['reference_table', 'reference_id'], 'idx_stock_ledger_reference');
  });

  // ------------------------------------------------------ format_box_piece()
  await knex.raw(`
    CREATE OR REPLACE FUNCTION public.format_box_piece(_pieces numeric, _ppb integer)
    RETURNS text
    LANGUAGE sql
    IMMUTABLE
    AS $$
      SELECT CASE
        WHEN _ppb IS NULL OR _ppb <= 0 THEN
          floor(COALESCE(_pieces, 0))::text || ' pcs'
        ELSE
          floor(COALESCE(_pieces, 0) / _ppb)::text || ' box ' ||
          floor(COALESCE(_pieces, 0) - floor(COALESCE(_pieces, 0) / _ppb) * _ppb)::text || ' pcs'
      END
    $$;
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw('DROP FUNCTION IF EXISTS public.format_box_piece(numeric, integer)');
  await knex.schema.dropTableIfExists('stock_ledger');

  if (await knex.schema.hasTable('stock_reservations')) {
    await knex.schema.alterTable('stock_reservations', (t) => {
      t.dropColumn('total_pieces');
    });
  }

  await knex.raw(`
    ALTER TABLE public.stock
      DROP CONSTRAINT IF EXISTS chk_stock_total_pieces_non_negative,
      DROP CONSTRAINT IF EXISTS chk_stock_reserved_total_pieces_non_negative
  `);
  await knex.schema.alterTable('stock', (t) => {
    t.dropColumn('total_pieces');
    t.dropColumn('reserved_total_pieces');
  });

  if (await knex.schema.hasTable('product_batches')) {
    await knex.schema.alterTable('product_batches', (t) => {
      t.dropColumn('total_pieces');
      t.dropColumn('pieces_per_box_snapshot');
    });
  }

  for (const tbl of ['sales_returns', 'purchase_return_items', 'sale_items', 'purchase_items']) {
    if (await knex.schema.hasTable(tbl)) {
      await knex.schema.alterTable(tbl, (t) => {
        t.dropColumn('total_pieces');
        t.dropColumn('piece_qty');
        t.dropColumn('box_qty');
      });
    }
  }

  await knex.schema.alterTable('dealers', (t) => {
    t.dropColumn('dual_unit_enabled');
  });

  await knex.raw('ALTER TABLE public.products DROP CONSTRAINT IF EXISTS chk_products_pieces_per_box_positive');
  await knex.schema.alterTable('products', (t) => {
    t.dropColumn('pieces_per_box');
  });
}
