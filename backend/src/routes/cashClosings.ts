/**
 * Daily Cash Closing — end-of-day forced reconciliation.
 *
 *   GET    /api/cash-closings?dealerId=&from=&to=    — list
 *   GET    /api/cash-closings/today?dealerId=&date=  — preview for a date (system in/out, opening, expected)
 *   POST   /api/cash-closings                        — submit a closing
 *   POST   /api/cash-closings/:id/approve            — dealer_admin approves
 *   POST   /api/cash-closings/:id/reject             — dealer_admin rejects (allows re-submit)
 *
 * dealer_admin only. Once approved, a day is locked.
 */
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { db } from '../db/connection';
import { authenticate } from '../middleware/auth';
import { tenantGuard } from '../middleware/tenant';

const router = Router();
router.use(authenticate, tenantGuard);

function resolveDealer(req: Request, res: Response): string | null {
  const isSuper = req.user?.roles.includes('super_admin');
  const claimed = (req.query.dealerId as string | undefined) ?? (req.body?.dealerId as string | undefined);
  if (isSuper) {
    if (!claimed) { res.status(400).json({ error: 'super_admin must specify dealerId' }); return null; }
    return claimed;
  }
  if (!req.dealerId) { res.status(403).json({ error: 'No dealer assigned' }); return null; }
  if (claimed && claimed !== req.dealerId) { res.status(403).json({ error: 'dealerId mismatch' }); return null; }
  return req.dealerId;
}

function requireAdmin(req: Request, res: Response): boolean {
  const roles = (req.user?.roles ?? []) as string[];
  if (!roles.includes('dealer_admin') && !roles.includes('super_admin')) {
    res.status(403).json({ error: 'Only dealer_admin can manage cash closings' });
    return false;
  }
  return true;
}

async function computeDayPreview(dealerId: string, date: string) {
  // Opening = last approved closing's counted_cash before this date,
  // or sum of cash_ledger entries before this date if no prior closing exists.
  const lastApproved = await db('cash_closings')
    .where({ dealer_id: dealerId, status: 'approved' })
    .andWhere('closing_date', '<', date)
    .orderBy('closing_date', 'desc')
    .first();

  let opening = 0;
  if (lastApproved) {
    opening = Number(lastApproved.counted_cash) || 0;
    // Plus any cash_ledger entries strictly after that closing_date and before our date
    const between = await db('cash_ledger')
      .where({ dealer_id: dealerId })
      .andWhere('entry_date', '>', lastApproved.closing_date)
      .andWhere('entry_date', '<', date)
      .sum({ total: 'amount' }).first();
    opening += Number(between?.total) || 0;
  } else {
    const before = await db('cash_ledger')
      .where({ dealer_id: dealerId })
      .andWhere('entry_date', '<', date)
      .sum({ total: 'amount' }).first();
    opening = Number(before?.total) || 0;
  }

  // Today's cash movement
  const todays = await db('cash_ledger')
    .where({ dealer_id: dealerId, entry_date: date });
  let inAmt = 0, outAmt = 0;
  for (const r of todays) {
    const a = Number(r.amount) || 0;
    if (a >= 0) inAmt += a; else outAmt += Math.abs(a);
  }
  const expected = opening + inAmt - outAmt;
  return { opening, system_cash_in: inAmt, system_cash_out: outAmt, expected_closing: expected };
}

// ── GET list ──
router.get('/', async (req, res) => {
  const dealerId = resolveDealer(req, res); if (!dealerId) return;
  if (!requireAdmin(req, res)) return;
  const from = req.query.from as string | undefined;
  const to = req.query.to as string | undefined;
  const q = db('cash_closings').where({ dealer_id: dealerId });
  if (from) q.where('closing_date', '>=', from);
  if (to) q.where('closing_date', '<=', to);
  const rows = await q.orderBy('closing_date', 'desc').limit(200);
  res.json({ rows: rows.map(r => ({
    ...r,
    opening_cash: Number(r.opening_cash),
    system_cash_in: Number(r.system_cash_in),
    system_cash_out: Number(r.system_cash_out),
    expected_closing: Number(r.expected_closing),
    counted_cash: Number(r.counted_cash),
    variance: Number(r.variance),
  })) });
});

// ── GET today / preview ──
router.get('/today', async (req, res) => {
  const dealerId = resolveDealer(req, res); if (!dealerId) return;
  if (!requireAdmin(req, res)) return;
  const date = (req.query.date as string | undefined) || new Date().toISOString().slice(0, 10);

  const existing = await db('cash_closings')
    .where({ dealer_id: dealerId, closing_date: date }).first();

  const preview = await computeDayPreview(dealerId, date);
  res.json({ date, preview, existing: existing ? {
    ...existing,
    opening_cash: Number(existing.opening_cash),
    system_cash_in: Number(existing.system_cash_in),
    system_cash_out: Number(existing.system_cash_out),
    expected_closing: Number(existing.expected_closing),
    counted_cash: Number(existing.counted_cash),
    variance: Number(existing.variance),
  } : null });
});

