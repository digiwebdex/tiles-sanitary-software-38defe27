import { Knex } from 'knex';

/**
 * Phase T1 — Tile SQFT base unit (additive only).
 *
 * Adds tile dimension fields + computed sqft helpers + an opt-in
 * `stock_base_unit` flag. Default stays `piece` so NO existing transaction
 * logic changes. A future phase flips per-product to `sqft`.
 *
 * Idempotent.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    ALTER TABLE public.products
      ADD COLUMN IF NOT EXISTS tile_width     numeric(8,3),
      ADD COLUMN IF NOT EXISTS tile_height    numeric(8,3),
      ADD COLUMN IF NOT EXISTS size_unit      text DEFAULT 'inch',
      ADD COLUMN IF NOT EXISTS sqft_per_piece numeric(12,4),
      ADD COLUMN IF NOT EXISTS sqft_per_box   numeric(12,4),
      ADD COLUMN IF NOT EXISTS stock_base_unit text NOT NULL DEFAULT 'piece';
  `);

  await knex.raw(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'products_size_unit_check'
      ) THEN
        ALTER TABLE public.products
          ADD CONSTRAINT products_size_unit_check
          CHECK (size_unit IN ('inch','cm','feet'));
      END IF;
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'products_stock_base_unit_check'
      ) THEN
        ALTER TABLE public.products
          ADD CONSTRAINT products_stock_base_unit_check
          CHECK (stock_base_unit IN ('piece','sqft'));
      END IF;
    END $$;
  `);

  // Best-effort backfill of sqft_per_piece for existing tile box_sft products
  // where we already know per_box_sft and pieces_per_box.
  await knex.raw(`
    UPDATE public.products
       SET sqft_per_piece = ROUND(per_box_sft::numeric / NULLIF(pieces_per_box,0), 4),
           sqft_per_box   = per_box_sft
     WHERE category = 'tiles'
       AND unit_type = 'box_sft'
       AND per_box_sft IS NOT NULL
       AND pieces_per_box IS NOT NULL
       AND pieces_per_box > 0
       AND sqft_per_piece IS NULL;
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    ALTER TABLE public.products
      DROP CONSTRAINT IF EXISTS products_size_unit_check,
      DROP CONSTRAINT IF EXISTS products_stock_base_unit_check;
  `);
  await knex.raw(`
    ALTER TABLE public.products
      DROP COLUMN IF EXISTS tile_width,
      DROP COLUMN IF EXISTS tile_height,
      DROP COLUMN IF EXISTS size_unit,
      DROP COLUMN IF EXISTS sqft_per_piece,
      DROP COLUMN IF EXISTS sqft_per_box,
      DROP COLUMN IF EXISTS stock_base_unit;
  `);
}
