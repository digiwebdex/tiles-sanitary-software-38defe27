/**
 * Reusable display for tile / piece stock.
 *
 * For tiles: shows "X Box Y Pc (≈ Z SFT)".
 * For piece-only products: shows "X Pc".
 *
 * Inputs are all in the canonical `total_pieces` unit; this component
 * derives box / loose-piece / SFT for presentation only.
 */
import { cn } from "@/lib/utils";

interface TileStockBadgeProps {
  /** Canonical stock count in pieces. */
  totalPieces: number;
  /** Pieces per box (must be > 0 for tiles). */
  piecesPerBox?: number | null;
  /** SFT covered by one full box (tiles only). */
  perBoxSft?: number | null;
  /** Pass true when product is a tile (box_sft unit). */
  isTile?: boolean;
  className?: string;
  /** Show SFT line under the box/pc line (default true for tiles). */
  showSft?: boolean;
}

export function splitBoxPiece(totalPieces: number, piecesPerBox: number) {
  if (!piecesPerBox || piecesPerBox <= 0) {
    return { box: 0, piece: Math.max(0, totalPieces) };
  }
  const safe = Math.max(0, totalPieces);
  return {
    box: Math.floor(safe / piecesPerBox),
    piece: safe % piecesPerBox,
  };
}

export function piecesToSft(
  totalPieces: number,
  piecesPerBox: number,
  perBoxSft: number,
) {
  if (!piecesPerBox || piecesPerBox <= 0 || !perBoxSft) return 0;
  return (totalPieces / piecesPerBox) * perBoxSft;
}

export function formatBoxPieceSft(
  totalPieces: number,
  piecesPerBox?: number | null,
  perBoxSft?: number | null,
  isTile = true,
) {
  const ppb = Number(piecesPerBox ?? 0);
  if (!isTile || !ppb) {
    return `${Math.max(0, Number(totalPieces) || 0)} Pc`;
  }
  const { box, piece } = splitBoxPiece(Number(totalPieces) || 0, ppb);
  const sft = perBoxSft ? piecesToSft(Number(totalPieces) || 0, ppb, Number(perBoxSft)) : 0;
  const head = piece > 0 ? `${box} Box ${piece} Pc` : `${box} Box`;
  return perBoxSft ? `${head} (≈ ${sft.toFixed(2)} SFT)` : head;
}

export function TileStockBadge({
  totalPieces,
  piecesPerBox,
  perBoxSft,
  isTile = true,
  className,
  showSft = true,
}: TileStockBadgeProps) {
  const ppb = Number(piecesPerBox ?? 0);
  const total = Math.max(0, Number(totalPieces) || 0);

  if (!isTile || !ppb) {
    return (
      <span className={cn("inline-flex items-baseline gap-1 text-sm font-medium", className)}>
        {total} <span className="text-xs text-muted-foreground">Pc</span>
      </span>
    );
  }

  const { box, piece } = splitBoxPiece(total, ppb);
  const sft = perBoxSft ? piecesToSft(total, ppb, Number(perBoxSft)) : 0;

  return (
    <span className={cn("inline-flex flex-col leading-tight", className)}>
      <span className="text-sm font-semibold">
        {box} <span className="text-xs font-normal text-muted-foreground">Box</span>
        {piece > 0 && (
          <>
            {" "}
            {piece} <span className="text-xs font-normal text-muted-foreground">Pc</span>
          </>
        )}
      </span>
      {showSft && perBoxSft ? (
        <span className="text-[10px] text-muted-foreground">≈ {sft.toFixed(2)} SFT</span>
      ) : null}
    </span>
  );
}

export default TileStockBadge;
