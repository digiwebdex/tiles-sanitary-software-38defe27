/**
 * HRM — employees, salary structures, monthly salary payments.
 *
 *   GET    /api/employees                        list
 *   POST   /api/employees                        create
 *   PUT    /api/employees/:id                    update
 *   DELETE /api/employees/:id                    soft delete (status=inactive)
 *   GET    /api/employees/:id/structure          current effective structure
 *   POST   /api/employees/:id/structure          add new structure (effective)
 *   GET    /api/employees/salary-payments?period=YYYY-MM
 *   POST   /api/employees/:id/salary-payments    disburse → cash/bank ledger
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
    res.status(403).json({ error: 'Only dealer_admin can manage HRM' });
    return false;
  }
  return true;
}

const EmployeeSchema = z.object({
  employee_code: z.string().max(30).optional().nullable(),
  name: z.string().min(1).max(120),
  designation: z.string().max(80).optional().nullable(),
  department: z.string().max(80).optional().nullable(),
  phone: z.string().max(30).optional().nullable(),
  email: z.string().max(120).optional().nullable(),
  nid: z.string().max(30).optional().nullable(),
  address: z.string().optional().nullable(),
  joining_date: z.string().optional().nullable(),
  status: z.enum(['active', 'inactive', 'terminated']).default('active'),
  notes: z.string().optional().nullable(),
});

const StructureSchema = z.object({
  basic: z.coerce.number().min(0).default(0),
  house_rent_pct: z.coerce.number().min(0).max(100).default(0),
  medical_pct: z.coerce.number().min(0).max(100).default(0),
  transport_pct: z.coerce.number().min(0).max(100).default(0),
  other_allowance: z.coerce.number().min(0).default(0),
  deduction: z.coerce.number().min(0).default(0),
  effective_from: z.string().optional(),
});

const PaymentSchema = z.object({
  period: z.string().regex(/^\d{4}-\d{2}$/),
  payment_method: z.enum(['cash', 'bank']).default('cash'),
  bank_account_id: z.string().uuid().optional().nullable(),
  payment_date: z.string().optional(),
  notes: z.string().optional().nullable(),
  // Optional snapshot overrides; if missing we derive from current structure
  basic: z.coerce.number().optional(),
  house_rent: z.coerce.number().optional(),
  medical: z.coerce.number().optional(),
  transport: z.coerce.number().optional(),
  other_allowance: z.coerce.number().optional(),
  deduction: z.coerce.number().optional(),
});

router.get('/', async (req, res) => {
  const dealerId = resolveDealer(req, res); if (!dealerId) return;
  const rows = await db('employees').where({ dealer_id: dealerId }).orderBy([{ column: 'status' }, { column: 'name' }]);
  res.json(rows);
});

router.post('/', async (req, res) => {
  const dealerId = resolveDealer(req, res); if (!dealerId) return;
  if (!requireAdmin(req, res)) return;
  const p = EmployeeSchema.safeParse(req.body);
  if (!p.success) { res.status(400).json({ error: p.error.flatten() }); return; }
  const [row] = await db('employees').insert({ dealer_id: dealerId, ...p.data }).returning('*');
  res.status(201).json(row);
});

router.put('/:id', async (req, res) => {
  const dealerId = resolveDealer(req, res); if (!dealerId) return;
  if (!requireAdmin(req, res)) return;
  const p = EmployeeSchema.partial().safeParse(req.body);
  if (!p.success) { res.status(400).json({ error: p.error.flatten() }); return; }
  const [row] = await db('employees')
    .where({ id: req.params.id, dealer_id: dealerId })
    .update({ ...p.data, updated_at: db.fn.now() })
    .returning('*');
  if (!row) { res.status(404).json({ error: 'Not found' }); return; }
  res.json(row);
});

router.delete('/:id', async (req, res) => {
  const dealerId = resolveDealer(req, res); if (!dealerId) return;
  if (!requireAdmin(req, res)) return;
  await db('employees').where({ id: req.params.id, dealer_id: dealerId })
    .update({ status: 'inactive', updated_at: db.fn.now() });
  res.status(204).end();
});

router.get('/:id/structure', async (req, res) => {
  const dealerId = resolveDealer(req, res); if (!dealerId) return;
  const row = await db('salary_structures')
    .where({ dealer_id: dealerId, employee_id: req.params.id })
    .orderBy('effective_from', 'desc').first();
  res.json(row || null);
});

router.post('/:id/structure', async (req, res) => {
  const dealerId = resolveDealer(req, res); if (!dealerId) return;
  if (!requireAdmin(req, res)) return;
  const p = StructureSchema.safeParse(req.body);
  if (!p.success) { res.status(400).json({ error: p.error.flatten() }); return; }
  const [row] = await db('salary_structures').insert({
    dealer_id: dealerId, employee_id: req.params.id, ...p.data,
  }).returning('*');
  res.status(201).json(row);
});

router.get('/salary-payments', async (req, res) => {
  const dealerId = resolveDealer(req, res); if (!dealerId) return;
  if (!requireAdmin(req, res)) return;
  const period = req.query.period as string | undefined;
  const q = db('salary_payments as sp')
    .leftJoin('employees as e', 'e.id', 'sp.employee_id')
    .where('sp.dealer_id', dealerId)
    .select('sp.*', 'e.name as employee_name', 'e.designation')
    .orderBy('sp.payment_date', 'desc');
  if (period) q.where('sp.period', period);
  const rows = await q;
  res.json(rows);
});

router.post('/:id/salary-payments', async (req, res) => {
  const dealerId = resolveDealer(req, res); if (!dealerId) return;
  if (!requireAdmin(req, res)) return;
  const p = PaymentSchema.safeParse(req.body);
  if (!p.success) { res.status(400).json({ error: p.error.flatten() }); return; }

  const employeeId = req.params.id;
  const struct = await db('salary_structures')
    .where({ dealer_id: dealerId, employee_id: employeeId })
    .orderBy('effective_from', 'desc').first();

  const basic = p.data.basic ?? Number(struct?.basic ?? 0);
  const house_rent = p.data.house_rent ?? (basic * Number(struct?.house_rent_pct ?? 0) / 100);
  const medical = p.data.medical ?? (basic * Number(struct?.medical_pct ?? 0) / 100);
  const transport = p.data.transport ?? (basic * Number(struct?.transport_pct ?? 0) / 100);
  const other_allowance = p.data.other_allowance ?? Number(struct?.other_allowance ?? 0);
  const deduction = p.data.deduction ?? Number(struct?.deduction ?? 0);
  const net_payable = +(basic + house_rent + medical + transport + other_allowance - deduction).toFixed(2);

  if (net_payable <= 0) { res.status(400).json({ error: 'Net payable must be positive' }); return; }

  const trx = await db.transaction();
  try {
    const [row] = await trx('salary_payments').insert({
      dealer_id: dealerId, employee_id: employeeId,
      period: p.data.period,
      basic, house_rent, medical, transport, other_allowance, deduction, net_payable,
      payment_method: p.data.payment_method,
      bank_account_id: p.data.payment_method === 'bank' ? (p.data.bank_account_id ?? null) : null,
      payment_date: p.data.payment_date ?? trx.fn.now(),
      notes: p.data.notes ?? null,
      created_by: req.user?.userId ?? null,
    }).returning('*');

    const emp = await trx('employees').where({ id: employeeId }).first();
    const desc = `Salary ${p.data.period} — ${emp?.name ?? 'Employee'}`;

    if (p.data.payment_method === 'bank') {
      if (!p.data.bank_account_id) throw new Error('bank_account_id required for bank payment');
      await trx('bank_ledger').insert({
        dealer_id: dealerId, bank_account_id: p.data.bank_account_id,
        type: 'salary', amount: -net_payable, description: desc,
        reference_type: 'salary_payment', reference_id: row.id,
        entry_date: row.payment_date, created_by: req.user?.userId ?? null,
      });
    } else {
      await trx('cash_ledger').insert({
        dealer_id: dealerId, type: 'salary', amount: -net_payable, description: desc,
        reference_type: 'salary_payment', reference_id: row.id,
        entry_date: row.payment_date, created_by: req.user?.userId ?? null,
      });
    }
    await trx.commit();
    res.status(201).json(row);
  } catch (e: any) {
    await trx.rollback();
    if (String(e.message).includes('duplicate key')) {
      res.status(409).json({ error: 'Salary already paid for this period' });
      return;
    }
    res.status(500).json({ error: e.message });
  }
});

export default router;
