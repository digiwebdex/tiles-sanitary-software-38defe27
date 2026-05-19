import { vpsAuthedFetch } from "@/lib/vpsAuthClient";

export interface LeaveType {
  id: string;
  dealer_id: string;
  code: string;
  name: string;
  annual_quota: number;
  is_paid: boolean;
  color?: string | null;
  is_active: boolean;
  sort_order: number;
}

export interface LeaveBalance {
  id: string;
  employee_id: string;
  leave_type_id: string;
  year: number;
  allocated: number;
  used: number;
  employee_name?: string;
  employee_code?: string;
  leave_type_name?: string;
  leave_type_code?: string;
  leave_type_color?: string;
}

export interface LeaveRequest {
  id: string;
  employee_id: string;
  leave_type_id: string;
  start_date: string;
  end_date: string;
  days: number;
  reason?: string | null;
  status: "pending" | "approved" | "rejected" | "cancelled";
  decision_note?: string | null;
  decided_at?: string | null;
  created_at: string;
  employee_name?: string;
  employee_code?: string;
  leave_type_name?: string;
  leave_type_code?: string;
  leave_type_color?: string;
}

async function j<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await vpsAuthedFetch(url, init);
  if (!r.ok) {
    const t = await r.text().catch(() => "");
    throw new Error(t || `Request failed (${r.status})`);
  }
  return r.json() as Promise<T>;
}
const ji = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

export const leaveService = {
  // Types
  listTypes: () => j<LeaveType[]>(`/api/leaves/types`),
  createType: (data: Partial<LeaveType>) => j<LeaveType>(`/api/leaves/types`, ji("POST", data)),
  updateType: (id: string, data: Partial<LeaveType>) => j<LeaveType>(`/api/leaves/types/${id}`, ji("PUT", data)),
  deleteType: (id: string) => j<{ success: true }>(`/api/leaves/types/${id}`, { method: "DELETE" }),

  // Balances
  listBalances: (params: { employeeId?: string; year?: number } = {}) => {
    const q = new URLSearchParams();
    if (params.employeeId) q.set("employeeId", params.employeeId);
    if (params.year) q.set("year", String(params.year));
    return j<LeaveBalance[]>(`/api/leaves/balances?${q.toString()}`);
  },
  upsertBalance: (data: { employee_id: string; leave_type_id: string; year: number; allocated: number }) =>
    j<LeaveBalance>(`/api/leaves/balances`, ji("POST", data)),

  // Requests
  listRequests: (params: { status?: string; employeeId?: string; from?: string; to?: string } = {}) => {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v) q.set(k, String(v)); });
    return j<LeaveRequest[]>(`/api/leaves/requests?${q.toString()}`);
  },
  createRequest: (data: {
    employee_id: string; leave_type_id: string;
    start_date: string; end_date: string; reason?: string;
  }) => j<LeaveRequest>(`/api/leaves/requests`, ji("POST", data)),
  decide: (id: string, decision: "approved" | "rejected", note?: string) =>
    j<LeaveRequest>(`/api/leaves/requests/${id}/decide`, ji("POST", { decision, note })),
  cancel: (id: string) =>
    j<LeaveRequest>(`/api/leaves/requests/${id}/cancel`, ji("POST", {})),
};
