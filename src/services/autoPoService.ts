import { vpsAuthedFetch } from "@/lib/vpsAuthClient";

export interface AutoPoSuggestionItem {
  product_id: string;
  name: string;
  sku: string;
  brand: string | null;
  unit_type: string;
  reorder_level: number;
  on_hand: number;
  suggested_qty: number;
  suggested_rate: number;
}
export interface AutoPoSuggestionGroup {
  supplier_id: string;
  supplier_name: string | null;
  items: AutoPoSuggestionItem[];
}
export interface AutoPoSuggestions {
  groups: AutoPoSuggestionGroup[];
  unassigned: AutoPoSuggestionItem[];
}

export interface PurchaseDraft {
  id: string;
  dealer_id: string;
  supplier_id: string;
  supplier_name: string | null;
  supplier_phone?: string | null;
  status: "draft" | "converted" | "discarded";
  notes: string | null;
  source: "auto_low_stock" | "manual";
  converted_purchase_id: string | null;
  created_at: string;
  updated_at: string;
  item_count?: number;
  total_amount?: number;
}

export interface PurchaseDraftItem {
  id: string;
  draft_id: string;
  product_id: string;
  product_name: string;
  product_sku: string;
  unit_type: string;
  brand: string | null;
  suggested_qty: number;
  suggested_rate: number;
}

export interface PurchaseDraftDetail extends PurchaseDraft {
  supplier_email?: string | null;
  supplier_address?: string | null;
  items: PurchaseDraftItem[];
}

async function handle<T>(r: Response): Promise<T> {
  if (!r.ok) {
    const j = await r.json().catch(() => ({}));
    throw new Error(j.error ? (typeof j.error === "string" ? j.error : JSON.stringify(j.error)) : `Request failed (${r.status})`);
  }
  return r.json();
}

export const autoPoService = {
  suggestions(dealerId: string) {
    return vpsAuthedFetch(`/api/auto-po/suggestions?dealerId=${dealerId}`).then(handle<AutoPoSuggestions>);
  },
  listDrafts(dealerId: string, status?: string) {
    const qs = new URLSearchParams({ dealerId });
    if (status) qs.set("status", status);
    return vpsAuthedFetch(`/api/auto-po/drafts?${qs}`).then(handle<PurchaseDraft[]>);
  },
  getDraft(id: string, dealerId: string) {
    return vpsAuthedFetch(`/api/auto-po/drafts/${id}?dealerId=${dealerId}`).then(handle<PurchaseDraftDetail>);
  },
  createDraft(payload: {
    dealerId: string;
    supplier_id: string;
    notes?: string | null;
    source?: "manual" | "auto_low_stock";
    items: Array<{ product_id: string; suggested_qty: number; suggested_rate: number }>;
  }) {
    return vpsAuthedFetch(`/api/auto-po/drafts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).then(handle<PurchaseDraft>);
  },
  generateAll(dealerId: string) {
    return vpsAuthedFetch(`/api/auto-po/drafts/generate-all`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dealerId }),
    }).then(handle<{ created: number; drafts: PurchaseDraft[] }>);
  },
  updateDraft(id: string, payload: {
    dealerId: string;
    supplier_id?: string;
    notes?: string | null;
    items?: Array<{ product_id: string; suggested_qty: number; suggested_rate: number }>;
  }) {
    return vpsAuthedFetch(`/api/auto-po/drafts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).then(handle<{ ok: true }>);
  },
  discard(id: string, dealerId: string) {
    return vpsAuthedFetch(`/api/auto-po/drafts/${id}/discard`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dealerId }),
    }).then(handle<{ ok: true }>);
  },
  markConverted(id: string, dealerId: string, purchase_id: string) {
    return vpsAuthedFetch(`/api/auto-po/drafts/${id}/mark-converted`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dealerId, purchase_id }),
    }).then(handle<{ ok: true }>);
  },
};
