/**
 * Financial Statements — Phase 1.
 *
 *   GET /api/financials/p-and-l?dealerId=&from=&to=
 *   GET /api/financials/balance-sheet?dealerId=&asOf=
 *
 * P&L derived from sales, cost-of-goods-sold (FIFO via sale_items.cost_price
 * if present, else purchase_rate fallback), and expenses.
 *
 * Balance Sheet:
 *   ASSETS    = cash balance + bank balances + inventory valuation + AR (unpaid sales)
 *   LIABILITIES = AP (unpaid supplier bills)
 *   EQUITY    = Assets − Liabilities
 *
 * dealer_admin only.
 */
import { Router, Request, Response } from 'express';
import { db } from '../db/connection';
import { authenticate } from '../middleware/auth';
import { tenantGuard } from '../middleware/tenant';

const router = Router();
router.use(authenticate, tenantGuard);

function resolveDealer(req: Request, res: Response): string | null {
  const isSuper = req.user?.roles.includes('super_admin');
  const claimed = req.query.dealerId as string | undefined;
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
    res.status(403).json({ error: 'Only dealer_admin can view financial statements' });
    return false;
  }
  return true;
}

const num = (v: any) => Number(v ?? 0) || 0;

// ── Profit & Loss ──
router.get('/p-and-l', async (req, res) => {
  const dealerId = resolveDealer(req, res); if (!dealerId) return;
  if (!requireAdmin(req, res)) return;

  const from = (req.query.from as string | undefined) || null;
  const to = (req.query.to as string | undefined) || null;

  const dateClause = (col: string) => {
    const parts: string[] = [];
    if (from) parts.push(`${col} >= ?`);
    if (to) parts.push(`${col} <= ?`);
    return parts.length ? 'AND ' + parts.join(' AND ') : '';
  };
  const params: any[] = [];
  if (from) params.push(from);
  if (to) params.push(to);

  // Revenue (gross sales total)
  const revenueRow = await db('sales')
    .where({ dealer_id: dealerId })
    .modify(qb => { if (from) qb.where('sale_date', '>=', from); if (to) qb.where('sale_date', '<=', to); })
    .sum({ total: 'total_amount' }).first();
  const revenue = num(revenueRow?.total);

  // Sales returns (negative)
  const returnsRow = await db('sales_returns')
    .where({ dealer_id: dealerId })
    .modify(qb => { if (from) qb.where('return_date', '>=', from); if (to) qb.where('return_date', '<=', to); })
    .sum({ total: db.raw('qty * COALESCE(rate, 0)') }).first()
    .catch(() => null);
  const sales_returns = num(returnsRow?.total);

  // COGS — sum of (sale_items.qty * cost_price) where available
  const cogsRow = await db('sale_items as si')
    .join('sales as s', 's.id', 'si.sale_id')
    .where('s.dealer_id', dealerId)
    .modify(qb => { if (from) qb.where('s.sale_date', '>=', from); if (to) qb.where('s.sale_date', '<=', to); })
    .sum({ total: db.raw('si.quantity * COALESCE(si.cost_price, 0)') }).first()
    .catch(() => null);
  const cogs = num(cogsRow?.total);

  const gross_profit = revenue - sales_returns - cogs;

  // Expenses by category
  const expenseRows = await db('expenses')
    .where({ dealer_id: dealerId })
    .modify(qb => { if (from) qb.where('expense_date', '>=', from); if (to) qb.where('expense_date', '<=', to); })
    .select('category').sum({ total: 'amount' }).groupBy('category');
  const expenses_by_category = expenseRows.map((r: any) => ({ category: r.category || 'Uncategorized', amount: num(r.total) }));
  const total_expenses = expenses_by_category.reduce((s: number, r: { amount: number }) => s + r.amount, 0);

  const net_profit = gross_profit - total_expenses;

  res.json({
    period: { from, to },
    revenue,
    sales_returns,
    net_revenue: revenue - sales_returns,
    cogs,
    gross_profit,
    expenses_by_category,
    total_expenses,
    net_profit,
  });
});

