import { vpsAuthedFetch } from "@/lib/vpsAuthClient";

export interface BankAccount {
  id: string;
  dealer_id: string;
  bank_name: string;
  account_name: string;
  account_number: string;
  branch?: string | null;
  routing_no?: string | null;
  account_type: "current" | "savings" | "cc";
  opening_balance: number;
  opened_on: string;
  is_active: boolean;
  notes?: string | null;
  balance: number;
}

export interface BankLedgerRow {
  id: string;
  bank_account_id: string;
  type: string;
  amount: number;
  description: string | null;
  reference_type: string | null;
  reference_id: string | null;
  entry_date: string;
  created_at: string;
}

export const bankAccountService = {
  async list(dealerId: string): Promise<BankAccount[]> {
    const r = await vpsAuthedFetch(`/api/bank-accounts?dealerId=${dealerId}`);
    if (!r.ok) throw new Error((await r.json()).error || "Failed to load bank accounts");
    return r.json();
  },
  async create(dealerId: string, data: Partial<BankAccount>): Promise<BankAccount> {
    const r = await vpsAuthedFetch(`/api/bank-accounts?dealerId=${dealerId}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!r.ok) throw new Error((await r.json()).error?.formErrors?.[0] || (await r.json()).error || "Create failed");
    return r.json();
  },
  async update(id: string, dealerId: string, data: Partial<BankAccount>): Promise<BankAccount> {
    const r = await vpsAuthedFetch(`/api/bank-accounts/${id}?dealerId=${dealerId}`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
    });
    if (!r.ok) throw new Error("Update failed");
    return r.json();
  },
  async deactivate(id: string, dealerId: string) {
    await vpsAuthedFetch(`/api/bank-accounts/${id}?dealerId=${dealerId}`, { method: "DELETE" });
  },
  async ledger(id: string, dealerId: string, params: { from?: string; to?: string; page?: number; pageSize?: number } = {}) {
    const qs = new URLSearchParams({ dealerId, ...Object.fromEntries(Object.entries(params).filter(([, v]) => v != null).map(([k, v]) => [k, String(v)])) });
    const r = await vpsAuthedFetch(`/api/bank-accounts/${id}/ledger?${qs}`);
    if (!r.ok) throw new Error("Failed to load ledger");
    return r.json() as Promise<{ rows: BankLedgerRow[]; total: number; page: number; pageSize: number }>;
  },
  async addEntry(id: string, dealerId: string, data: { type: string; amount: number; description?: string; entry_date?: string }) {
    const r = await vpsAuthedFetch(`/api/bank-accounts/${id}/entry?dealerId=${dealerId}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
    });
    if (!r.ok) throw new Error((await r.json()).error || "Entry failed");
    return r.json();
  },
};
