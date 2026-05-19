import { vpsAuthedFetch } from "@/lib/vpsAuthClient";

export type DocType = "nid" | "passport" | "contract" | "certificate" | "photo" | "license" | "other";

export interface EmployeeDocument {
  id: string;
  dealer_id: string;
  employee_id: string;
  doc_type: DocType;
  title: string;
  doc_number?: string | null;
  file_url?: string | null;
  issue_date?: string | null;
  expiry_date?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
  employee_name?: string;
  employee_code?: string;
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

export const employeeDocumentService = {
  list: (params: { employee_id?: string; expiring_within_days?: number } = {}) => {
    const q = new URLSearchParams();
    if (params.employee_id) q.set("employee_id", params.employee_id);
    if (params.expiring_within_days != null) q.set("expiring_within_days", String(params.expiring_within_days));
    const qs = q.toString();
    return j<EmployeeDocument[]>(`/api/employee-documents${qs ? `?${qs}` : ""}`);
  },
  expiring: (days = 30) => j<EmployeeDocument[]>(`/api/employee-documents/expiring/list?days=${days}`),
  create: (data: Partial<EmployeeDocument>) =>
    j<EmployeeDocument>(`/api/employee-documents`, jsonInit("POST", data)),
  update: (id: string, data: Partial<EmployeeDocument>) =>
    j<EmployeeDocument>(`/api/employee-documents/${id}`, jsonInit("PUT", data)),
  remove: (id: string) =>
    j<{ success: true }>(`/api/employee-documents/${id}`, { method: "DELETE" }),
};
