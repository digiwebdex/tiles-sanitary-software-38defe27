/**
 * Directors / Investors register + transactions.
 *
 *   GET    /api/directors                  list
 *   POST   /api/directors                  create
 *   PUT    /api/directors/:id              update
 *   DELETE /api/directors/:id              soft delete (is_active=false)
 *   GET    /api/directors/:id/transactions
 *   POST   /api/directors/:id/transactions    type: deposit|withdrawal|dividend
 *   GET    /api/directors/equity-summary       per-director net contribution
 *
 * dealer_admin only.
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
  const claimed = (req.query.dealerId as string | undefined) || (req.body?.dealer_id as string | undefined);
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
    res.status(403).json({ error: 'Only dealer_admin can manage directors' });
    return false;
  }
  return true;
}

const DirectorSchema = z.object({
  name: z.string().min(1).max(120),
  role: z.string().max(60).optional().nullable(),
  phone: z.string().max(30).optional().nullable(),
  email: z.string().max(120).optional().nullable(),
  address: z.string().optional().nullable(),
  share_pct: z.coerce.number().min(0).max(100).default(0),
  is_active: z.boolean().default(true),
  notes: z.string().optional().nullable(),
});

const TxnSchema = z.object({
  type: z.enum(['deposit', 'withdrawal', 'dividend']),
  amount: z.coerce.number().positive(),
  payment_method: z.enum(['cash', 'bank']).default('cash'),
  bank_account_id: z.string().uuid().optional().nullable(),
  entry_date: z.string().optional(),
  description: z.string().optional().nullable(),
});

router.get('/', async (req, res) => {
  const dealerId = resolveDealer(req, res); if (!dealerId) return;
  if (!requireAdmin(req, res)) return;
  const rows = await db('directors').where({ dealer_id: dealerId })
    .orderBy([{ column: 'is_active', order: 'desc' }, { column: 'name' }]);
  res.json(rows);
});

router.get('/equity-summary', async (req, res) => {
  const dealerId = resolveDealer(req, res); if (!dealerId) return;
  if (!requireAdmin(req, res)) return;
  const directors = await db('directors').where({ dealer_id: dealerId });
  const sums = await db('director_transactions')
    .select('director_id', 'type').sum({ total: 'amount' })
    .where({ dealer_id: dealerId })
    .groupBy('director_id', 'type');
  const map: Record<string, { deposit: number; withdrawal: number; dividend: number }> = {};
  for (const s of sums as any[]) {
    map[s.director_id] = map[s.director_id] || { deposit: 0, withdrawal: 0, dividend: 0 };
    (map[s.director_id] as any)[s.type] = Number(s.total) || 0;
  }
  const rows = directors.map((d: any) => {
    const m = map[d.id] || { deposit: 0, withdrawal: 0, dividend: 0 };
    const net = m.deposit - m.withdrawal - m.dividend;
    return { ...d, deposit: m.deposit, withdrawal: m.withdrawal, dividend: m.dividend, net_equity: net };
  });
  res.json(rows);
});

router.post('/', async (req, res) => {
  const dealerId = resolveDealer(req, res); if (!dealerId) return;
  if (!requireAdmin(req, res)) return;
  const p = DirectorSchema.safeParse(req.body);
  if (!p.success) { res.status(400).json({ error: p.error.flatten() }); return; }
  const [row] = await db('directors').insert({ dealer_id: dealerId, ...p.data }).returning('*');
  res.status(201).json(row);
});

router.put('/:id', async (req, res) => {
  const dealerId = resolveDealer(req, res); if (!dealerId) return;
  if (!requireAdmin(req, res)) return;
  const p = DirectorSchema.partial().safeParse(req.body);
  if (!p.success) { res.status(400).json({ error: p.error.flatten() }); return; }
  const [row] = await db('directors').where({ id: req.params.id, dealer_id: dealerId })
    .update({ ...p.data, updated_at: db.fn.now() }).returning('*');
  if (!row) { res.status(404).json({ error: 'Not found' }); return; }
  res.json(row);
});

router.delete('/:id', async (req, res) => {
  const dealerId = resolveDealer(req, res); if (!dealerId) return;
  if (!requireAdmin(req, res)) return;
  await db('directors').where({ id: req.params.id, dealer_id: dealerId })
    .update({ is_active: false, updated_at: db.fn.now() });
  res.status(204).end();
});

router.get('/:id/transactions', async (req, res) => {
  const dealerId = resolveDealer(req, res); if (!dealerId) return;
  if (!requireAdmin(req, res)) return;
  const rows = await db('director_transactions')
    .where({ dealer_id: dealerId, director_id: req.params.id })
    .orderBy('entry_date', 'desc');
  res.json(rows);
});

router.post('/:id/transactions', async (req, res) => {
  const dealerId = resolveDealer(req, res); if (!dealerId) return;
  if (!requireAdmin(req, res)) return;
  const p = TxnSchema.safeParse(req.body);
  if (!p.success) { res.status(400).json({ error: p.error.flatten() }); return; }

  const directorId = req.params.id;
  const director = await db('directors').where({ id: directorId, dealer_id: dealerId }).first();
  if (!director) { res.status(404).json({ error: 'Director not found' }); return; }

  const trx = await db.transaction();
  try {
    const [row] = await trx('director_transactions').insert({
      dealer_id: dealerId, director_id: directorId,
      type: p.data.type, amount: p.data.amount,
      payment_method: p.data.payment_method,
      bank_account_id: p.data.payment_method === 'bank' ? (p.data.bank_account_id ?? null) : null,
      entry_date: p.data.entry_date ?? trx.fn.now(),
      description: p.data.description ?? null,
      created_by: req.user?.userId ?? null,
    }).returning('*');

    // Cashbook posting: deposit = +inflow, withdrawal/dividend = -outflow
    const sign = p.data.type === 'deposit' ? 1 : -1;
    const amt = sign * p.data.amount;
    const desc = `${p.data.type.toUpperCase()} — ${director.name}`;

    if (p.data.payment_method === 'bank') {
      if (!p.data.bank_account_id) throw new Error('bank_account_id required');
      await trx('bank_ledger').insert({
        dealer_id: dealerId, bank_account_id: p.data.bank_account_id,
        type: `director_${p.data.type}`, amount: amt, description: desc,
        reference_type: 'director_transaction', reference_id: row.id,
        entry_date: row.entry_date, created_by: req.user?.userId ?? null,
      });
    } else {
      await trx('cash_ledger').insert({
        dealer_id: dealerId, type: `director_${p.data.type}`, amount: amt, description: desc,
        reference_type: 'director_transaction', reference_id: row.id,
        entry_date: row.entry_date, created_by: req.user?.userId ?? null,
      });
    }
    await trx.commit();
    res.status(201).json(row);
  } catch (e: any) {
    await trx.rollback();
    res.status(500).json({ error: e.message });
  }
});

export default router;