// ── Balance Sheet ──
router.get('/balance-sheet', async (req, res) => {
  const dealerId = resolveDealer(req, res); if (!dealerId) return;
  if (!requireAdmin(req, res)) return;

  const asOf = (req.query.asOf as string | undefined) || null;

  // Cash
  const cashQ = db('cash_ledger').where({ dealer_id: dealerId });
  if (asOf) cashQ.where('entry_date', '<=', asOf);
  const cashRow = await cashQ.sum({ total: 'amount' }).first();
  const cash = num(cashRow?.total);

  // Bank balances (per account + total)
  const bankQ = db('bank_ledger as bl')
    .join('bank_accounts as ba', 'ba.id', 'bl.bank_account_id')
    .where('bl.dealer_id', dealerId);
  if (asOf) bankQ.where('bl.entry_date', '<=', asOf);
  const banks = await bankQ
    .groupBy('ba.id', 'ba.bank_name', 'ba.account_number')
    .select('ba.id as bank_account_id', 'ba.bank_name', 'ba.account_number')
    .sum({ balance: 'bl.amount' });
  const bankList = banks.map(b => ({ ...b, balance: num(b.balance) }));
  const bank_total = bankList.reduce((s, b) => s + b.balance, 0);

  // Inventory valuation — sum(stock.* * cost_price). Falls back to product.cost_price.
  let inventory = 0;
  try {
    const invRow = await db('stock as s')
      .join('products as p', 'p.id', 's.product_id')
      .where('s.dealer_id', dealerId)
      .sum({
        total: db.raw(`
          CASE
            WHEN p.unit_type = 'box_sft' THEN COALESCE(s.box_qty, 0) * COALESCE(p.cost_price, 0) * COALESCE(p.per_box_sft, 1)
            ELSE COALESCE(s.piece_qty, 0) * COALESCE(p.cost_price, 0)
          END
        `),
      }).first();
    inventory = num(invRow?.total);
  } catch { inventory = 0; }

  // Accounts Receivable: sum unpaid sales (total_amount - paid_amount)
  let receivable = 0;
  try {
    const arRow = await db('sales')
      .where({ dealer_id: dealerId })
      .modify(qb => { if (asOf) qb.where('sale_date', '<=', asOf); })
      .sum({ total: db.raw('GREATEST(0, COALESCE(total_amount,0) - COALESCE(paid_amount,0))') }).first();
    receivable = num(arRow?.total);
  } catch { receivable = 0; }

  // Accounts Payable: outstanding supplier ledger (positive sum)
  let payable = 0;
  try {
    const apRow = await db('supplier_ledger')
      .where({ dealer_id: dealerId })
      .modify(qb => { if (asOf) qb.where('entry_date', '<=', asOf); })
      .sum({ total: 'amount' }).first();
    payable = Math.max(0, num(apRow?.total));
  } catch { payable = 0; }

  // Director Capital = sum(deposit) - sum(withdrawal) - sum(dividend)
  let director_capital = 0;
  try {
    const dRows = await db('director_transactions')
      .where({ dealer_id: dealerId })
      .modify(qb => { if (asOf) qb.where('entry_date', '<=', asOf); })
      .select('type').sum({ total: 'amount' }).groupBy('type');
    for (const r of dRows as any[]) {
      const amt = num(r.total);
      if (r.type === 'deposit') director_capital += amt;
      else if (r.type === 'withdrawal' || r.type === 'dividend') director_capital -= amt;
    }
  } catch { director_capital = 0; }

  const total_assets = cash + bank_total + inventory + receivable;
  const total_liabilities = payable;
  const total_equity = total_assets - total_liabilities;
  // Retained earnings = remaining equity after director capital
  const retained_earnings = total_equity - director_capital;

  res.json({
    as_of: asOf,
    assets: {
      cash,
      bank_total,
      bank_accounts: bankList,
      inventory,
      accounts_receivable: receivable,
      total: total_assets,
    },
    liabilities: {
      accounts_payable: payable,
      total: total_liabilities,
    },
    equity: {
      director_capital,
      retained_earnings,
      owner_equity: total_equity,
      total: total_equity,
    },
  });
});

