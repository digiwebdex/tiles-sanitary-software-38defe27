/**
 * Dealer Data Export & Restore — per-table CSV download for the
 * authenticated dealer's tenant. Read-only export of dealer-scoped tables.
 *
 *   GET /api/data-export/manifest          → [{ key, label, table, rows }]
 *   GET /api/data-export/:key.csv          → CSV file for that table
 *
 * Restore (CSV upload) is delegated to the existing /api/imports/* routes
 * for products / customers / suppliers.
 */
import { Router, Request, Response } from 'express';
import { db } from '../db/connection';
import { authenticate } from '../middleware/auth';
import { tenantGuard } from '../middleware/tenant';
import { requireRole } from '../middleware/roles';

const router = Router();
router.use(authenticate, tenantGuard, requireRole('dealer_admin'));

interface ExportSpec {
  key: string;
  label: string;
  table: string;
}

const EXPORTS: ExportSpec[] = [
  { key: 'customers', label: 'Customers', table: 'customers' },
  { key: 'suppliers', label: 'Suppliers', table: 'suppliers' },
  { key: 'products', label: 'Products', table: 'products' },
  { key: 'product_batches', label: 'Product Batches', table: 'product_batches' },
  { key: 'stock', label: 'Stock', table: 'stock' },
  { key: 'sales', label: 'Sales', table: 'sales' },
  { key: 'sale_items', label: 'Sale Items', table: 'sale_items' },
  { key: 'purchases', label: 'Purchases', table: 'purchases' },
  { key: 'purchase_items', label: 'Purchase Items', table: 'purchase_items' },
  { key: 'deliveries', label: 'Deliveries', table: 'deliveries' },
  { key: 'challans', label: 'Challans', table: 'challans' },
  { key: 'expenses', label: 'Expenses', table: 'expenses' },
  { key: 'customer_ledger', label: 'Customer Ledger', table: 'customer_ledger' },
  { key: 'supplier_ledger', label: 'Supplier Ledger', table: 'supplier_ledger' },
  { key: 'cash_ledger', label: 'Cash Ledger', table: 'cash_ledger' },
  { key: 'sales_returns', label: 'Sales Returns', table: 'sales_returns' },
  { key: 'purchase_returns', label: 'Purchase Returns', table: 'purchase_returns' },
  { key: 'quotations', label: 'Quotations', table: 'quotations' },
];

function resolveDealer(req: Request, res: Response): string | null {
  if (!req.dealerId) {
    res.status(403).json({ error: 'No dealer assigned to your account' });
    return null;
  }
  return req.dealerId;
}

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return '';
  let s: string;
  if (v instanceof Date) s = v.toISOString();
  else if (typeof v === 'object') s = JSON.stringify(v);
  else s = String(v);
  if (/[",\n\r]/.test(s)) {
    s = '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

router.get('/manifest', async (req: Request, res: Response) => {
  const dealerId = resolveDealer(req, res);
  if (!dealerId) return;
  const out: Array<ExportSpec & { rows: number }> = [];
  for (const spec of EXPORTS) {
    try {
      const r = await db(spec.table).where({ dealer_id: dealerId }).count<{ count: string }>('* as count').first();
      out.push({ ...spec, rows: Number(r?.count || 0) });
    } catch {
      out.push({ ...spec, rows: 0 });
    }
  }
  res.json(out);
});

router.get('/:key.csv', async (req: Request, res: Response) => {
  const dealerId = resolveDealer(req, res);
  if (!dealerId) return;
  const spec = EXPORTS.find((e) => e.key === req.params.key);
  if (!spec) {
    res.status(404).json({ error: 'Unknown export key' });
    return;
  }
  const rows = await db(spec.table).where({ dealer_id: dealerId }).select('*');
  const headers = rows.length > 0 ? Object.keys(rows[0]) : ['(empty)'];
  const stamp = new Date().toISOString().slice(0, 10);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${spec.key}_${stamp}.csv"`);
  res.write(headers.join(',') + '\n');
  for (const row of rows) {
    res.write(headers.map((h) => csvEscape((row as any)[h])).join(',') + '\n');
  }
  res.end();
});

export default router;
