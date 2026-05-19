import { vpsAuthedFetch } from "@/lib/vpsAuthClient";

export type LoanStatus = "active" | "closed" | "cancelled";
export type EmiStatus = "pending" | "partial" | "paid" | "waived";
export type PaymentSource = "salary_deduction" | "manual" | "cash" | "bank";

export interface EmployeeLoan {
  id: string;
  dealer_id: string;
  employee_id: string;
  loan_code: string;
  principal: number;
  tenure_months: number;
  emi_amount: number;
  issue_date: string;
  first_emi_date: string;
  payment_method: "cash" | "bank";
  bank_account_id?: string | null;
  status: LoanStatus;
  reason?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;

  employee_name?: string | null;
  employee_code?: string | null;
  bank_account_name?: string | null;
  paid_total?: number;
  balance?: number;
}

export interface LoanEmi {
  id: string;
  loan_id: string;
  installment_no: number;
  due_date: string;
  amount_due: number;
  amount_paid: number;
  paid_date?: string | null;
  status: EmiStatus;
  payment_source?: PaymentSource | null;
  reference?: string | null;
  notes?: string | null;
}

export interface LoanDetail extends EmployeeLoan {
  emis: LoanEmi[];
}

export interface LoanSummary {
  outstanding: number;
  due_this_month: number;
  overdue_amount: number;
  overdue_count: number;
  active_loans: number;
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

export const employeeLoanService = {
  summary: () => j<LoanSummary>(`/api/employee-loans/summary`),
  list: (params: { employee_id?: string; status?: LoanStatus } = {}) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v) qs.set(k, String(v)); });
    const s = qs.toString();
    return j<EmployeeLoan[]>(`/api/employee-loans${s ? `?${s}` : ""}`);
  },
  get: (id: string) => j<LoanDetail>(`/api/employee-loans/${id}`),
  employeeOutstanding: (employeeId: string) =>
    j<{ outstanding: number; active_loans: number }>(`/api/employee-loans/employee/${employeeId}/outstanding`),

  create: (body: {
    employee_id: string;
    principal: number;
    tenure_months: number;
    issue_date: string;
    first_emi_date?: string;
    payment_method?: "cash" | "bank";
    bank_account_id?: string | null;
    reason?: string | null;
    notes?: string | null;
  }) => j<EmployeeLoan>(`/api/employee-loans`, jsonInit("POST", body)),

  cancel: (id: string) => j<EmployeeLoan>(`/api/employee-loans/${id}/cancel`, jsonInit("POST", {})),
  close: (id: string) => j<EmployeeLoan>(`/api/employee-loans/${id}/close`, jsonInit("POST", {})),

  payEmi: (emiId: string, body: {
    amount: number;
    paid_date: string;
    payment_source: PaymentSource;
    reference?: string | null;
    notes?: string | null;
  }) => j<LoanEmi>(`/api/employee-loans/emis/${emiId}/pay`, jsonInit("POST", body)),

  waiveEmi: (emiId: string, notes?: string) =>
    j<LoanEmi>(`/api/employee-loans/emis/${emiId}/waive`, jsonInit("POST", { notes })),
};
