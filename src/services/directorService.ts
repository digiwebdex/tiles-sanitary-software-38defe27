import { vpsAuthedFetch } from "@/lib/vpsAuthClient";

export interface Director {
  id: string;
  dealer_id: string;
  name: string;
  role: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  share_pct: number;
  is_active: boolean;
  notes: string | null;
}
export interface DirectorEquity extends Director {
  deposit: number;
  withdrawal: number;
  dividend: number;
  net_equity: number;
}
export interface DirectorTransaction {
  id: string;
  director_id: string;
  type: "deposit" | "withdrawal" | "dividend";
  amount: number;
  payment_method: "cash" | "bank";
  bank_account_id: string | null;
  entry_date: string;
  description: string | null;
}

const j = async (r: Response) => {
  if (!r.ok) {
    let msg = "Request failed";
    try { const e = await r.json(); msg = (typeof e.error === "string" ? e.error : msg); } catch {}
    throw new Error(msg);
  }
  return r.json();
};

export const directorService = {
  list: (dealerId: string) =>
    vpsAuthedFetch(`/api/directors?dealerId=${dealerId}`).then(j) as Promise<Director[]>,
  equitySummary: (dealerId: string) =>
    vpsAuthedFetch(`/api/directors/equity-summary?dealerId=${dealerId}`).then(j) as Promise<DirectorEquity[]>,
  create: (dealerId: string, data: Partial<Director>) =>
    vpsAuthedFetch(`/api/directors?dealerId=${dealerId}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
    }).then(j),
  update: (id: string, dealerId: string, data: Partial<Director>) =>
    vpsAuthedFetch(`/api/directors/${id}?dealerId=${dealerId}`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
    }).then(j),
  remove: (id: string, dealerId: string) =>
    vpsAuthedFetch(`/api/directors/${id}?dealerId=${dealerId}`, { method: "DELETE" }),
  transactions: (id: string, dealerId: string) =>
    vpsAuthedFetch(`/api/directors/${id}/transactions?dealerId=${dealerId}`).then(j) as Promise<DirectorTransaction[]>,
  addTransaction: (id: string, dealerId: string, data: Partial<DirectorTransaction>) =>
    vpsAuthedFetch(`/api/directors/${id}/transactions?dealerId=${dealerId}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
    }).then(j),
};
