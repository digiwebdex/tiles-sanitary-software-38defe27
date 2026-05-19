import { vpsAuthedFetch } from "@/lib/vpsAuthClient";

export interface Shift {
  id: string;
  dealer_id: string;
  code: string;
  name: string;
  start_time: string;
  end_time: string;
  grace_minutes: number;
  half_day_after_minutes: number;
  working_days: string; // "0,1,2,3,4,6"
  color?: string | null;
  is_active: boolean;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ShiftEvaluation {
  is_working_day: boolean;
  on_time: boolean;
  minutes_late: number;
  suggested_status: "present" | "late" | "half" | "absent";
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

export const shiftService = {
  list: () => j<Shift[]>(`/api/shifts`),
  get: (id: string) => j<Shift>(`/api/shifts/${id}`),
  create: (data: Partial<Shift>) => j<Shift>(`/api/shifts`, jsonInit("POST", data)),
  update: (id: string, data: Partial<Shift>) => j<Shift>(`/api/shifts/${id}`, jsonInit("PUT", data)),
  remove: (id: string) => j<{ success: true }>(`/api/shifts/${id}`, { method: "DELETE" }),
  evaluate: (shift_id: string, check_in: string, att_date?: string) =>
    j<ShiftEvaluation>(`/api/shifts/evaluate`, jsonInit("POST", { shift_id, check_in, att_date })),
};

export const WEEKDAYS = [
  { value: 0, label: "Sun" },
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
];

export function parseWorkingDays(s: string): number[] {
  return s.split(",").map((x) => Number(x.trim())).filter((n) => !Number.isNaN(n));
}

export function formatWorkingDays(days: number[]): string {
  return [...days].sort().join(",");
}
