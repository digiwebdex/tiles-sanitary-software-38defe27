import { vpsAuthedFetch } from "@/lib/vpsAuthClient";

export interface SalaryHistoryRow {
  id: string;
  employee_id: string;
  employee_name: string;
  designation: string | null;
  employee_code: string | null;
  period: string;
  basic: number;
  house_rent: number;
  medical: number;
  transport: number;
  other_allowance: number;
  deduction: number;
  net_payable: number;
  payment_method: string;
  bank_name: string | null;
  account_number: string | null;
  payment_date: string;
  notes: string | null;
}

export interface DirectorStatementRow {
  id: string;
  director_id: string;
  director_name: string;
  director_role: string | null;
  share_pct: number | null;
  type: 'deposit' | 'withdrawal' | 'dividend';
  amount: number;
  payment_method: string;
  bank_name: string | null;
  account_number: string | null;
  entry_date: string;
  description: string | null;
}

export interface WarehouseStockRow {
  id: string;
  name: string;
  code: string | null;
  manager_name: string | null;
  is_default: boolean;
  is_active: boolean;
  total_in: number;
  total_out: number;
  net: number;
}

export interface WarehouseTransferRow {
  id: string;
  transfer_no: string | null;
  from_name: string | null;
  to_name: string | null;
  product_name_snapshot: string | null;
  quantity: number;
  unit: string;
  transport_cost: number;
  transfer_date: string;
  notes: string | null;
}

const qs = (params: Record<string, string | undefined>) => {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) u.set(k, v);
  return u.toString();
};

export const phase3ReportService = {
  async salaryHistory(dealerId: string, employeeId?: string, from?: string, to?: string) {
    const r = await vpsAuthedFetch(`/api/reports/salary-history?${qs({ dealerId, employee_id: employeeId, from, to })}`);
    if (!r.ok) throw new Error("Failed to load salary history");
    return r.json() as Promise<{ rows: SalaryHistoryRow[]; total: number; count: number }>;
  },
  async directorStatement(dealerId: string, directorId?: string, from?: string, to?: string) {
    const r = await vpsAuthedFetch(`/api/reports/director-statement?${qs({ dealerId, director_id: directorId, from, to })}`);
    if (!r.ok) throw new Error("Failed to load director statement");
    return r.json() as Promise<{
      rows: DirectorStatementRow[];
      summary: { deposits: number; withdrawals: number; dividends: number; net_capital: number; count: number };
    }>;
  },
  async warehouseStock(dealerId: string) {
    const r = await vpsAuthedFetch(`/api/reports/warehouse-stock?${qs({ dealerId })}`);
    if (!r.ok) throw new Error("Failed to load warehouse stock");
    return r.json() as Promise<{ warehouses: WarehouseStockRow[]; recent_transfers: WarehouseTransferRow[] }>;
  },
};
