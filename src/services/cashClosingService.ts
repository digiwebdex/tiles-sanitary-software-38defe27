import { vpsAuthedFetch } from "@/lib/vpsAuthClient";

export interface CashClosing {
  id: string;
  dealer_id: string;
  closing_date: string;
  opening_cash: number;
  system_cash_in: number;
  system_cash_out: number;
  expected_closing: number;
  counted_cash: number;
  denominations: Record<string, number>;
  variance: number;
  variance_reason: string | null;
  notes: string | null;
  status: "submitted" | "approved" | "rejected";
  submitted_by: string | null;
  submitted_at: string;
  approved_by: string | null;
  approved_at: string | null;
  approval_note: string | null;
}

export interface DayPreview {
  opening: number;
  system_cash_in: number;
  system_cash_out: number;
  expected_closing: number;
}

async function handle<T>(r: Response): Promise<T> {
  if (!r.ok) {
    const j = await r.json().catch(() => ({}));
    throw new Error(j.error ? (typeof j.error === "string" ? j.error : JSON.stringify(j.error)) : `Request failed (${r.status})`);
  }
  return r.json();
}

export const cashClosingService = {
  list(dealerId: string, params: { from?: string; to?: string } = {}) {
    const qs = new URLSearchParams({ dealerId });
    Object.entries(params).forEach(([k, v]) => v && qs.set(k, v));
    return vpsAuthedFetch(`/api/cash-closings?${qs}`).then(handle<{ rows: CashClosing[] }>);
  },
  today(dealerId: string, date?: string) {
    const qs = new URLSearchParams({ dealerId });
    if (date) qs.set("date", date);
    return vpsAuthedFetch(`/api/cash-closings/today?${qs}`).then(handle<{ date: string; preview: DayPreview; existing: CashClosing | null }>);
  },
  submit(payload: {
    dealerId: string;
    closing_date: string;
    counted_cash: number;
    denominations?: Record<string, number>;
    variance_reason?: string;
    notes?: string;
  }) {
    return vpsAuthedFetch(`/api/cash-closings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).then(handle<{ row: CashClosing }>);
  },
  approve(id: string, dealerId: string, note?: string) {
    return vpsAuthedFetch(`/api/cash-closings/${id}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dealerId, note }),
    }).then(handle<{ row: CashClosing }>);
  },
  reject(id: string, dealerId: string, note?: string) {
    return vpsAuthedFetch(`/api/cash-closings/${id}/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dealerId, note }),
    }).then(handle<{ row: CashClosing }>);
  },
};
