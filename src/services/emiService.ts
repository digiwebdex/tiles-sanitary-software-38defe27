import { vpsAuthedFetch } from "@/lib/vpsAuthClient";

export interface EmiPlan {
  id: string;
  plan_no: string;
  customer_id: string;
  customer_name?: string;
  customer_phone?: string;
  sale_id: string | null;
  principal: number;
  tenure_months: number;
  installment_amount: number;
  start_date: string;
  status: "active" | "closed" | "cancelled";
  narration: string | null;
  created_at: string;
  paid_total?: number;
  scheduled_total?: number;
  paid_count?: number;
  schedule?: EmiInstallment[];
}

export interface EmiInstallment {
  id: string;
  plan_id: string;
  installment_no: number;
  due_date: string;
  amount: number;
  paid_amount: number;
  paid_date: string | null;
  status: "pending" | "paid" | "partial" | "overdue";
}

export interface EmiOverdueRow {
  id: string;
  plan_id: string;
  plan_no: string;
  installment_no: number;
  due_date: string;
  amount: number;
  paid_amount: number;
  status: string;
  customer_id: string;
  customer_name: string;
  customer_phone: string | null;
  days_overdue: number;
}

async function j<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await vpsAuthedFetch(url, init);
  if (!r.ok) {
    const t = await r.text().catch(() => "");
    throw new Error(t || `Request failed (${r.status})`);
  }
  return r.json() as Promise<T>;
}

export const emiService = {
  list(dealerId: string, opts: { status?: string; limit?: number; offset?: number } = {}) {
    const qs = new URLSearchParams({ dealerId });
    if (opts.status) qs.set("status", opts.status);
    if (opts.limit) qs.set("limit", String(opts.limit));
    if (opts.offset) qs.set("offset", String(opts.offset));
    return j<{ rows: EmiPlan[]; total: number }>(`/api/emi?${qs}`);
  },
  overdue(dealerId: string) {
    return j<{ rows: EmiOverdueRow[] }>(`/api/emi/overdue?dealerId=${dealerId}`);
  },
  get(dealerId: string, id: string) {
    return j<EmiPlan>(`/api/emi/${id}?dealerId=${dealerId}`);
  },
  create(dealerId: string, data: {
    customer_id: string; sale_id?: string | null;
    principal: number; tenure_months: number; start_date: string; narration?: string | null;
  }) {
    return j<{ id: string; plan_no: string }>(`/api/emi`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dealerId, ...data }),
    });
  },
  pay(dealerId: string, planId: string, installmentId: string, paid_amount: number, paid_date: string) {
    return j<{ ok: true }>(`/api/emi/${planId}/installments/${installmentId}/pay`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dealerId, paid_amount, paid_date }),
    });
  },
  cancel(dealerId: string, id: string) {
    return j<{ ok: true }>(`/api/emi/${id}?dealerId=${dealerId}`, { method: "DELETE" });
  },
};
