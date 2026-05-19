/**
 * Phase T4b: enrich transaction line items with `qty_sqft` + `rate_unit`
 * for products configured as `stock_base_unit='sqft'` (tile-SQFT mode).
 *
 * Pre-T5 cutover: `quantity` is still in BOXES for box_sft products, so
 *   qty_sqft = quantity (boxes) × per_box_sft
 *
 * Post-T5 cutover: when `quantity` itself becomes SQFT (planned), this
 * helper will be updated alongside the cutover migration.
 *
 * For non-tile-sqft products this is a no-op; the item is returned unchanged.
 */

export interface TileSqftProductDims {
  id: string;
  stock_base_unit?: string | null;
  per_box_sft?: number | null;
  sqft_per_piece?: number | null;
  pieces_per_box?: number | null;
  unit_type?: string | null;
}

export type RateUnit = "per_piece" | "per_box" | "per_sqft";

export interface EnrichableItem {
  product_id: string;
  quantity?: number;
  qty_sqft?: number;
  rate_unit?: RateUnit;
  [k: string]: unknown;
}

const num = (v: unknown): number => {
  const n = typeof v === "string" ? parseFloat(v) : (v as number);
  return Number.isFinite(n) ? (n as number) : 0;
};

function perBoxSft(p: TileSqftProductDims): number {
  const direct = num(p.per_box_sft);
  if (direct > 0) return direct;
  return num(p.sqft_per_piece) * Math.max(1, num(p.pieces_per_box) || 1);
}

export function enrichItemsWithSqft<T extends EnrichableItem>(
  items: T[],
  productsById: Map<string, TileSqftProductDims>,
  opts: { defaultRateUnit?: RateUnit } = {},
): T[] {
  const defaultRateUnit = opts.defaultRateUnit ?? "per_sqft";
  return items.map((it) => {
    const p = productsById.get(it.product_id);
    if (!p || p.stock_base_unit !== "sqft") return it;
    const pbs = perBoxSft(p);
    if (pbs <= 0) return it;
    const qty_sqft = +(num(it.quantity) * pbs).toFixed(4);
    return { ...it, qty_sqft, rate_unit: it.rate_unit ?? defaultRateUnit };
  });
}
