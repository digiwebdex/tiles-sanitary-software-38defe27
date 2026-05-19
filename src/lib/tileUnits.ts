/**
 * Tile SQFT ↔ Box/Pcs conversion — single source of truth.
 *
 * Used wherever a tile product's dimensions need to convert between
 * SQFT (canonical when stock_base_unit='sqft') and the
 * Box + Loose-Pcs display format.
 *
 * Frontend AND backend import from this module — no React deps.
 */

export type SizeUnit = "inch" | "cm" | "feet";

export interface TileDims {
  tile_width?: number | null;
  tile_height?: number | null;
  size_unit?: SizeUnit | string | null;
  pieces_per_box?: number | null;
  sqft_per_piece?: number | null;
  sqft_per_box?: number | null;
}

const num = (v: unknown): number => {
  const n = typeof v === "string" ? parseFloat(v) : (v as number);
  return Number.isFinite(n) ? (n as number) : 0;
};

const DIV: Record<SizeUnit, number> = {
  inch: 144,
  cm: 929.0304,
  feet: 1,
};

/** Compute sqft per piece from raw tile dimensions. */
export function computeSqftPerPiece(
  width: number | null | undefined,
  height: number | null | undefined,
  unit: SizeUnit | string | null | undefined,
): number {
  const w = num(width);
  const h = num(height);
  if (w <= 0 || h <= 0) return 0;
  const u = (unit ?? "inch") as SizeUnit;
  const div = DIV[u] ?? DIV.inch;
  return +(w * h / div).toFixed(4);
}

export function computeSqftPerBox(sqftPerPiece: number, piecesPerBox: number | null | undefined): number {
  const ppb = Math.max(1, Math.floor(num(piecesPerBox) || 1));
  return +(num(sqftPerPiece) * ppb).toFixed(4);
}

/** Resolve sqft/piece from a product-like record (prefers stored value). */
export function resolveSqftPerPiece(p: TileDims): number {
  const stored = num(p.sqft_per_piece);
  if (stored > 0) return stored;
  return computeSqftPerPiece(p.tile_width, p.tile_height, p.size_unit ?? "inch");
}

export interface BoxPcsSplit {
  box: number;
  pcs: number;
  totalPieces: number;
}

/** Split total SQFT into full boxes + loose pieces. */
export function sqftToBoxPcs(totalSqft: number, product: TileDims): BoxPcsSplit {
  const spp = resolveSqftPerPiece(product);
  const ppb = Math.max(1, Math.floor(num(product.pieces_per_box) || 1));
  if (spp <= 0) return { box: 0, pcs: 0, totalPieces: 0 };
  const totalPieces = Math.round((num(totalSqft) / spp) * 10000) / 10000;
  const wholePieces = Math.round(totalPieces);
  const box = Math.floor(wholePieces / ppb);
  const pcs = wholePieces - box * ppb;
  return { box, pcs, totalPieces };
}

export function piecesToSqft(totalPieces: number, product: TileDims): number {
  const spp = resolveSqftPerPiece(product);
  return +(num(totalPieces) * spp).toFixed(4);
}

const fmtSqft = (n: number): string => {
  const v = num(n);
  if (Number.isInteger(v)) return v.toString();
  return v.toFixed(2).replace(/\.?0+$/, "");
};

/** "250 SQFT | 15 box 0 pcs" — the standard tile stock display. */
export function formatTileStock(totalSqft: number, product: TileDims): string {
  const { box, pcs } = sqftToBoxPcs(totalSqft, product);
  return `${fmtSqft(totalSqft)} SQFT | ${box} box ${pcs} pcs`;
}

/** Short form: "15 box 0 pcs" — when SQFT shown separately. */
export function formatBoxPcs(totalSqft: number, product: TileDims): string {
  const { box, pcs } = sqftToBoxPcs(totalSqft, product);
  return `${box} box ${pcs} pcs`;
}

/** True when the product is configured to store stock as SQFT. */
export function isTileSqftProduct(p: { stock_base_unit?: string | null; category?: string | null }): boolean {
  return p?.stock_base_unit === "sqft";
}
