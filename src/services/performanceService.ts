import { vpsAuthedFetch } from "@/lib/vpsAuthClient";

export interface PerformanceKpi {
  id: string;
  review_id: string;
  kpi_name: string;
  weight: number;
  target: number;
  achieved: number;
  score: number;
  notes?: string | null;
}

export interface PerformanceReview {
  id: string;
  dealer_id: string;
  employee_id: string;
  employee_name?: string;
  designation?: string | null;
  period: string;
  reviewer?: string | null;
  overall_rating: number;
  grade?: string | null;
  strengths?: string | null;
  improvements?: string | null;
  comments?: string | null;
  status: "draft" | "finalized";
  created_at: string;
  updated_at: string;
  kpis?: PerformanceKpi[];
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

export const performanceService = {
  list: (params: { period?: string; employee_id?: string } = {}) => {
    const qs = new URLSearchParams();
    if (params.period) qs.set("period", params.period);
    if (params.employee_id) qs.set("employee_id", params.employee_id);
    const s = qs.toString();
    return j<PerformanceReview[]>(`/api/performance${s ? `?${s}` : ""}`);
  },
  get: (id: string) => j<PerformanceReview>(`/api/performance/${id}`),
  create: (data: {
    employee_id: string;
    period: string;
    reviewer?: string | null;
    strengths?: string | null;
    improvements?: string | null;
    comments?: string | null;
    kpis?: Partial<PerformanceKpi>[];
  }) => j<PerformanceReview>(`/api/performance`, jsonInit("POST", data)),
  update: (id: string, data: Partial<PerformanceReview>) =>
    j<PerformanceReview>(`/api/performance/${id}`, jsonInit("PUT", data)),
  remove: (id: string) =>
    j<{ success: true }>(`/api/performance/${id}`, { method: "DELETE" }),
  addKpi: (reviewId: string, kpi: Partial<PerformanceKpi>) =>
    j<PerformanceKpi>(`/api/performance/${reviewId}/kpis`, jsonInit("POST", kpi)),
  updateKpi: (kpiId: string, kpi: Partial<PerformanceKpi>) =>
    j<PerformanceKpi>(`/api/performance/kpis/${kpiId}`, jsonInit("PUT", kpi)),
  removeKpi: (kpiId: string) =>
    j<{ success: true }>(`/api/performance/kpis/${kpiId}`, { method: "DELETE" }),
  finalize: (id: string) =>
    j<{ success: true; overall_rating: number; grade: string }>(
      `/api/performance/${id}/finalize`,
      { method: "POST" }
    ),
};

export function gradeBadgeVariant(g?: string | null): "default" | "secondary" | "destructive" | "outline" {
  if (!g) return "outline";
  if (g === "A+" || g === "A") return "default";
  if (g === "B") return "secondary";
  if (g === "F" || g === "D") return "destructive";
  return "outline";
}
