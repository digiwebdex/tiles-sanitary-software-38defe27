/**
 * Stock adjustments route — Phase 3R.
 *
 * Manual stock add / deduct / restore / broken endpoints. Each call writes
 * an audit_log row inside a transaction, so the operation is atomic and
 * tamper-evident.
 *
 *   POST /api/adjustments/add     { product_id, quantity }
 *   POST /api/adjustments/deduct  { product_id, quantity }
 *   POST /api/adjustments/restore { product_id, quantity }
 *   POST /api/adjustments/broken  { product_id, quantity, reason }
 *
 * dealer_admin only.
 */
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { db } from '../db/connection';
import { authenticate } from '../middleware/auth';
import { tenantGuard } from '../middleware/tenant';
import { formatBoxPiece } from '../lib/units';

const router = Router();
router.use(authenticate, tenantGuard);

function resolveDealer(req: Request, res: Response): string | null {
  const isSuper = req.user?.roles.includes('super_admin');
  const claimed =
    (req.query.dealerId as string | undefined) ||
    (req.body?.dealer_id as string | undefined) ||
    undefined;
  if (isSuper) {
    if (!claimed) {
      res.status(400).json({ error: 'super_admin must specify dealerId' });
      return null;
    }
    return claimed;
  }
  if (!req.dealerId) {
    res.status(403).json({ error: 'No dealer assigned to your account' });
    return null;
  }
  if (claimed && claimed !== req.dealerId) {
    res.status(403).json({ error: 'dealerId mismatch' });
    return null;
  }
  return req.dealerId;
}

function requireAdmin(req: Request, res: Response): boolean {
  const roles = (req.user?.roles ?? []) as string[];
  if (!roles.includes('dealer_admin') && !roles.includes('super_admin')) {
    res.status(403).json({ error: 'Only dealer_admin can adjust stock' });
    return false;
  }
  return true;
}

async function getOrCreateStockTrx(trx: any, productId: string, dealerId: string) {
  let stock = await trx('stock')
    .where({ product_id: productId, dealer_id: dealerId })
    .forUpdate()
    .first();
  if (!stock) {
    const [row] = await trx('stock')
      .insert({ product_id: productId, dealer_id: dealerId })
      .returning('*');
    stock = row;
  }
  return stock;
}

type AdjType = 'add' | 'deduct' | 'restore' | 'broken';

async function applyChange(
  type: AdjType,
  req: Request,
  res: Response,
  extra: { reason?: string } = {},
) {
  const dealerId = resolveDealer(req, res);
  if (!dealerId) return;
  if (!requireAdmin(req, res)) return;

  const Schema = z.object({
    product_id: z.string().uuid(),
    quantity: z.coerce.number().nonnegative().optional(),
    box_qty: z.coerce.number().nonnegative().optional(),
    piece_qty: z.coerce.number().nonnegative().optional(),
    reason: z.string().optional(),
  });
  const parsed = Schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    return;
  }
  const { product_id } = parsed.data;
  const reason = extra.reason ?? parsed.data.reason ?? null;

  try {
    await db.transaction(async (trx) => {
      const product = await trx('products')
        .where({ id: product_id, dealer_id: dealerId })
        .first('id', 'unit_type', 'per_box_sft', 'pieces_per_box');
      if (!product) throw new Error(`Product not found: ${product_id}`);

      const ppb = Math.max(1, Number(product.pieces_per_box ?? 1) || 1);
      const isTile = product.unit_type === 'box_sft';

      // Resolve box+piece (preferred) or derive from legacy `quantity`
      let boxPart = Number(parsed.data.box_qty ?? 0) || 0;
      let piecePart = Number(parsed.data.piece_qty ?? 0) || 0;
      if (boxPart === 0 && piecePart === 0) {
        const q = Number(parsed.data.quantity ?? 0) || 0;
        if (q <= 0) throw new Error('Quantity must be > 0');
        if (isTile) {
          boxPart = Math.floor(q);
          piecePart = Math.round((q - Math.floor(q)) * ppb);
        } else {
          piecePart = q;
        }
      }
      const totalPiecesDelta = boxPart * ppb + piecePart;
      if (totalPiecesDelta <= 0) throw new Error('Quantity must be > 0');

      const stock = await getOrCreateStockTrx(trx, product_id, dealerId);

      const sign = type === 'deduct' || type === 'broken' ? -1 : 1;
      const beforePieces = Number(stock.total_pieces ?? 0);
      const afterPieces = beforePieces + sign * totalPiecesDelta;
      if (afterPieces < 0) throw new Error(`Insufficient stock. Available: ${formatBoxPiece(beforePieces, ppb)}`);

      const updates: Record<string, number> = {
        total_pieces: Math.max(0, afterPieces),
      };

      if (isTile) {
        const perBoxSft = Number(product.per_box_sft ?? 0);
        const newBox = Math.floor(afterPieces / ppb);
        const newPiece = afterPieces - newBox * ppb;
        updates.box_qty = newBox;
        updates.piece_qty = newPiece;
        updates.sft_qty = newBox * perBoxSft;
      } else {
        updates.piece_qty = Math.max(0, afterPieces);
      }

      await trx('stock').where({ id: stock.id }).update(updates);

      // stock_ledger audit row
      await trx('stock_ledger').insert({
        dealer_id: dealerId,
        product_id,
        txn_type: type === 'broken' ? 'adj_broken' : `adj_${type}`,
        reference_table: 'stock',
        reference_id: stock.id,
        reference_no: null,
        box_qty: sign * boxPart,
        piece_qty: sign * piecePart,
        pieces_per_box: ppb,
        total_pieces: sign * totalPiecesDelta,
        stock_before_pieces: beforePieces,
        stock_after_pieces: Math.max(0, afterPieces),
        stock_before_display: formatBoxPiece(beforePieces, ppb),
        stock_after_display: formatBoxPiece(Math.max(0, afterPieces), ppb),
        created_by: req.user?.userId ?? null,
      });

      await trx('audit_logs').insert({
        dealer_id: dealerId,
        user_id: req.user?.userId ?? null,
        action: type === 'broken' ? 'stock_broken' : `stock_${type}`,
        table_name: 'stock',
        record_id: stock.id,
        old_data: {
          box_qty: stock.box_qty,
          piece_qty: stock.piece_qty,
          total_pieces: stock.total_pieces,
        },
        new_data: {
          ...updates,
          adjustment_type: type,
          box_qty_delta: sign * boxPart,
          piece_qty_delta: sign * piecePart,
          total_pieces_delta: sign * totalPiecesDelta,
          ...(reason ? { reason } : {}),
        },
      });
    });

    res.json({ ok: true });
  } catch (err: any) {
    console.error(`[adjustments/${type}]`, err.message);
    res.status(400).json({ error: err.message || 'Stock adjustment failed' });
  }
}

router.post('/add', (req, res) => applyChange('add', req, res));
router.post('/deduct', (req, res) => applyChange('deduct', req, res));
router.post('/restore', (req, res) => applyChange('restore', req, res));
router.post('/broken', (req, res) => applyChange('broken', req, res));

export default router;
