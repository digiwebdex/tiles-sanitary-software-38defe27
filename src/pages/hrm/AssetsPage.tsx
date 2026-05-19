import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, UserPlus, Undo2, History, Laptop } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { useDealerId } from "@/hooks/useDealerId";
import { employeeService, Employee } from "@/services/employeeService";
import { assetService, Asset, AssetCondition, AssetStatus } from "@/services/assetService";

const EMPTY: Partial<Asset> = {
  tag: "",
  name: "",
  category: "laptop",
  serial_no: "",
  brand: "",
  model: "",
  purchase_cost: 0,
  condition: "good",
  status: "available",
};

const CATEGORIES = ["laptop", "phone", "vehicle", "furniture", "tool", "other"];
const CONDITIONS: AssetCondition[] = ["new", "good", "fair", "damaged", "lost"];
const STATUSES: AssetStatus[] = ["available", "assigned", "retired", "lost"];

function statusBadge(s: AssetStatus) {
  const map: Record<AssetStatus, string> = {
    available: "bg-emerald-500/15 text-emerald-400 border-emerald-500/40",
    assigned: "bg-amber-500/15 text-amber-400 border-amber-500/40",
    retired: "bg-slate-500/15 text-slate-400 border-slate-500/40",
    lost: "bg-rose-500/15 text-rose-400 border-rose-500/40",
  };
  return <Badge variant="outline" className={map[s]}>{s}</Badge>;
}

function todayISO() { return new Date().toISOString().slice(0, 10); }

