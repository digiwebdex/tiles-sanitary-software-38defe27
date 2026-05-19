/**
 * salaryComponentService — VPS-only Salary Structure.
 */
import { vpsAuthedFetch } from "@/lib/vpsAuthClient";

export type ComponentKind = "allowance" | "deduction";
export type ComponentCalc = "fixed" | "percent_basic";

export interface SalaryComponent {
  id: string;
  dealer_id: string;
  code: string;
  name: string;
  kind: ComponentKind;
  calc: ComponentCalc;
  default_amount: number;
  default_percent: number;
  is_taxable: boolean;
  active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface SalaryComponentInput {
  code: string;
  name: string;
  kind: ComponentKind;
  calc?: ComponentCalc;
  default_amount?: number;
  default_percent?: number;
  is_taxable?: boolean;
  active?: boolean;
  notes?: string | null;
}

export interface EmployeeComponentAssignment {
  id: string;
  employee_id: string;
  component_id: string;
  amount_override: number | null;
  percent_override: number | null;
  active: boolean;
  component_code: string;
  component_name: string;
  kind: ComponentKind;
  calc: ComponentCalc;
  default_amount: number;
  default_percent: number;
  is_taxable: boolean;
}

export interface SalaryPreviewLine {
  code: string;
  name: string;
  kind: ComponentKind;
  calc: ComponentCalc;
  value: number;
}

export interface SalaryPreview {
  basic: number;
  allowances: number;
  deductions: number;
  gross: number;
  net: number;
  lines: SalaryPreviewLine[];
}

async function jsonOrThrow<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const salaryComponentService = {
  async list(dealerId: string, activeOnly = false): Promise<{ rows: SalaryComponent[]; total: number }> {
    const qs = new URLSearchParams({ dealerId });
    if (activeOnly) qs.set("active", "true");
    const res = await vpsAuthedFetch(`/api/salary-components?${qs.toString()}`);
    return jsonOrThrow(res);
  },
  async create(dealerId: string, data: SalaryComponentInput): Promise<SalaryComponent> {
    const res = await vpsAuthedFetch(`/api/salary-components`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dealerId, data }),
    });
    const { row } = await jsonOrThrow<{ row: SalaryComponent }>(res);
    return row;
  },
  async update(id: string, dealerId: string, data: Partial<SalaryComponentInput>): Promise<SalaryComponent> {
    const res = await vpsAuthedFetch(`/api/salary-components/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dealerId, data }),
    });
    const { row } = await jsonOrThrow<{ row: SalaryComponent }>(res);
    return row;
  },
  async remove(id: string, dealerId: string): Promise<void> {
    const res = await vpsAuthedFetch(`/api/salary-components/${id}?dealerId=${encodeURIComponent(dealerId)}`, {
      method: "DELETE",
    });
    if (!res.ok && res.status !== 204) throw new Error(await res.text().catch(() => "Delete failed"));
  },

  async listForEmployee(dealerId: string, employeeId: string): Promise<{ rows: EmployeeComponentAssignment[]; total: number }> {
    const res = await vpsAuthedFetch(`/api/salary-components/employee/${employeeId}?dealerId=${encodeURIComponent(dealerId)}`);
    return jsonOrThrow(res);
  },
  async assign(
    dealerId: string,
    employeeId: string,
    payload: { component_id: string; amount_override?: number | null; percent_override?: number | null; active?: boolean }
  ): Promise<EmployeeComponentAssignment> {
    const res = await vpsAuthedFetch(`/api/salary-components/employee/${employeeId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dealerId, ...payload }),
    });
    const { row } = await jsonOrThrow<{ row: EmployeeComponentAssignment }>(res);
    return row;
  },
  async updateAssignment(
    id: string,
    dealerId: string,
    data: { amount_override?: number | null; percent_override?: number | null; active?: boolean }
  ): Promise<EmployeeComponentAssignment> {
    const res = await vpsAuthedFetch(`/api/salary-components/employee-assign/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dealerId, data }),
    });
    const { row } = await jsonOrThrow<{ row: EmployeeComponentAssignment }>(res);
    return row;
  },
  async removeAssignment(id: string, dealerId: string): Promise<void> {
    const res = await vpsAuthedFetch(`/api/salary-components/employee-assign/${id}?dealerId=${encodeURIComponent(dealerId)}`, {
      method: "DELETE",
    });
    if (!res.ok && res.status !== 204) throw new Error(await res.text().catch(() => "Delete failed"));
  },

  async preview(dealerId: string, employeeId: string, basic: number): Promise<SalaryPreview> {
    const qs = new URLSearchParams({ dealerId, basic: String(basic) });
    const res = await vpsAuthedFetch(`/api/salary-components/preview/${employeeId}?${qs.toString()}`);
    return jsonOrThrow(res);
  },
};
