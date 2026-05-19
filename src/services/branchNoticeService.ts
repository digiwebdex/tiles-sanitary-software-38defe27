import { vpsAuthedFetch } from "@/lib/vpsAuthClient";

export interface Branch {
  id: string;
  dealer_id: string;
  code: string;
  name: string;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  manager_name?: string | null;
  is_active: boolean;
  is_default: boolean;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Notice {
  id: string;
  dealer_id: string;
  title: string;
  body: string;
  severity: "info" | "warning" | "critical";
  audience: "all" | "admin" | "manager" | "accountant" | "salesman";
  start_date?: string | null;
  end_date?: string | null;
  is_active: boolean;
  pinned: boolean;
  created_at: string;
  updated_at: string;
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

export const branchService = {
  list: () => j<Branch[]>(`/api/branches`),
  create: (data: Partial<Branch>) => j<Branch>(`/api/branches`, jsonInit("POST", data)),
  update: (id: string, data: Partial<Branch>) => j<Branch>(`/api/branches/${id}`, jsonInit("PUT", data)),
  remove: (id: string) => j<{ success: true }>(`/api/branches/${id}`, { method: "DELETE" }),
};

export const noticeService = {
  list: () => j<Notice[]>(`/api/notices`),
  listActive: () => j<Notice[]>(`/api/notices/active`),
  create: (data: Partial<Notice>) => j<Notice>(`/api/notices`, jsonInit("POST", data)),
  update: (id: string, data: Partial<Notice>) => j<Notice>(`/api/notices/${id}`, jsonInit("PUT", data)),
  remove: (id: string) => j<{ success: true }>(`/api/notices/${id}`, { method: "DELETE" }),
};
