/**
 * holidayService — VPS-only Holiday Setup.
 * Routes to /api/holidays on the self-hosted backend.
 */
import { vpsAuthedFetch } from "@/lib/vpsAuthClient";

export type HolidayType = "public" | "religious" | "national" | "company" | "weekend" | "other";

export interface Holiday {
  id: string;
  dealer_id: string;
  holiday_date: string;
  name: string;
  type: HolidayType;
  recurring: boolean;
  paid: boolean;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface HolidayInput {
  holiday_date: string;
  name: string;
  type?: HolidayType;
  recurring?: boolean;
  paid?: boolean;
  notes?: string | null;
}

export interface ListHolidaysParams {
  dealerId: string;
  year?: number;
  from?: string;
  to?: string;
}

async function jsonOrThrow<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const holidayService = {
  async list(params: ListHolidaysParams): Promise<{ rows: Holiday[]; total: number }> {
    const qs = new URLSearchParams({ dealerId: params.dealerId });
    if (params.year) qs.set("year", String(params.year));
    if (params.from) qs.set("from", params.from);
    if (params.to) qs.set("to", params.to);
    const res = await vpsAuthedFetch(`/api/holidays?${qs.toString()}`);
    return jsonOrThrow(res);
  },

  async get(id: string, dealerId: string): Promise<Holiday> {
    const res = await vpsAuthedFetch(`/api/holidays/${id}?dealerId=${encodeURIComponent(dealerId)}`);
    const { row } = await jsonOrThrow<{ row: Holiday }>(res);
    return row;
  },

  async create(dealerId: string, data: HolidayInput): Promise<Holiday> {
    const res = await vpsAuthedFetch(`/api/holidays`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dealerId, data }),
    });
    const { row } = await jsonOrThrow<{ row: Holiday }>(res);
    return row;
  },

  async update(id: string, dealerId: string, data: Partial<HolidayInput>): Promise<Holiday> {
    const res = await vpsAuthedFetch(`/api/holidays/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dealerId, data }),
    });
    const { row } = await jsonOrThrow<{ row: Holiday }>(res);
    return row;
  },

  async remove(id: string, dealerId: string): Promise<void> {
    const res = await vpsAuthedFetch(`/api/holidays/${id}?dealerId=${encodeURIComponent(dealerId)}`, {
      method: "DELETE",
    });
    if (!res.ok && res.status !== 204) {
      const text = await res.text().catch(() => "");
      throw new Error(text || `Delete failed: ${res.status}`);
    }
  },

  async bulkCreate(dealerId: string, rows: HolidayInput[]): Promise<{ rows: Holiday[]; inserted: number }> {
    const res = await vpsAuthedFetch(`/api/holidays/bulk`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dealerId, rows }),
    });
    return jsonOrThrow(res);
  },
};
