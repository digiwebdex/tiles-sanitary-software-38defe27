import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ShieldCheck, ArrowLeft, Search, UserPlus, Pencil, Eye } from "lucide-react";
import { teamService, ROLE_META, type AppRole, type TeamMember } from "@/services/teamService";
import { usePermissions } from "@/hooks/usePermissions";
import InviteMemberDialog from "@/components/team/InviteMemberDialog";
import EditMemberDialog from "@/components/team/EditMemberDialog";
import PermissionMatrix from "@/components/team/PermissionMatrix";

const ROLES: AppRole[] = ["dealer_admin", "manager", "accountant", "salesman"];

function formatDate(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString();
}

const RoleManagementPage = () => {
  const { isDealerAdmin } = usePermissions();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | AppRole>("all");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editing, setEditing] = useState<TeamMember | null>(null);

  const teamQuery = useQuery({
    queryKey: ["team"],
    queryFn: () => teamService.list(),
    enabled: isDealerAdmin,
  });

  const filtered = useMemo(() => {
    const members = teamQuery.data?.members ?? [];
    const q = search.trim().toLowerCase();
    return members.filter((m) => {
      if (roleFilter !== "all" && m.role !== roleFilter) return false;
      if (q && !`${m.name} ${m.email}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [teamQuery.data, search, roleFilter]);

  if (!isDealerAdmin) {
    return (
      <div className="container mx-auto max-w-4xl p-6">
        <p className="text-destructive">Access denied. Dealer admin only.</p>
      </div>
    );
  }

  const counts = teamQuery.data?.counts ?? { dealer_admin: 0, manager: 0, accountant: 0, salesman: 0 };

  return (
    <div className="container mx-auto max-w-7xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <Link to="/settings" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to Settings
        </Link>
      </div>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
            <ShieldCheck className="h-6 w-6 text-primary" />
            Role Management
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage team member roles and view the permission matrix
          </p>
        </div>
        <Button onClick={() => setInviteOpen(true)}>
          <UserPlus className="h-4 w-4 mr-2" /> Invite Member
        </Button>
      </div>

      {/* Role count cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {ROLES.map((r) => (
          <Card key={r}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <Badge variant="outline" className={ROLE_META[r].tone}>{ROLE_META[r].label}</Badge>
                <span className="text-2xl font-bold">{counts[r] ?? 0}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{ROLE_META[r].description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="members" className="space-y-4">
        <TabsList>
          <TabsTrigger value="members">Team Members</TabsTrigger>
          <TabsTrigger value="matrix">Permission Matrix</TabsTrigger>
        </TabsList>

        <TabsContent value="members" className="space-y-4">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or email…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v as any)}>
              <SelectTrigger className="md:w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                {ROLES.map((r) => (
                  <SelectItem key={r} value={r}>{ROLE_META[r].label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Team Members ({filtered.length})</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 border-y">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Name</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Email</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Role</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Joined</th>
                      <th className="text-right px-4 py-3 font-medium text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {teamQuery.isLoading ? (
                      <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Loading…</td></tr>
                    ) : teamQuery.isError ? (
                      <tr><td colSpan={6} className="px-4 py-8 text-center text-destructive">{(teamQuery.error as Error).message}</td></tr>
                    ) : filtered.length === 0 ? (
                      <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No team members found</td></tr>
                    ) : (
                      filtered.map((m) => (
                        <tr key={m.id} className="border-b last:border-0 hover:bg-accent/30">
                          <td className="px-4 py-3 font-medium">{m.name}</td>
                          <td className="px-4 py-3 text-muted-foreground">{m.email}</td>
                          <td className="px-4 py-3">
                            {m.role ? (
                              <Badge variant="outline" className={ROLE_META[m.role].tone}>
                                {ROLE_META[m.role].label}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant={m.status === "active" ? "secondary" : "outline"} className={m.status === "active" ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/30" : ""}>
                              {m.status}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{formatDate(m.joined_at)}</td>
                          <td className="px-4 py-3 text-right">
                            <div className="inline-flex items-center gap-1">
                              <Button variant="ghost" size="icon" onClick={() => setEditing(m)} aria-label="View / edit">
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => setEditing(m)} aria-label="Edit">
                                <Pencil className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="matrix">
          <PermissionMatrix />
        </TabsContent>
      </Tabs>

      <InviteMemberDialog open={inviteOpen} onOpenChange={setInviteOpen} />
      <EditMemberDialog open={!!editing} member={editing} onOpenChange={(o) => { if (!o) setEditing(null); }} />
    </div>
  );
};

export default RoleManagementPage;
