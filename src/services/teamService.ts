/**
 * Team / Role Management — VPS API client.
 */
import { vpsAuthedFetch } from "@/lib/vpsAuthClient";

export type AppRole = "dealer_admin" | "manager" | "accountant" | "salesman";
export type MemberStatus = "active" | "inactive" | "pending";

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  status: MemberStatus;
  joined_at: string;
  invited_at: string | null;
  last_login_at: string | null;
  role: AppRole | null;
}

export interface TeamResponse {
  members: TeamMember[];
  counts: Record<AppRole, number>;
}

export interface InviteMemberInput {
  name: string;
  email: string;
  password: string;
  role: AppRole;
}

export interface UpdateMemberInput {
  name?: string;
  status?: MemberStatus;
  role?: AppRole;
}

async function jsonOrThrow(res: Response, action: string): Promise<any> {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = body?.error || `${action} failed (${res.status})`;
    throw new Error(msg);
  }
  return body;
}

export const teamService = {
  async list(): Promise<TeamResponse> {
    const res = await vpsAuthedFetch(`/api/team`);
    return jsonOrThrow(res, "Load team");
  },

  async invite(input: InviteMemberInput): Promise<{ id: string; email: string }> {
    const res = await vpsAuthedFetch(`/api/team`, {
      method: "POST",
      body: JSON.stringify(input),
    });
    return jsonOrThrow(res, "Invite member");
  },

  async update(userId: string, input: UpdateMemberInput): Promise<void> {
    const res = await vpsAuthedFetch(`/api/team/${userId}`, {
      method: "PUT",
      body: JSON.stringify(input),
    });
    await jsonOrThrow(res, "Update member");
  },

  async deactivate(userId: string): Promise<void> {
    const res = await vpsAuthedFetch(`/api/team/${userId}`, { method: "DELETE" });
    await jsonOrThrow(res, "Deactivate member");
  },
};

export const ROLE_META: Record<AppRole, { label: string; description: string; tone: string }> = {
  dealer_admin: {
    label: "Owner",
    description: "Full access. Manages team, subscription, and all modules.",
    tone: "bg-orange-500/10 text-orange-500 border-orange-500/30",
  },
  manager: {
    label: "Manager",
    description: "All operational modules — sales, purchase, inventory, reports. No team or billing.",
    tone: "bg-blue-500/10 text-blue-500 border-blue-500/30",
  },
  accountant: {
    label: "Accountant",
    description: "Ledgers, collections, expenses, and financial reports.",
    tone: "bg-amber-500/10 text-amber-500 border-amber-500/30",
  },
  salesman: {
    label: "Sales Agent",
    description: "Insert-only on sales, quotations, and customers.",
    tone: "bg-emerald-500/10 text-emerald-500 border-emerald-500/30",
  },
};
