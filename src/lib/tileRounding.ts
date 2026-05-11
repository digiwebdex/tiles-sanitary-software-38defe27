/**
 * Tile auto-rounding helpers.
 *
 * Tile inventory is sold in whole boxes (a box covers `per_box_sft` SFT).
 * If a customer asks for 200 SFT and per_box_sft = 22.22, you must sell
 * 10 boxes = 222.22 SFT (the next full-box boundary).
 */
export function ceilBoxesFromSft(targetSft: number, perBoxSft: number): number {
  if (!perBoxSft || perBoxSft <= 0) return 0;
  return Math.ceil(targetSft / perBoxSft);
}

export function roundUpToFullBoxSft(targetSft: number, perBoxSft: number): number {
  const boxes = ceilBoxesFromSft(targetSft, perBoxSft);
  return +(boxes * perBoxSft).toFixed(4);
}

/** If user enters a fractional box quantity for a tile product, round UP to next whole box. */
export function roundTileBoxQty(qty: number): number {
  if (!Number.isFinite(qty) || qty <= 0) return qty;
  return Math.ceil(qty);
}
