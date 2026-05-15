/**
 * Box + Piece dual-unit helpers.
 *
 * Pieces is the canonical unit. Box is purely a display/UX wrapper.
 *   total_pieces = box_qty * pieces_per_box + piece_qty
 *
 * Used by both the React frontend and the Node backend (no React imports here).
 */

export interface BoxPiece {
  box: number;
  piece: number;
}

const safePpb = (ppb: number | null | undefined): number => {
  if (!ppb || ppb <= 0 || !Number.isFinite(ppb)) return 1;
  return Math.floor(ppb);
};

const safeNum = (n: number | null | undefined): number => {
  if (n == null || !Number.isFinite(n)) return 0;
  return n;
};

/** Convert a box+piece pair into total pieces. */
export function toTotalPieces(input: Partial<BoxPiece>, ppb: number): number {
  const p = safePpb(ppb);
  return safeNum(input.box) * p + safeNum(input.piece);
}

/** Split a total-piece count into normalized box+piece. */
export function fromTotalPieces(totalPieces: number, ppb: number): BoxPiece {
  const p = safePpb(ppb);
  const total = Math.max(0, Math.floor(safeNum(totalPieces)));
  return { box: Math.floor(total / p), piece: total % p };
}

/**
 * Normalize a box+piece pair so that piece < pieces_per_box.
 *   normalize({box: 1, piece: 15}, 12) => {box: 2, piece: 3}
 */
export function normalizeBoxPiece(input: Partial<BoxPiece>, ppb: number): BoxPiece {
  return fromTotalPieces(toTotalPieces(input, ppb), ppb);
}

/** "7 box 9 pcs" — the standard display format. */
export function formatBoxPiece(totalPieces: number, ppb: number): string {
  const { box, piece } = fromTotalPieces(totalPieces, ppb);
  return `${box} box ${piece} pcs`;
}

/** "Total: 93 pcs" — small-text companion. */
export function formatTotalPieces(totalPieces: number): string {
  return `Total: ${Math.max(0, Math.floor(safeNum(totalPieces)))} pcs`;
}

/** "Available: 7 box 9 pcs" — used in insufficient-stock errors. */
export function formatAvailable(totalPieces: number, ppb: number): string {
  return `Available: ${formatBoxPiece(totalPieces, ppb)}`;
}

/** Validation helper used by Zod refinements. */
export function isValidBoxPiece(input: Partial<BoxPiece>): boolean {
  const b = safeNum(input.box);
  const p = safeNum(input.piece);
  return b >= 0 && p >= 0 && (b > 0 || p > 0);
}

/**
 * Smart unit-aware formatter for stock/qty display.
 *
 *  - Tile (isTile=true, ppb>1):
 *      6 box 0 pc → "6 box"
 *      0 box 5 pc → "5 pcs"
 *      6 box 5 pc → "6 box 5 pcs"
 *  - Piece products: "N pcs"
 *
 * `qty` semantics:
 *   - When `isTile` is true, `qty` is the (possibly decimal) box-equivalent
 *     quantity that we use everywhere in sale_items/delivery_items
 *     (e.g. 6.42 = 6 box 5 pcs when ppb=12). Internally converted to total
 *     pieces via `qty * ppb`, then split back into normalized box+piece.
 *   - When `isTile` is false, `qty` is raw piece count.
 */
export function formatStockUnit(
  qty: number,
  ppb: number | null | undefined,
  isTile: boolean,
): string {
  const n = safeNum(qty);
  if (!isTile) return `${Math.round(n)} pcs`;
  const p = safePpb(ppb);
  const totalPieces = Math.round(n * p);
  const { box, piece } = fromTotalPieces(totalPieces, p);
  if (box > 0 && piece > 0) return `${box} box ${piece} pcs`;
  if (box > 0) return `${box} box`;
  return `${piece} pcs`;
}
