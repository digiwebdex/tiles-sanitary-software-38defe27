/**
 * leadService — VPS-only Leads CRM.
 * Routes to /api/leads on the self-hosted backend.
 */
import { vpsAuthedFetch } from "@/lib/vpsAuthClient";

export type LeadStatus = "new" | "contacted" | "qualified" | "converted" | "lost";
export type LeadSource = "walk_in" | "phone" | "referral" | "online" | "facebook" | "whatsapp" | "other";

export interface Lead {
  id: string;
  dealer_id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  company: string | null;
  source: LeadSource;
  status: LeadStatus;
  interest: string | null;
  estimated_value: number;
  assigned_to: string | null;
  next_followup: string | null;
  notes: string | null;
  converted_customer_id: string | null;
  converted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface LeadVisit {
  id: string;
  dealer_id: string;
  lead_id: string;
  visit_date: string;
  visit_type: string;
  outcome: string | null;
  next_action: string | null;
  next_date: string | null;
  notes: string | null;
  visited_by: string | null;
  created_at: string;
}

export interface LeadFormData {
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  company?: string;
  source?: LeadSource;
  status?: LeadStatus;
  interest?: string;
  estimated_value?: number;
  next_followup?: string;
  notes?: string;
}

const PAGE_SIZE = 25;

async function vpsRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await vpsAuthedFetch(path, init);
  const body = await res.json().catch(() => ({} as any));
  if (!res.ok) throw new Error((body as any)?.error || `Request failed (${res.status})`);
  return body as T;
}

function clean(form: Partial<LeadFormData>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (form.name !== undefined) out.name = form.name.trim();
  if (form.phone !== undefined) out.phone = form.phone.trim() || null;
  if (form.email !== undefined) out.email = form.email.trim() || null;
  if (form.address !== undefined) out.address = form.address.trim() || null;
  if (form.company !== undefined) out.company = form.company.trim() || null;
  if (form.source !== undefined) out.source = form.source;
  if (form.status !== undefined) out.status = form.status;
  if (form.interest !== undefined) out.interest = form.interest?.trim() || null;
  if (form.estimated_value !== undefined) out.estimated_value = Number(form.estimated_value) || 0;
  if (form.next_followup !== undefined) out.next_followup = form.next_followup || null;
  if (form.notes !== undefined) out.notes = form.notes?.trim() || null;
  return out;
}

export const leadService = {
  async list(dealerId: string, opts: { search?: string; status?: LeadStatus; page?: number } = {}) {
    const params = new URLSearchParams({
      dealerId,
      page: String(Math.max(0, (opts.page ?? 1) - 1)),
      pageSize: String(PAGE_SIZE),
      orderBy: "created_at",
      orderDir: "desc",
    });
    if (opts.search?.trim()) params.set("search", opts.search.trim());
    if (opts.status) params.set("f.status", opts.status);
    const body = await vpsRequest<{ rows: Lead[]; total: number }>(`/api/leads?${params}`);
    return { data: body.rows ?? [], total: body.total ?? 0 };
  },

  async getById(id: string) {
    const body = await vpsRequest<{ row: Lead }>(`/api/leads/${id}`);
    return body.row;
  },

  async create(dealerId: string, form: LeadFormData) {
    const body = await vpsRequest<{ row: Lead }>(`/api/leads`, {
      method: "POST",
      body: JSON.stringify({ dealerId, data: clean(form) }),
    });
    return body.row;
  },

  async update(id: string, form: Partial<LeadFormData>) {
    await vpsRequest(`/api/leads/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ data: clean(form) }),
    });
  },

  async remove(id: string) {
    await vpsRequest(`/api/leads/${id}`, { method: "DELETE" });
  },

  async convertToCustomer(id: string, dealerId: string) {
    const body = await vpsRequest<{ lead: Lead; customer: { id: string } }>(
      `/api/leads/${id}/convert`,
      { method: "POST", body: JSON.stringify({ dealerId }) },
    );
    return body;
  },

  async listVisits(leadId: string) {
    const body = await vpsRequest<{ rows: LeadVisit[] }>(`/api/leads/${leadId}/visits`);
    return body.rows ?? [];
  },

  async addVisit(leadId: string, dealerId: string, data: Partial<LeadVisit>) {
    const body = await vpsRequest<{ row: LeadVisit }>(`/api/leads/${leadId}/visits`, {
      method: "POST",
      body: JSON.stringify({ dealerId, data }),
    });
    return body.row;
  },

  async removeVisit(visitId: string) {
    await vpsRequest(`/api/leads/visits/${visitId}`, { method: "DELETE" });
  },

  async visitRegister(dealerId: string, opts: { from?: string; to?: string; visit_type?: string } = {}) {
    const params = new URLSearchParams({ dealerId });
    if (opts.from) params.set("from", opts.from);
    if (opts.to) params.set("to", opts.to);
    if (opts.visit_type) params.set("visit_type", opts.visit_type);
    const body = await vpsRequest<{ rows: (LeadVisit & { lead_name: string; lead_phone: string | null; lead_company: string | null; lead_status: LeadStatus })[] }>(
      `/api/leads/visits/register?${params}`,
    );
    return body.rows ?? [];
  },
};

export type LeadOptionKind = "source" | "status" | "visit_type" | "outcome";

export interface LeadOption {
  id: string;
  dealer_id: string;
  kind: LeadOptionKind;
  value: string;
  label: string;
  color: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

export const leadOptionService = {
  async list(dealerId: string, kind?: LeadOptionKind) {
    const params = new URLSearchParams({ dealerId });
    if (kind) params.set("kind", kind);
    const body = await vpsRequest<{ rows: LeadOption[] }>(`/api/leads/options/all?${params}`);
    return body.rows ?? [];
  },
  async upsert(dealerId: string, data: Omit<LeadOption, "id" | "dealer_id" | "created_at">) {
    const body = await vpsRequest<{ row: LeadOption }>(`/api/leads/options`, {
      method: "POST",
      body: JSON.stringify({ dealerId, data }),
    });
    return body.row;
  },
  async remove(id: string) {
    await vpsRequest(`/api/leads/options/${id}`, { method: "DELETE" });
  },
};
