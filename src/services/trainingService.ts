import { vpsAuthedFetch } from "@/lib/vpsAuthClient";

export interface Skill {
  id: string;
  dealer_id: string;
  code: string;
  name: string;
  category?: string | null;
  description?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface EmployeeSkill {
  id: string;
  dealer_id: string;
  employee_id: string;
  skill_id: string;
  proficiency: number; // 1..5
  last_assessed?: string | null;
  assessed_by?: string | null;
  notes?: string | null;
  employee_name?: string;
  designation?: string | null;
  skill_name?: string;
  skill_category?: string | null;
}

export interface TrainingProgram {
  id: string;
  dealer_id: string;
  title: string;
  description?: string | null;
  trainer?: string | null;
  mode?: "in_person" | "online" | "hybrid";
  duration_hours?: number;
  cost?: number;
  start_date?: string | null;
  end_date?: string | null;
  status: "planned" | "ongoing" | "completed" | "cancelled";
  enrolled_count?: number;
  enrollments?: TrainingEnrollment[];
  created_at: string;
  updated_at: string;
}

export interface TrainingEnrollment {
  id: string;
  dealer_id: string;
  program_id: string;
  employee_id: string;
  status: "enrolled" | "in_progress" | "completed" | "dropped";
  score?: number | null;
  completed_date?: string | null;
  certificate_url?: string | null;
  feedback?: string | null;
  employee_name?: string;
  designation?: string | null;
}

export interface SkillMatrix {
  employees: { id: string; name: string; designation?: string | null }[];
  skills: { id: string; code: string; name: string; category?: string | null }[];
  matrix: Record<string, Record<string, number>>;
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

export const trainingService = {
  // Skills
  listSkills: () => j<Skill[]>(`/api/training/skills`),
  createSkill: (data: Partial<Skill>) => j<Skill>(`/api/training/skills`, jsonInit("POST", data)),
  updateSkill: (id: string, data: Partial<Skill>) =>
    j<Skill>(`/api/training/skills/${id}`, jsonInit("PUT", data)),
  removeSkill: (id: string) =>
    j<{ success: true }>(`/api/training/skills/${id}`, { method: "DELETE" }),

  // Employee skills
  listEmployeeSkills: (params: { employee_id?: string; skill_id?: string } = {}) => {
    const qs = new URLSearchParams();
    if (params.employee_id) qs.set("employee_id", params.employee_id);
    if (params.skill_id) qs.set("skill_id", params.skill_id);
    const s = qs.toString();
    return j<EmployeeSkill[]>(`/api/training/employee-skills${s ? `?${s}` : ""}`);
  },
  upsertEmployeeSkill: (data: Partial<EmployeeSkill>) =>
    j<EmployeeSkill>(`/api/training/employee-skills`, jsonInit("POST", data)),
  removeEmployeeSkill: (id: string) =>
    j<{ success: true }>(`/api/training/employee-skills/${id}`, { method: "DELETE" }),
  matrix: () => j<SkillMatrix>(`/api/training/matrix`),

  // Programs
  listPrograms: (status?: string) =>
    j<TrainingProgram[]>(`/api/training/programs${status ? `?status=${status}` : ""}`),
  getProgram: (id: string) => j<TrainingProgram>(`/api/training/programs/${id}`),
  createProgram: (data: Partial<TrainingProgram>) =>
    j<TrainingProgram>(`/api/training/programs`, jsonInit("POST", data)),
  updateProgram: (id: string, data: Partial<TrainingProgram>) =>
    j<TrainingProgram>(`/api/training/programs/${id}`, jsonInit("PUT", data)),
  removeProgram: (id: string) =>
    j<{ success: true }>(`/api/training/programs/${id}`, { method: "DELETE" }),

  // Enrollments
  enroll: (programId: string, employeeIds: string[]) =>
    j<{ inserted: number; skipped: number }>(
      `/api/training/programs/${programId}/enroll`,
      jsonInit("POST", { employee_ids: employeeIds })
    ),
  updateEnrollment: (enrollId: string, data: Partial<TrainingEnrollment>) =>
    j<TrainingEnrollment>(`/api/training/enrollments/${enrollId}`, jsonInit("PUT", data)),
  removeEnrollment: (enrollId: string) =>
    j<{ success: true }>(`/api/training/enrollments/${enrollId}`, { method: "DELETE" }),
};

export function proficiencyLabel(p: number): string {
  return ["—", "Beginner", "Basic", "Intermediate", "Advanced", "Expert"][p] || "—";
}
