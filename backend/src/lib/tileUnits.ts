/**
 * Backend mirror of src/lib/tileUnits.ts — keep these two files in sync.
 * Duplicated rather than imported to avoid a cross-package build coupling.
 */

export type SizeUnit = "inch" | "cm" | "feet";

export interface TileDims {
  tile_width?: number | string | null;
  tile_height?: number | string | null;
  size_unit?: SizeUnit | string | null;
  pieces_per_box?: number | string | null;
  sqft_per_piece?: number | string | null;
  sqft_per_box?: number | string | null;
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

export function computeSqftPerPiece(
  width: number | string | null | undefined,
  height: number | string | null | undefined,
  unit: SizeUnit | string | null | undefined,
): number {
  const w = num(width);
  const h = num(height);
  if (w <= 0 || h <= 0) return 0;
  const u = ((unit ?? "inch") as SizeUnit);
  const div = DIV[u] ?? DIV.inch;
  return +(w * h / div).toFixed(4);
}

export function computeSqftPerBox(sqftPerPiece: number, piecesPerBox: number | string | null | undefined): number {
  const ppb = Math.max(1, Math.floor(num(piecesPerBox) || 1));
  return +(num(sqftPerPiece) * ppb).toFixed(4);
}

export function resolveSqftPerPiece(p: TileDims): number {
  const stored = num(p.sqft_per_piece);
  if (stored > 0) return stored;
  return computeSqftPerPiece(p.tile_width, p.tile_height, p.size_unit ?? "inch");
}

export function sqftToBoxPcs(totalSqft: number | string, product: TileDims) {
  const spp = resolveSqftPerPiece(product);
  const ppb = Math.max(1, Math.floor(num(product.pieces_per_box) || 1));
  if (spp <= 0) return { box: 0, pcs: 0, totalPieces: 0 };
  const totalPieces = Math.round((num(totalSqft) / spp) * 10000) / 10000;
  const wholePieces = Math.round(totalPieces);
  const box = Math.floor(wholePieces / ppb);
  const pcs = wholePieces - box * ppb;
  return { box, pcs, totalPieces };
}

export function piecesToSqft(totalPieces: number | string, product: TileDims): number {
  const spp = resolveSqftPerPiece(product);
  return +(num(totalPieces) * spp).toFixed(4);
}
