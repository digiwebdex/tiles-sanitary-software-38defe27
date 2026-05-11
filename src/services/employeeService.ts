import { vpsAuthedFetch } from "@/lib/vpsAuthClient";

export interface Employee {
  id: string;
  dealer_id: string;
  employee_code: string | null;
  name: string;
  designation: string | null;
  department: string | null;
  phone: string | null;
  email: string | null;
  nid: string | null;
  address: string | null;
  joining_date: string | null;
  status: "active" | "inactive" | "terminated";
  notes: string | null;
}

export interface SalaryStructure {
  id: string;
  employee_id: string;
  basic: number;
  house_rent_pct: number;
  medical_pct: number;
  transport_pct: number;
  other_allowance: number;
  deduction: number;
  effective_from: string;
}

export interface SalaryPayment {
  id: string;
  employee_id: string;
  employee_name?: string;
  designation?: string | null;
  period: string;
  basic: number;
  house_rent: number;
  medical: number;
  transport: number;
  other_allowance: number;
  deduction: number;
  net_payable: number;
  payment_method: "cash" | "bank";
  bank_account_id: string | null;
  payment_date: string;
  notes: string | null;
}

const j = async (r: Response) => {
  if (!r.ok) {
    let msg = "Request failed";
    try { const e = await r.json(); msg = e.error?.formErrors?.[0] || e.error?.fieldErrors?.[Object.keys(e.error?.fieldErrors||{})[0]]?.[0] || (typeof e.error === "string" ? e.error : msg); } catch {}
    throw new Error(msg);
  }
  return r.json();
};

export const employeeService = {
  list: (dealerId: string) =>
    vpsAuthedFetch(`/api/employees?dealerId=${dealerId}`).then(j) as Promise<Employee[]>,
  create: (dealerId: string, data: Partial<Employee>) =>
    vpsAuthedFetch(`/api/employees?dealerId=${dealerId}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
    }).then(j) as Promise<Employee>,
  update: (id: string, dealerId: string, data: Partial<Employee>) =>
    vpsAuthedFetch(`/api/employees/${id}?dealerId=${dealerId}`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
    }).then(j) as Promise<Employee>,
  remove: (id: string, dealerId: string) =>
    vpsAuthedFetch(`/api/employees/${id}?dealerId=${dealerId}`, { method: "DELETE" }),

  getStructure: (id: string, dealerId: string) =>
    vpsAuthedFetch(`/api/employees/${id}/structure?dealerId=${dealerId}`).then(j) as Promise<SalaryStructure | null>,
  setStructure: (id: string, dealerId: string, data: Partial<SalaryStructure>) =>
    vpsAuthedFetch(`/api/employees/${id}/structure?dealerId=${dealerId}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
    }).then(j) as Promise<SalaryStructure>,

  payments: (dealerId: string, period?: string) => {
    const qs = new URLSearchParams({ dealerId });
    if (period) qs.set("period", period);
    return vpsAuthedFetch(`/api/employees/salary-payments?${qs}`).then(j) as Promise<SalaryPayment[]>;
  },
  payRoll: (id: string, dealerId: string, data: Partial<SalaryPayment>) =>
    vpsAuthedFetch(`/api/employees/${id}/salary-payments?dealerId=${dealerId}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
    }).then(j) as Promise<SalaryPayment>,
};
