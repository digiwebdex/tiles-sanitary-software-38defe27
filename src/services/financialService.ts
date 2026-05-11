import { vpsAuthedFetch } from "@/lib/vpsAuthClient";

export interface ProfitLoss {
  period: { from: string | null; to: string | null };
  revenue: number;
  sales_returns: number;
  net_revenue: number;
  cogs: number;
  gross_profit: number;
  expenses_by_category: { category: string; amount: number }[];
  total_expenses: number;
  net_profit: number;
}

export interface BalanceSheet {
  as_of: string | null;
  assets: {
    cash: number;
    bank_total: number;
    bank_accounts: { bank_account_id: string; bank_name: string; account_number: string; balance: number }[];
    inventory: number;
    accounts_receivable: number;
    total: number;
  };
  liabilities: { accounts_payable: number; total: number };
  equity: { director_capital?: number; retained_earnings?: number; owner_equity: number; total: number };
}

export const financialService = {
  async profitLoss(dealerId: string, from?: string, to?: string): Promise<ProfitLoss> {
    const qs = new URLSearchParams({ dealerId });
    if (from) qs.set("from", from); if (to) qs.set("to", to);
    const r = await vpsAuthedFetch(`/api/financials/p-and-l?${qs}`);
    if (!r.ok) throw new Error("Failed to load P&L");
    return r.json();
  },
  async balanceSheet(dealerId: string, asOf?: string): Promise<BalanceSheet> {
    const qs = new URLSearchParams({ dealerId });
    if (asOf) qs.set("asOf", asOf);
    const r = await vpsAuthedFetch(`/api/financials/balance-sheet?${qs}`);
    if (!r.ok) throw new Error("Failed to load balance sheet");
    return r.json();
  },
};
