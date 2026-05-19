import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { Plus, Check, X, Ban } from "lucide-react";
import { leaveService, LeaveType, LeaveBalance, LeaveRequest } from "@/services/leaveService";
import { employeeService } from "@/services/employeeService";

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-500/15 text-yellow-600 border-yellow-500/30",
  approved: "bg-green-500/15 text-green-600 border-green-500/30",
  rejected: "bg-red-500/15 text-red-600 border-red-500/30",
  cancelled: "bg-muted text-muted-foreground border-border",
};

export default function LeavesPage() {
  const [tab, setTab] = useState("requests");
  const [types, setTypes] = useState<LeaveType[]>([]);
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [statusFilter, setStatusFilter] = useState<string>("all");

  async function reload() {
    const [t, b, r, e] = await Promise.all([
      leaveService.listTypes(),
      leaveService.listBalances({ year }),
      leaveService.listRequests(statusFilter === "all" ? {} : { status: statusFilter }),
      employeeService.list(),
    ]);
    setTypes(t); setBalances(b); setRequests(r); setEmployees(e);
  }
  useEffect(() => { reload().catch((e) => toast({ title: "Load failed", description: String(e.message ?? e), variant: "destructive" })); }, [year, statusFilter]);

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Leave Management</h1>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="requests">Requests</TabsTrigger>
          <TabsTrigger value="balances">Balances</TabsTrigger>
          <TabsTrigger value="types">Leave Types</TabsTrigger>
        </TabsList>

        <TabsContent value="requests" className="space-y-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-3 flex-wrap">
              <CardTitle>Leave Requests</CardTitle>
              <div className="flex items-center gap-2">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
                <NewRequestDialog employees={employees} types={types} onCreated={reload} />
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>From</TableHead>
                    <TableHead>To</TableHead>
                    <TableHead className="text-right">Days</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requests.length === 0 && (
                    <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-6">No requests.</TableCell></TableRow>
                  )}
                  {requests.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.employee_name} <span className="text-xs text-muted-foreground">{r.employee_code}</span></TableCell>
                      <TableCell><Badge variant="outline" style={r.leave_type_color ? { borderColor: r.leave_type_color, color: r.leave_type_color } : {}}>{r.leave_type_name}</Badge></TableCell>
                      <TableCell>{r.start_date}</TableCell>
                      <TableCell>{r.end_date}</TableCell>
                      <TableCell className="text-right">{r.days}</TableCell>
                      <TableCell className="max-w-[200px] truncate" title={r.reason ?? ""}>{r.reason}</TableCell>
                      <TableCell><Badge variant="outline" className={STATUS_COLORS[r.status]}>{r.status}</Badge></TableCell>
                      <TableCell className="text-right space-x-1">
                        {r.status === "pending" && (
                          <>
                            <Button size="sm" variant="outline" onClick={async () => {
                              try { await leaveService.decide(r.id, "approved"); toast({ title: "Approved" }); reload(); }
                              catch (e: any) { toast({ title: "Failed", description: e.message, variant: "destructive" }); }
                            }}><Check className="h-4 w-4" /></Button>
                            <Button size="sm" variant="outline" onClick={async () => {
                              const note = window.prompt("Rejection note (optional)") ?? undefined;
                              try { await leaveService.decide(r.id, "rejected", note); toast({ title: "Rejected" }); reload(); }
                              catch (e: any) { toast({ title: "Failed", description: e.message, variant: "destructive" }); }
                            }}><X className="h-4 w-4" /></Button>
                          </>
                        )}
                        {(r.status === "pending" || r.status === "approved") && (
                          <Button size="sm" variant="ghost" onClick={async () => {
                            if (!confirm("Cancel this leave?")) return;
                            try { await leaveService.cancel(r.id); toast({ title: "Cancelled" }); reload(); }
                            catch (e: any) { toast({ title: "Failed", description: e.message, variant: "destructive" }); }
                          }}><Ban className="h-4 w-4" /></Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="balances" className="space-y-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-3 flex-wrap">
              <CardTitle>Leave Balances</CardTitle>
              <div className="flex items-center gap-2">
                <Label>Year</Label>
                <Input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} className="w-24" />
                <AllocateDialog employees={employees} types={types} year={year} onSaved={reload} />
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Leave Type</TableHead>
                    <TableHead className="text-right">Allocated</TableHead>
                    <TableHead className="text-right">Used</TableHead>
                    <TableHead className="text-right">Remaining</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {balances.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">No allocations for {year}.</TableCell></TableRow>}
                  {balances.map((b) => (
                    <TableRow key={b.id}>
                      <TableCell>{b.employee_name} <span className="text-xs text-muted-foreground">{b.employee_code}</span></TableCell>
                      <TableCell>{b.leave_type_name}</TableCell>
                      <TableCell className="text-right">{Number(b.allocated).toFixed(1)}</TableCell>
                      <TableCell className="text-right">{Number(b.used).toFixed(1)}</TableCell>
                      <TableCell className="text-right font-medium">{(Number(b.allocated) - Number(b.used)).toFixed(1)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="types" className="space-y-3">
          <LeaveTypesCard types={types} onChange={reload} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function NewRequestDialog({ employees, types, onCreated }: { employees: any[]; types: LeaveType[]; onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ employee_id: "", leave_type_id: "", start_date: "", end_date: "", reason: "" });
  const days = useMemo(() => {
    if (!form.start_date || !form.end_date) return 0;
    const d = (new Date(form.end_date).getTime() - new Date(form.start_date).getTime()) / 86400000 + 1;
    return Math.max(0, Math.round(d));
  }, [form.start_date, form.end_date]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" /> New Request</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>New Leave Request</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Employee</Label>
            <Select value={form.employee_id} onValueChange={(v) => setForm({ ...form, employee_id: v })}>
              <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
              <SelectContent>{employees.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Leave Type</Label>
            <Select value={form.leave_type_id} onValueChange={(v) => setForm({ ...form, leave_type_id: v })}>
              <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
              <SelectContent>{types.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>From</Label><Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></div>
            <div><Label>To</Label><Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} /></div>
          </div>
          <div className="text-sm text-muted-foreground">Total: <span className="font-medium text-foreground">{days} day(s)</span></div>
          <div><Label>Reason</Label><Textarea value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={async () => {
            try {
              await leaveService.createRequest({ ...form, reason: form.reason || undefined });
              toast({ title: "Request submitted" });
              setOpen(false); setForm({ employee_id: "", leave_type_id: "", start_date: "", end_date: "", reason: "" });
              onCreated();
            } catch (e: any) { toast({ title: "Failed", description: e.message, variant: "destructive" }); }
          }}>Submit</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AllocateDialog({ employees, types, year, onSaved }: { employees: any[]; types: LeaveType[]; year: number; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ employee_id: "", leave_type_id: "", allocated: 0 });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm" variant="outline"><Plus className="h-4 w-4 mr-1" /> Allocate</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Allocate Leave ({year})</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Employee</Label>
            <Select value={form.employee_id} onValueChange={(v) => setForm({ ...form, employee_id: v })}>
              <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
              <SelectContent>{employees.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Leave Type</Label>
            <Select value={form.leave_type_id} onValueChange={(v) => {
              const t = types.find(x => x.id === v);
              setForm({ ...form, leave_type_id: v, allocated: t?.annual_quota ?? 0 });
            }}>
              <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
              <SelectContent>{types.map((t) => <SelectItem key={t.id} value={t.id}>{t.name} ({t.annual_quota}d)</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Allocated days</Label><Input type="number" step="0.5" value={form.allocated} onChange={(e) => setForm({ ...form, allocated: Number(e.target.value) })} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={async () => {
            try {
              await leaveService.upsertBalance({ ...form, year });
              toast({ title: "Saved" }); setOpen(false); onSaved();
            } catch (e: any) { toast({ title: "Failed", description: e.message, variant: "destructive" }); }
          }}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LeaveTypesCard({ types, onChange }: { types: LeaveType[]; onChange: () => void }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<LeaveType | null>(null);
  const [form, setForm] = useState<Partial<LeaveType>>({ code: "", name: "", annual_quota: 0, is_paid: true, color: "#3b82f6" });

  function openNew() { setEditing(null); setForm({ code: "", name: "", annual_quota: 0, is_paid: true, color: "#3b82f6" }); setOpen(true); }
  function openEdit(t: LeaveType) { setEditing(t); setForm(t); setOpen(true); }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Leave Types</CardTitle>
        <Button size="sm" onClick={openNew}><Plus className="h-4 w-4 mr-1" /> New Type</Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead className="text-right">Annual Quota</TableHead>
              <TableHead>Paid</TableHead>
              <TableHead>Active</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {types.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">No leave types yet.</TableCell></TableRow>}
            {types.map((t) => (
              <TableRow key={t.id}>
                <TableCell className="font-mono">{t.code}</TableCell>
                <TableCell>
                  <span className="inline-flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full" style={{ background: t.color ?? "#3b82f6" }} />
                    {t.name}
                  </span>
                </TableCell>
                <TableCell className="text-right">{t.annual_quota}</TableCell>
                <TableCell>{t.is_paid ? "Paid" : "Unpaid"}</TableCell>
                <TableCell>{t.is_active ? "Yes" : "No"}</TableCell>
                <TableCell className="text-right space-x-1">
                  <Button size="sm" variant="outline" onClick={() => openEdit(t)}>Edit</Button>
                  <Button size="sm" variant="ghost" onClick={async () => {
                    if (!confirm(`Delete ${t.name}?`)) return;
                    try { await leaveService.deleteType(t.id); toast({ title: "Deleted" }); onChange(); }
                    catch (e: any) { toast({ title: "Failed", description: e.message, variant: "destructive" }); }
                  }}>Delete</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Edit" : "New"} Leave Type</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Code</Label><Input value={form.code ?? ""} onChange={(e) => setForm({ ...form, code: e.target.value })} /></div>
            <div><Label>Name</Label><Input value={form.name ?? ""} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label>Annual Quota (days)</Label><Input type="number" value={form.annual_quota ?? 0} onChange={(e) => setForm({ ...form, annual_quota: Number(e.target.value) })} /></div>
            <div><Label>Color</Label><Input type="color" value={form.color ?? "#3b82f6"} onChange={(e) => setForm({ ...form, color: e.target.value })} /></div>
            <div className="flex items-center gap-2"><input type="checkbox" checked={!!form.is_paid} onChange={(e) => setForm({ ...form, is_paid: e.target.checked })} /> <Label>Paid leave</Label></div>
            <div className="flex items-center gap-2"><input type="checkbox" checked={form.is_active !== false} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} /> <Label>Active</Label></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={async () => {
              try {
                if (editing) await leaveService.updateType(editing.id, form);
                else await leaveService.createType(form);
                toast({ title: "Saved" }); setOpen(false); onChange();
              } catch (e: any) { toast({ title: "Failed", description: e.message, variant: "destructive" }); }
            }}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