export default function AssetsPage() {
  const dealerId = useDealerId();
  const [rows, setRows] = useState<Asset[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [statusFilter, setStatusFilter] = useState<AssetStatus | "all">("all");
  const [q, setQ] = useState("");

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Asset | null>(null);
  const [form, setForm] = useState<Partial<Asset>>(EMPTY);

  const [assignOpen, setAssignOpen] = useState<Asset | null>(null);
  const [returnOpen, setReturnOpen] = useState<Asset | null>(null);
  const [assignBody, setAssignBody] = useState({ employee_id: "", assigned_date: todayISO(), condition_at_assignment: "good" as AssetCondition, notes: "" });
  const [returnBody, setReturnBody] = useState({ returned_date: todayISO(), condition_at_return: "good" as AssetCondition, notes: "" });

  const [historyOf, setHistoryOf] = useState<Asset | null>(null);
  const [history, setHistory] = useState<any[]>([]);

  async function reload() {
    try {
      const [a, e] = await Promise.all([
        assetService.list({ status: statusFilter === "all" ? undefined : statusFilter, q: q || undefined }),
        employees.length ? Promise.resolve(employees) : employeeService.list(dealerId),
      ]);
      setRows(a);
      if (!employees.length) setEmployees(e as Employee[]);
    } catch (e: any) {
      toast({ title: "Load failed", description: String(e.message ?? e), variant: "destructive" });
    }
  }
  useEffect(() => { reload(); /* eslint-disable-next-line */ }, [statusFilter]);

  const empMap = useMemo(() => Object.fromEntries(employees.map(e => [e.id, e])), [employees]);

  const stats = useMemo(() => {
    const total = rows.length;
    const assigned = rows.filter(r => r.status === "assigned").length;
    const available = rows.filter(r => r.status === "available").length;
    const cost = rows.reduce((s, r) => s + Number(r.purchase_cost || 0), 0);
    return { total, assigned, available, cost };
  }, [rows]);

  function startNew() {
    setEditing(null);
    setForm(EMPTY);
    setOpen(true);
  }
  function startEdit(a: Asset) {
    setEditing(a);
    setForm(a);
    setOpen(true);
  }

  async function save() {
    if (!form.tag || !form.name) return toast({ title: "Tag and name required", variant: "destructive" });
    try {
      if (editing) await assetService.update(editing.id, form);
      else await assetService.create(form);
      toast({ title: editing ? "Asset updated" : "Asset added" });
      setOpen(false);
      reload();
    } catch (e: any) {
      toast({ title: "Save failed", description: String(e.message ?? e), variant: "destructive" });
    }
  }

  async function remove(a: Asset) {
    if (!confirm(`Delete ${a.tag}?`)) return;
    try {
      await assetService.remove(a.id);
      toast({ title: "Deleted" });
      reload();
    } catch (e: any) {
      toast({ title: "Delete failed", description: String(e.message ?? e), variant: "destructive" });
    }
  }

  async function doAssign() {
    if (!assignOpen) return;
    if (!assignBody.employee_id) return toast({ title: "Pick an employee", variant: "destructive" });
    try {
      await assetService.assign(assignOpen.id, assignBody);
      toast({ title: "Assigned" });
      setAssignOpen(null);
      setAssignBody({ employee_id: "", assigned_date: todayISO(), condition_at_assignment: "good", notes: "" });
      reload();
    } catch (e: any) {
      toast({ title: "Assign failed", description: String(e.message ?? e), variant: "destructive" });
    }
  }

  async function doReturn() {
    if (!returnOpen) return;
    try {
      await assetService.returnAsset(returnOpen.id, returnBody);
      toast({ title: "Returned" });
      setReturnOpen(null);
      setReturnBody({ returned_date: todayISO(), condition_at_return: "good", notes: "" });
      reload();
    } catch (e: any) {
      toast({ title: "Return failed", description: String(e.message ?? e), variant: "destructive" });
    }
  }

  async function showHistory(a: Asset) {
    setHistoryOf(a);
    try {
      const detail = await assetService.get(a.id);
      setHistory(detail.history || []);
    } catch (e: any) {
      toast({ title: "Failed to load history", description: String(e.message ?? e), variant: "destructive" });
    }
  }

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Laptop className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Asset Management</h1>
        </div>
        <Button onClick={startNew}><Plus className="h-4 w-4 mr-1" /> Add Asset</Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="pt-6"><div className="text-xs text-muted-foreground">Total Assets</div><div className="text-2xl font-bold">{stats.total}</div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="text-xs text-muted-foreground">Currently Assigned</div><div className="text-2xl font-bold text-amber-400">{stats.assigned}</div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="text-xs text-muted-foreground">Available</div><div className="text-2xl font-bold text-emerald-400">{stats.available}</div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="text-xs text-muted-foreground">Total Cost</div><div className="text-2xl font-bold">{formatCurrency(stats.cost)}</div></CardContent></Card>
      </div>

      <Tabs defaultValue="catalog">
        <TabsList>
          <TabsTrigger value="catalog">Catalog</TabsTrigger>
          <TabsTrigger value="assignments">Active Assignments</TabsTrigger>
        </TabsList>

        <TabsContent value="catalog" className="space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Input placeholder="Search tag / name / serial" value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === "Enter" && reload()} className="max-w-xs" />
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={reload}>Apply</Button>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tag</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Serial</TableHead>
                    <TableHead>Condition</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Assigned To</TableHead>
                    <TableHead className="text-right">Cost</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.length === 0 && (
                    <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-6">No assets</TableCell></TableRow>
                  )}
                  {rows.map(a => (
                    <TableRow key={a.id}>
                      <TableCell className="font-mono">{a.tag}</TableCell>
                      <TableCell>{a.name}</TableCell>
                      <TableCell className="capitalize">{a.category}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{a.serial_no || "—"}</TableCell>
                      <TableCell className="capitalize">{a.condition}</TableCell>
                      <TableCell>{statusBadge(a.status)}</TableCell>
                      <TableCell>{a.employee_name ? <span>{a.employee_name}<span className="text-xs text-muted-foreground ml-1">({a.employee_code})</span></span> : "—"}</TableCell>
                      <TableCell className="text-right">{formatCurrency(Number(a.purchase_cost || 0))}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {a.status === "available" && (
                            <Button size="sm" variant="outline" onClick={() => setAssignOpen(a)} title="Assign"><UserPlus className="h-3.5 w-3.5" /></Button>
                          )}
                          {a.status === "assigned" && (
                            <Button size="sm" variant="outline" onClick={() => setReturnOpen(a)} title="Return"><Undo2 className="h-3.5 w-3.5" /></Button>
                          )}
                          <Button size="sm" variant="ghost" onClick={() => showHistory(a)} title="History"><History className="h-3.5 w-3.5" /></Button>
                          <Button size="sm" variant="ghost" onClick={() => startEdit(a)}><Pencil className="h-3.5 w-3.5" /></Button>
                          <Button size="sm" variant="ghost" onClick={() => remove(a)}><Trash2 className="h-3.5 w-3.5 text-rose-400" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="assignments">
          <Card>
            <CardHeader><CardTitle>Currently Assigned</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tag</TableHead>
                    <TableHead>Asset</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Employee</TableHead>
                    <TableHead>Since</TableHead>
                    <TableHead>Condition</TableHead>
                    <TableHead className="text-right">Return</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.filter(r => r.status === "assigned").length === 0 && (
                    <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">No assignments</TableCell></TableRow>
                  )}
                  {rows.filter(r => r.status === "assigned").map(a => (
                    <TableRow key={a.id}>
                      <TableCell className="font-mono">{a.tag}</TableCell>
                      <TableCell>{a.name}</TableCell>
                      <TableCell className="capitalize">{a.category}</TableCell>
                      <TableCell>{a.employee_name} <span className="text-xs text-muted-foreground">({a.employee_code})</span></TableCell>
                      <TableCell>{a.assigned_at?.slice(0, 10)}</TableCell>
                      <TableCell className="capitalize">{a.condition}</TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="outline" onClick={() => setReturnOpen(a)}><Undo2 className="h-3.5 w-3.5 mr-1" /> Return</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add / Edit dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{editing ? "Edit Asset" : "Add Asset"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Tag *</Label><Input value={form.tag ?? ""} onChange={e => setForm({ ...form, tag: e.target.value })} /></div>
            <div><Label>Name *</Label><Input value={form.name ?? ""} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
            <div>
              <Label>Category</Label>
              <Select value={form.category ?? "other"} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Condition</Label>
              <Select value={form.condition ?? "good"} onValueChange={(v) => setForm({ ...form, condition: v as AssetCondition })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CONDITIONS.map(c => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Serial No.</Label><Input value={form.serial_no ?? ""} onChange={e => setForm({ ...form, serial_no: e.target.value })} /></div>
            <div><Label>Brand</Label><Input value={form.brand ?? ""} onChange={e => setForm({ ...form, brand: e.target.value })} /></div>
            <div><Label>Model</Label><Input value={form.model ?? ""} onChange={e => setForm({ ...form, model: e.target.value })} /></div>
            <div><Label>Purchase Date</Label><Input type="date" value={form.purchase_date?.slice(0, 10) ?? ""} onChange={e => setForm({ ...form, purchase_date: e.target.value || null })} /></div>
            <div><Label>Purchase Cost</Label><Input type="number" min="0" step="0.01" value={form.purchase_cost ?? 0} onChange={e => setForm({ ...form, purchase_cost: Number(e.target.value) })} /></div>
            {editing && (
              <div>
                <Label>Status</Label>
                <Select value={form.status ?? "available"} onValueChange={(v) => setForm({ ...form, status: v as AssetStatus })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            <div className="col-span-2"><Label>Notes</Label><Textarea rows={2} value={form.notes ?? ""} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save}>{editing ? "Update" : "Create"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign dialog */}
      <Dialog open={!!assignOpen} onOpenChange={(o) => !o && setAssignOpen(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Assign {assignOpen?.tag} — {assignOpen?.name}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Employee</Label>
              <Select value={assignBody.employee_id} onValueChange={(v) => setAssignBody({ ...assignBody, employee_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
                <SelectContent>
                  {employees.filter(e => e.status === "active").map(e => (
                    <SelectItem key={e.id} value={e.id}>{e.name} {e.employee_code ? `(${e.employee_code})` : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Assigned Date</Label><Input type="date" value={assignBody.assigned_date} onChange={e => setAssignBody({ ...assignBody, assigned_date: e.target.value })} /></div>
              <div>
                <Label>Condition at Handover</Label>
                <Select value={assignBody.condition_at_assignment} onValueChange={(v) => setAssignBody({ ...assignBody, condition_at_assignment: v as AssetCondition })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CONDITIONS.filter(c => c !== "lost").map(c => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Notes</Label><Textarea rows={2} value={assignBody.notes} onChange={e => setAssignBody({ ...assignBody, notes: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignOpen(null)}>Cancel</Button>
            <Button onClick={doAssign}>Assign</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Return dialog */}
      <Dialog open={!!returnOpen} onOpenChange={(o) => !o && setReturnOpen(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Return {returnOpen?.tag} — {returnOpen?.name}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground">
              Currently with: <span className="text-foreground font-medium">{returnOpen?.employee_name}</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Returned Date</Label><Input type="date" value={returnBody.returned_date} onChange={e => setReturnBody({ ...returnBody, returned_date: e.target.value })} /></div>
              <div>
                <Label>Condition at Return</Label>
                <Select value={returnBody.condition_at_return} onValueChange={(v) => setReturnBody({ ...returnBody, condition_at_return: v as AssetCondition })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CONDITIONS.map(c => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Notes</Label><Textarea rows={2} value={returnBody.notes} onChange={e => setReturnBody({ ...returnBody, notes: e.target.value })} /></div>
            {returnBody.condition_at_return === "lost" && (
              <div className="text-xs text-rose-400">Asset will be marked as <strong>lost</strong>.</div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReturnOpen(null)}>Cancel</Button>
            <Button onClick={doReturn}>Process Return</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* History dialog */}
      <Dialog open={!!historyOf} onOpenChange={(o) => !o && setHistoryOf(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle>History — {historyOf?.tag} {historyOf?.name}</DialogTitle></DialogHeader>
          <Table>
            <TableHeader><TableRow>
              <TableHead>Employee</TableHead>
              <TableHead>Assigned</TableHead>
              <TableHead>Returned</TableHead>
              <TableHead>Handover</TableHead>
              <TableHead>Return Cond.</TableHead>
              <TableHead>Notes</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {history.length === 0 && (<TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-4">No history</TableCell></TableRow>)}
              {history.map(h => (
                <TableRow key={h.id}>
                  <TableCell>{h.employee_name} <span className="text-xs text-muted-foreground">({h.employee_code})</span></TableCell>
                  <TableCell>{h.assigned_date?.slice(0, 10)}</TableCell>
                  <TableCell>{h.returned_date ? h.returned_date.slice(0, 10) : <Badge variant="outline" className="bg-amber-500/15 text-amber-400 border-amber-500/40">Open</Badge>}</TableCell>
                  <TableCell className="capitalize">{h.condition_at_assignment ?? "—"}</TableCell>
                  <TableCell className="capitalize">{h.condition_at_return ?? "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{h.notes ?? ""}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DialogContent>
      </Dialog>
    </div>
  );
}
