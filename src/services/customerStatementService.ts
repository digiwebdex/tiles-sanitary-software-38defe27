import { vpsAuthedFetch } from "@/lib/vpsAuthClient";

export interface StatementEntry {
  date: string;
  type: "sale" | "payment" | "refund" | "adjustment";
  description: string;
  debit: number;
  credit: number;
  balance: number;
  sale_invoice: string | null;
}

export interface CustomerStatement {
  customer: {
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
    address: string | null;
    credit_limit: number;
  };
  dealer: { name: string; phone: string | null; address: string | null } | null;
  from: string | null;
  to: string | null;
  opening_balance: number;
  entries: StatementEntry[];
  closing_balance: number;
  totals: { debit: number; credit: number };
}

export interface CreditCustomerWithDue {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  credit_limit: number;
  max_overdue_days: number;
  opening_balance: number;
  due_balance: number;
}

async function handle<T>(r: Response): Promise<T> {
  if (!r.ok) {
    const j = await r.json().catch(() => ({}));
    throw new Error(j.error ? (typeof j.error === "string" ? j.error : JSON.stringify(j.error)) : `Request failed (${r.status})`);
  }
  return r.json();
}

export const customerStatementService = {
  get(customerId: string, dealerId: string, opts: { from?: string; to?: string } = {}) {
    const qs = new URLSearchParams({ dealerId });
    if (opts.from) qs.set("from", opts.from);
    if (opts.to) qs.set("to", opts.to);
    return vpsAuthedFetch(`/api/customer-statements/${customerId}?${qs}`).then(handle<CustomerStatement>);
  },
  creditList(dealerId: string) {
    return vpsAuthedFetch(`/api/customer-statements/credit/list?dealerId=${dealerId}`).then(handle<CreditCustomerWithDue[]>);
  },
};