// ── POST submit ──
const SubmitSchema = z.object({
  dealerId: z.string().uuid().optional(),
  closing_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  counted_cash: z.coerce.number().min(0),
  denominations: z.record(z.string(), z.coerce.number().int().min(0)).optional().default({}),
  variance_reason: z.string().max(500).optional(),
  notes: z.string().max(1000).optional(),
});

router.post('/', async (req, res) => {
  const dealerId = resolveDealer(req, res); if (!dealerId) return;
  if (!requireAdmin(req, res)) return;
  const parsed = SubmitSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten().fieldErrors });
  const { closing_date, counted_cash, denominations, variance_reason, notes } = parsed.data;

  // Check existing
  const existing = await db('cash_closings').where({ dealer_id: dealerId, closing_date }).first();
  if (existing && existing.status === 'approved') {
    return res.status(409).json({ error: 'This day is already approved and locked' });
  }

  const preview = await computeDayPreview(dealerId, closing_date);
  const variance = Number((counted_cash - preview.expected_closing).toFixed(2));

  if (Math.abs(variance) > 0.005 && !variance_reason) {
    return res.status(400).json({ error: 'Variance reason is required when counted cash differs from expected' });
  }

  const row = {
    dealer_id: dealerId,
    closing_date,
    opening_cash: preview.opening,
    system_cash_in: preview.system_cash_in,
    system_cash_out: preview.system_cash_out,
    expected_closing: preview.expected_closing,
    counted_cash,
    denominations: JSON.stringify(denominations || {}),
    variance,
    variance_reason: variance_reason ?? null,
    notes: notes ?? null,
    status: 'submitted',
    submitted_by: req.user?.id ?? null,
    submitted_at: db.fn.now() as any,
    approved_by: null,
    approved_at: null,
    approval_note: null,
  };

  let saved;
  if (existing) {
    [saved] = await db('cash_closings').where({ id: existing.id }).update(row).returning('*');
  } else {
    [saved] = await db('cash_closings').insert(row).returning('*');
  }

  // Audit
  await db('audit_logs').insert({
    dealer_id: dealerId,
    user_id: req.user?.id ?? null,
    action: existing ? 'CASH_CLOSING_RESUBMITTED' : 'CASH_CLOSING_SUBMITTED',
    table_name: 'cash_closings',
    record_id: saved.id,
    new_data: JSON.stringify({ closing_date, counted_cash, variance, variance_reason }),
  }).catch(() => {});

  res.json({ row: saved });
});

// ── POST approve ──
router.post('/:id/approve', async (req, res) => {
  const dealerId = resolveDealer(req, res); if (!dealerId) return;
  if (!requireAdmin(req, res)) return;
  const note = (req.body?.note as string | undefined) ?? null;

  const existing = await db('cash_closings').where({ id: req.params.id, dealer_id: dealerId }).first();
  if (!existing) return res.status(404).json({ error: 'Closing not found' });
  if (existing.status === 'approved') return res.status(409).json({ error: 'Already approved' });

  const [updated] = await db('cash_closings').where({ id: req.params.id })
    .update({
      status: 'approved',
      approved_by: req.user?.id ?? null,
      approved_at: db.fn.now() as any,
      approval_note: note,
    }).returning('*');

  await db('audit_logs').insert({
    dealer_id: dealerId,
    user_id: req.user?.id ?? null,
    action: 'CASH_CLOSING_APPROVED',
    table_name: 'cash_closings',
    record_id: updated.id,
    new_data: JSON.stringify({ closing_date: updated.closing_date, variance: Number(updated.variance), note }),
  }).catch(() => {});

  res.json({ row: updated });
});

// ── POST reject ──
router.post('/:id/reject', async (req, res) => {
  const dealerId = resolveDealer(req, res); if (!dealerId) return;
  if (!requireAdmin(req, res)) return;
  const note = (req.body?.note as string | undefined) ?? null;

  const existing = await db('cash_closings').where({ id: req.params.id, dealer_id: dealerId }).first();
  if (!existing) return res.status(404).json({ error: 'Closing not found' });
  if (existing.status === 'approved') return res.status(409).json({ error: 'Cannot reject an approved closing' });

  const [updated] = await db('cash_closings').where({ id: req.params.id })
    .update({ status: 'rejected', approval_note: note }).returning('*');

  await db('audit_logs').insert({
    dealer_id: dealerId,
    user_id: req.user?.id ?? null,
    action: 'CASH_CLOSING_REJECTED',
    table_name: 'cash_closings',
    record_id: updated.id,
    new_data: JSON.stringify({ closing_date: updated.closing_date, note }),
  }).catch(() => {});

  res.json({ row: updated });
});

export default router;
