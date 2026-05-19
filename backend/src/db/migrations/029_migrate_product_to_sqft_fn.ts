import type { Knex } from "knex";

/**
 * Phase T5 — Per-product cutover RPC.
 *
 * `migrate_product_to_sqft(_product_id uuid, _dry_run boolean)` returns JSON:
 *   {
 *     ok: bool, product_id, dealer_id, dry_run,
 *     before: { stock_base_unit, batches: int, total_sqft, stock_qty_sqft },
 *     after:  { stock_base_unit, batches: int, total_sqft, stock_qty_sqft },
 *     errors: text[]  -- non-empty means refused
 *   }
 *
 * Rules:
 *  - Refuses when sqft_per_piece is missing/<=0 OR pieces_per_box is missing/<=0.
 *  - Refuses when product is not a tile (category ILIKE 'tile%').
 *  - Idempotent: re-running on a SQFT product just re-syncs qty_sqft from batches.
 *  - Dry-run computes the projected after-state but commits nothing.
 *  - Rollback equivalent: `UPDATE products SET stock_base_unit='piece' WHERE id=$1;`
 *    Legacy box_qty/piece_qty/sft_qty columns are never touched.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    CREATE OR REPLACE FUNCTION public.migrate_product_to_sqft(
      _product_id uuid,
      _dry_run boolean DEFAULT true
    )
    RETURNS jsonb
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
    AS $$
    DECLARE
      v_product       RECORD;
      v_dealer_id     uuid;
      v_spp           numeric;
      v_ppb           int;
      v_errors        text[] := ARRAY[]::text[];
      v_before        jsonb;
      v_after         jsonb;
      v_total_sqft    numeric := 0;
      v_batch_count   int     := 0;
      v_stock_qty_sqft numeric := 0;
    BEGIN
      SELECT * INTO v_product FROM products WHERE id = _product_id;
      IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'errors', ARRAY['product not found']);
      END IF;
      v_dealer_id := v_product.dealer_id;

      -- Tile gate (category ILIKE 'tile%')
      IF v_product.category IS NULL OR NOT (v_product.category ILIKE 'tile%') THEN
        v_errors := array_append(v_errors, 'product category is not a tile');
      END IF;

      v_spp := COALESCE(v_product.sqft_per_piece, 0);
      v_ppb := COALESCE(v_product.pieces_per_box, 0);
      IF v_spp <= 0 THEN
        v_errors := array_append(v_errors, 'sqft_per_piece missing or zero — fill tile dimensions first');
      END IF;
      IF v_ppb <= 0 THEN
        v_errors := array_append(v_errors, 'pieces_per_box missing or zero');
      END IF;

      -- BEFORE snapshot
      SELECT COUNT(*),
             COALESCE(SUM((box_qty * v_ppb + piece_qty) * v_spp), 0)
        INTO v_batch_count, v_total_sqft
        FROM product_batches
       WHERE product_id = _product_id
         AND status = 'active';

      SELECT COALESCE(qty_sqft, 0) INTO v_stock_qty_sqft
        FROM stock WHERE product_id = _product_id AND dealer_id = v_dealer_id;

      v_before := jsonb_build_object(
        'stock_base_unit', v_product.stock_base_unit,
        'active_batches', v_batch_count,
        'computed_total_sqft', round(v_total_sqft, 4),
        'stock_qty_sqft', round(COALESCE(v_stock_qty_sqft, 0), 4)
      );

      IF array_length(v_errors, 1) IS NOT NULL THEN
        RETURN jsonb_build_object(
          'ok', false, 'product_id', _product_id, 'dealer_id', v_dealer_id,
          'dry_run', _dry_run, 'before', v_before, 'errors', v_errors
        );
      END IF;

      -- Projected AFTER (same numbers regardless of dry_run)
      v_after := jsonb_build_object(
        'stock_base_unit', 'sqft',
        'active_batches', v_batch_count,
        'computed_total_sqft', round(v_total_sqft, 4),
        'stock_qty_sqft', round(v_total_sqft, 4)
      );

      IF _dry_run THEN
        RETURN jsonb_build_object(
          'ok', true, 'product_id', _product_id, 'dealer_id', v_dealer_id,
          'dry_run', true, 'before', v_before, 'after', v_after, 'errors', v_errors
        );
      END IF;

      -- COMMIT path: backfill canonical qty_sqft on every active batch
      UPDATE product_batches
         SET qty_sqft_remaining = round((box_qty * v_ppb + piece_qty) * v_spp, 4)
       WHERE product_id = _product_id
         AND status = 'active';

      -- Upsert stock.qty_sqft
      INSERT INTO stock (product_id, dealer_id, box_qty, piece_qty, sft_qty, qty_sqft)
      VALUES (_product_id, v_dealer_id, 0, 0, 0, round(v_total_sqft, 4))
      ON CONFLICT (product_id, dealer_id) DO UPDATE
        SET qty_sqft = round(v_total_sqft, 4),
            updated_at = NOW();

      -- Flip the flag
      UPDATE products SET stock_base_unit = 'sqft' WHERE id = _product_id;

      -- Audit
      INSERT INTO audit_logs (dealer_id, user_id, action, table_name, record_id, old_data, new_data)
      VALUES (
        v_dealer_id, NULL, 'TILE_SQFT_CUTOVER', 'products', _product_id,
        v_before, v_after
      );

      RETURN jsonb_build_object(
        'ok', true, 'product_id', _product_id, 'dealer_id', v_dealer_id,
        'dry_run', false, 'before', v_before, 'after', v_after, 'errors', v_errors
      );
    END;
    $$;
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`DROP FUNCTION IF EXISTS public.migrate_product_to_sqft(uuid, boolean);`);
}
