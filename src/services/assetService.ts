import { vpsAuthedFetch } from "@/lib/vpsAuthClient";

export type AssetStatus = "available" | "assigned" | "retired" | "lost";
export type AssetCondition = "new" | "good" | "fair" | "damaged" | "lost";

export interface Asset {
  id: string;
  dealer_id: string;
  tag: string;
  name: string;
  category?: string | null;
  serial_no?: string | null;
  brand?: string | null;
  model?: string | null;
  purchase_date?: string | null;
  purchase_cost?: number | null;
  condition: AssetCondition;
  status: AssetStatus;
  assigned_to?: string | null;
  assigned_at?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
  employee_name?: string | null;
  employee_code?: string | null;
}

export interface AssetAssignment {
  id: string;
  asset_id: string;
  employee_id: string;
  assigned_date: string;
  returned_date?: string | null;
  condition_at_assignment?: AssetCondition | null;
  condition_at_return?: AssetCondition | null;
  notes?: string | null;
  employee_name?: string | null;
  employee_code?: string | null;
}

export interface AssetDetail extends Asset {
  history: AssetAssignment[];
}

export interface ActiveAssignmentRow {
  id: string;
  tag: string;
  name: string;
  category?: string | null;
  condition: AssetCondition;
  assigned_at: string;
  employee_id: string;
  employee_name?: string | null;
  employee_code?: string | null;
}

async function j<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await vpsAuthedFetch(url, init);
  if (!r.ok) {
    const t = await r.text().catch(() => "");
    throw new Error(t || `Request failed (${r.status})`);
  }
  return r.json() as Promise<T>;
}

const jsonInit = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

export const assetService = {
  list: (params: { status?: AssetStatus; employee_id?: string; q?: string } = {}) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v) qs.set(k, String(v)); });
    const s = qs.toString();
    return j<Asset[]>(`/api/assets${s ? `?${s}` : ""}`);
  },
  get: (id: string) => j<AssetDetail>(`/api/assets/${id}`),
  create: (data: Partial<Asset>) => j<Asset>(`/api/assets`, jsonInit("POST", data)),
  update: (id: string, data: Partial<Asset>) => j<Asset>(`/api/assets/${id}`, jsonInit("PUT", data)),
  remove: (id: string) => j<{ success: true }>(`/api/assets/${id}`, { method: "DELETE" }),

  assign: (id: string, body: { employee_id: string; assigned_date: string; condition_at_assignment?: AssetCondition; notes?: string | null }) =>
    j<{ asset: Asset; assignment: AssetAssignment }>(`/api/assets/${id}/assign`, jsonInit("POST", body)),

  returnAsset: (id: string, body: { returned_date: string; condition_at_return?: AssetCondition; notes?: string | null }) =>
    j<Asset>(`/api/assets/${id}/return`, jsonInit("POST", body)),

  activeAssignments: () => j<ActiveAssignmentRow[]>(`/api/assets/assignments/active`),
};