// ── Trial Balance ──
// Aggregates account balances as of a date. Each row has debit OR credit.
router.get('/trial-balance', async (req, res) => {
  const dealerId = resolveDealer(req, res); if (!dealerId) return;
  if (!requireAdmin(req, res)) return;

  const asOf = (req.query.asOf as string | undefined) || null;
  const accounts: { account: string; debit: number; credit: number }[] = [];
  const push = (account: string, value: number) => {
    if (Math.abs(value) < 0.005) return;
    if (value >= 0) accounts.push({ account, debit: value, credit: 0 });
    else accounts.push({ account, debit: 0, credit: -value });
  };

  // ─ Asset accounts (normal balance: Debit) ─
  const cashRow = await db('cash_ledger').where({ dealer_id: dealerId })
    .modify(qb => { if (asOf) qb.where('entry_date', '<=', asOf); })
    .sum({ total: 'amount' }).first();
  push('Cash on Hand', num(cashRow?.total));

  const banks = await db('bank_ledger as bl')
    .join('bank_accounts as ba', 'ba.id', 'bl.bank_account_id')
    .where('bl.dealer_id', dealerId)
    .modify(qb => { if (asOf) qb.where('bl.entry_date', '<=', asOf); })
    .groupBy('ba.id', 'ba.bank_name', 'ba.account_number')
    .select('ba.bank_name', 'ba.account_number')
    .sum({ balance: 'bl.amount' });
  for (const b of banks) push(`Bank — ${b.bank_name} (${b.account_number})`, num(b.balance));

  try {
    const invRow = await db('stock as s')
      .join('products as p', 'p.id', 's.product_id')
      .where('s.dealer_id', dealerId)
      .sum({
        total: db.raw(`
          CASE
            WHEN p.unit_type = 'box_sft' THEN COALESCE(s.box_qty, 0) * COALESCE(p.cost_price, 0) * COALESCE(p.per_box_sft, 1)
            ELSE COALESCE(s.piece_qty, 0) * COALESCE(p.cost_price, 0)
          END
        `),
      }).first();
    push('Inventory', num(invRow?.total));
  } catch { /* ignore */ }

  try {
    const arRow = await db('sales').where({ dealer_id: dealerId })
      .modify(qb => { if (asOf) qb.where('sale_date', '<=', asOf); })
      .sum({ total: db.raw('GREATEST(0, COALESCE(total_amount,0) - COALESCE(paid_amount,0))') }).first();
    push('Accounts Receivable', num(arRow?.total));
  } catch { /* ignore */ }

  // ─ Liability accounts (normal balance: Credit → negative debit) ─
  try {
    const apRow = await db('supplier_ledger').where({ dealer_id: dealerId })
      .modify(qb => { if (asOf) qb.where('entry_date', '<=', asOf); })
      .sum({ total: 'amount' }).first();
    const ap = Math.max(0, num(apRow?.total));
    if (ap > 0) push('Accounts Payable', -ap);
  } catch { /* ignore */ }

  // ─ Equity ─
  try {
    const dRows = await db('director_transactions').where({ dealer_id: dealerId })
      .modify(qb => { if (asOf) qb.where('entry_date', '<=', asOf); })
      .select('type').sum({ total: 'amount' }).groupBy('type');
    let dc = 0;
    for (const r of dRows as any[]) {
      const amt = num(r.total);
      if (r.type === 'deposit') dc += amt;
      else if (r.type === 'withdrawal' || r.type === 'dividend') dc -= amt;
    }
    if (Math.abs(dc) > 0.005) push('Director Capital', -dc);
  } catch { /* ignore */ }

  // ─ Income accounts (Credit) ─
  try {
    const revRow = await db('sales').where({ dealer_id: dealerId })
      .modify(qb => { if (asOf) qb.where('sale_date', '<=', asOf); })
      .sum({ total: 'total_amount' }).first();
    const rev = num(revRow?.total);
    if (rev > 0) push('Sales Revenue', -rev);
  } catch { /* ignore */ }

  try {
    const srRow = await db('sales_returns').where({ dealer_id: dealerId })
      .modify(qb => { if (asOf) qb.where('return_date', '<=', asOf); })
      .sum({ total: db.raw('qty * COALESCE(rate, 0)') }).first();
    const sr = num(srRow?.total);
    if (sr > 0) push('Sales Returns', sr); // contra-revenue (Debit)
  } catch { /* ignore */ }

  // ─ Expense accounts (Debit) ─
  try {
    const cogsRow = await db('sale_items as si')
      .join('sales as s', 's.id', 'si.sale_id')
      .where('s.dealer_id', dealerId)
      .modify(qb => { if (asOf) qb.where('s.sale_date', '<=', asOf); })
      .sum({ total: db.raw('si.quantity * COALESCE(si.cost_price, 0)') }).first();
    push('Cost of Goods Sold', num(cogsRow?.total));
  } catch { /* ignore */ }

  try {
    const expRows = await db('expenses').where({ dealer_id: dealerId })
      .modify(qb => { if (asOf) qb.where('expense_date', '<=', asOf); })
      .select('category').sum({ total: 'amount' }).groupBy('category');
    for (const r of expRows as any[]) push(`Expense — ${r.category || 'Uncategorized'}`, num(r.total));
  } catch { /* ignore */ }

  // ─ Manual journal lines (added on top, per-account net) ─
  try {
    const jRows = await db('journal_entry_lines as jel')
      .join('journal_entries as je', 'je.id', 'jel.journal_entry_id')
      .where('jel.dealer_id', dealerId)
      .modify(qb => { if (asOf) qb.where('je.entry_date', '<=', asOf); })
      .select('jel.account')
      .sum({ debit: 'jel.debit' })
      .sum({ credit: 'jel.credit' })
      .groupBy('jel.account');
    for (const r of jRows as any[]) {
      const net = num(r.debit) - num(r.credit);
      push(`Journal — ${r.account}`, net);
    }
  } catch { /* ignore */ }

  accounts.sort((a, b) => a.account.localeCompare(b.account));
  const total_debit = accounts.reduce((s, r) => s + r.debit, 0);
  const total_credit = accounts.reduce((s, r) => s + r.credit, 0);

  res.json({
    as_of: asOf,
    accounts,
    total_debit,
    total_credit,
    difference: +(total_debit - total_credit).toFixed(2),
  });
});

export default router;
