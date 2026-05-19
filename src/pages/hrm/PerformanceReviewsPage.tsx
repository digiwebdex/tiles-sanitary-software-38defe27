import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Award, Plus, Trash2, CheckCircle2, Eye } from "lucide-react";
import { useDealerId } from "@/hooks/useDealerId";
import { employeeService, Employee } from "@/services/employeeService";
import {
  performanceService, PerformanceReview, PerformanceKpi, gradeBadgeVariant,
} from "@/services/performanceService";

const DEFAULT_KPIS: Partial<PerformanceKpi>[] = [
  { kpi_name: "Sales Target", weight: 40, target: 0, achieved: 0, score: 0 },
  { kpi_name: "Customer Satisfaction", weight: 20, target: 100, achieved: 0, score: 0 },
  { kpi_name: "Attendance / Punctuality", weight: 20, target: 100, achieved: 0, score: 0 },
  { kpi_name: "Teamwork & Initiative", weight: 20, target: 100, achieved: 0, score: 0 },
];

export default function PerformanceReviewsPage() {
  const dealerId = useDealerId();
  const [reviews, setReviews] = useState<PerformanceReview[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [filterPeriod, setFilterPeriod] = useState("");
  const [filterEmp, setFilterEmp] = useState("");

  // create
  const [openNew, setOpenNew] = useState(false);
  const [newForm, setNewForm] = useState({
    employee_id: "",
    period: new Date().toISOString().slice(0, 7),
    reviewer: "",
  });
  const [newKpis, setNewKpis] = useState<Partial<PerformanceKpi>[]>(DEFAULT_KPIS);

  // detail
  const [detail, setDetail] = useState<PerformanceReview | null>(null);
  const [savingKpi, setSavingKpi] = useState(false);
  const [newKpi, setNewKpi] = useState<Partial<PerformanceKpi>>({
    kpi_name: "", weight: 0, target: 0, achieved: 0, score: 0,
  });

  async function reloadReviews() {
    try {
      const list = await performanceService.list({
        period: filterPeriod || undefined,
        employee_id: filterEmp || undefined,
      });
      setReviews(list);
    } catch (e: any) {
      toast({ title: "Load failed", description: String(e.message ?? e), variant: "destructive" });
    }
  }

  useEffect(() => {
    if (!dealerId) return;
    employeeService.list(dealerId).then(setEmployees).catch(() => {});
  }, [dealerId]);

  useEffect(() => { reloadReviews(); /* eslint-disable-next-line */ }, [filterPeriod, filterEmp]);

  async function createReview() {
    if (!newForm.employee_id) { toast({ title: "Pick employee", variant: "destructive" }); return; }
    try {
      await performanceService.create({
        employee_id: newForm.employee_id,
        period: newForm.period,
        reviewer: newForm.reviewer || null,
        kpis: newKpis.filter((k) => k.kpi_name),
      });
      toast({ title: "Review created" });
      setOpenNew(false);
      setNewKpis(DEFAULT_KPIS);
      setNewForm({ employee_id: "", period: new Date().toISOString().slice(0, 7), reviewer: "" });
      reloadReviews();
    } catch (e: any) {
      toast({ title: "Create failed", description: String(e.message ?? e), variant: "destructive" });
    }
  }

  async function openDetail(r: PerformanceReview) {
    try { setDetail(await performanceService.get(r.id)); }
    catch (e: any) { toast({ title: "Load failed", description: String(e.message ?? e), variant: "destructive" }); }
  }

  async function refreshDetail() {
    if (!detail) return;
    setDetail(await performanceService.get(detail.id));
    reloadReviews();
  }

  async function addKpi() {
    if (!detail || !newKpi.kpi_name) return;
    setSavingKpi(true);
    try {
      await performanceService.addKpi(detail.id, newKpi);
      setNewKpi({ kpi_name: "", weight: 0, target: 0, achieved: 0, score: 0 });
      await refreshDetail();
    } catch (e: any) {
      toast({ title: "Add KPI failed", description: String(e.message ?? e), variant: "destructive" });
    } finally { setSavingKpi(false); }
  }

  async function updateKpi(k: PerformanceKpi, patch: Partial<PerformanceKpi>) {
    try {
      await performanceService.updateKpi(k.id, patch);
      await refreshDetail();
    } catch (e: any) {
      toast({ title: "Update failed", description: String(e.message ?? e), variant: "destructive" });
    }
  }

  async function removeKpi(k: PerformanceKpi) {
    if (!confirm(`Remove KPI "${k.kpi_name}"?`)) return;
    await performanceService.removeKpi(k.id);
    await refreshDetail();
  }

  async function finalize() {
    if (!detail) return;
    if (!confirm("Finalize this review? KPIs locked after finalize (you can still re-finalize).")) return;
    await performanceService.finalize(detail.id);
    toast({ title: "Finalized" });
    await refreshDetail();
  }

  async function removeReview(r: PerformanceReview) {
    if (!confirm(`Delete review for ${r.employee_name} (${r.period})?`)) return;
    await performanceService.remove(r.id);
    if (detail?.id === r.id) setDetail(null);
    reloadReviews();
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Award className="h-6 w-6 text-primary" /> Performance Reviews
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Periodic KPI-based employee evaluations with weighted scoring and grades.
          </p>
        </div>
        <Dialog open={openNew} onOpenChange={setOpenNew}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />New Review</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>New Performance Review</DialogTitle></DialogHeader>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-1">
                <Label>Employee *</Label>
                <Select value={newForm.employee_id} onValueChange={(v) => setNewForm({ ...newForm, employee_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                  <SelectContent>
                    {employees.filter(e => e.status === "active").map(e => (
                      <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Period</Label>
                <Input value={newForm.period} onChange={e => setNewForm({ ...newForm, period: e.target.value })} placeholder="2026-05 or 2026-Q2" />
              </div>
              <div>
                <Label>Reviewer</Label>
                <Input value={newForm.reviewer} onChange={e => setNewForm({ ...newForm, reviewer: e.target.value })} />
              </div>
            </div>
            <div className="mt-2">
              <Label className="text-xs">Initial KPIs (you can edit/add later)</Label>
              <Table>
                <TableHeader><TableRow>
                  <TableHead>KPI</TableHead><TableHead className="w-20">Weight%</TableHead>
                  <TableHead className="w-20">Target</TableHead><TableHead className="w-20">Achieved</TableHead>
                  <TableHead className="w-20">Score</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {newKpis.map((k, i) => (
                    <TableRow key={i}>
                      <TableCell><Input value={k.kpi_name ?? ""} onChange={e => { const c = [...newKpis]; c[i] = { ...c[i], kpi_name: e.target.value }; setNewKpis(c); }} /></TableCell>
                      <TableCell><Input type="number" value={k.weight ?? 0} onChange={e => { const c = [...newKpis]; c[i] = { ...c[i], weight: Number(e.target.value) }; setNewKpis(c); }} /></TableCell>
                      <TableCell><Input type="number" value={k.target ?? 0} onChange={e => { const c = [...newKpis]; c[i] = { ...c[i], target: Number(e.target.value) }; setNewKpis(c); }} /></TableCell>
                      <TableCell><Input type="number" value={k.achieved ?? 0} onChange={e => { const c = [...newKpis]; c[i] = { ...c[i], achieved: Number(e.target.value) }; setNewKpis(c); }} /></TableCell>
                      <TableCell><Input type="number" value={k.score ?? 0} onChange={e => { const c = [...newKpis]; c[i] = { ...c[i], score: Number(e.target.value) }; setNewKpis(c); }} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Button size="sm" variant="outline" className="mt-2"
                onClick={() => setNewKpis([...newKpis, { kpi_name: "", weight: 0, target: 0, achieved: 0, score: 0 }])}>
                <Plus className="h-3 w-3 mr-1" />Add KPI row
              </Button>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpenNew(false)}>Cancel</Button>
              <Button onClick={createReview}>Create</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-3">
          <CardTitle>All Reviews</CardTitle>
          <div className="flex items-center gap-2">
            <Input placeholder="Filter period (e.g. 2026-05)" value={filterPeriod} onChange={e => setFilterPeriod(e.target.value)} className="w-48" />
            <Select value={filterEmp || "__all"} onValueChange={(v) => setFilterEmp(v === "__all" ? "" : v)}>
              <SelectTrigger className="w-48"><SelectValue placeholder="All employees" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all">All employees</SelectItem>
                {employees.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow>
              <TableHead>Period</TableHead><TableHead>Employee</TableHead>
              <TableHead>Reviewer</TableHead><TableHead className="text-right">Overall</TableHead>
              <TableHead>Grade</TableHead><TableHead>Status</TableHead><TableHead></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {reviews.map(r => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs">{r.period}</TableCell>
                  <TableCell className="font-medium">{r.employee_name}</TableCell>
                  <TableCell className="text-muted-foreground">{r.reviewer || "—"}</TableCell>
                  <TableCell className="text-right font-mono">{Number(r.overall_rating).toFixed(1)}</TableCell>
                  <TableCell><Badge variant={gradeBadgeVariant(r.grade)}>{r.grade || "—"}</Badge></TableCell>
                  <TableCell>
                    <Badge variant={r.status === "finalized" ? "default" : "outline"}>{r.status}</Badge>
                  </TableCell>
                  <TableCell className="space-x-1">
                    <Button size="sm" variant="outline" onClick={() => openDetail(r)}><Eye className="h-3 w-3" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => removeReview(r)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                  </TableCell>
                </TableRow>
              ))}
              {!reviews.length && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">No reviews yet.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          {detail && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  <Award className="h-5 w-5 text-primary" />
                  {detail.employee_name} <span className="text-muted-foreground font-mono text-sm">· {detail.period}</span>
                  <Badge variant={gradeBadgeVariant(detail.grade)} className="ml-auto">
                    {detail.grade || "—"} ({Number(detail.overall_rating).toFixed(1)})
                  </Badge>
                </DialogTitle>
              </DialogHeader>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-3 grid grid-cols-2 gap-3">
                  <div>
                    <Label>Strengths</Label>
                    <Textarea
                      defaultValue={detail.strengths || ""}
                      onBlur={(e) => performanceService.update(detail.id, { strengths: e.target.value }).then(refreshDetail)}
                    />
                  </div>
                  <div>
                    <Label>Areas for Improvement</Label>
                    <Textarea
                      defaultValue={detail.improvements || ""}
                      onBlur={(e) => performanceService.update(detail.id, { improvements: e.target.value }).then(refreshDetail)}
                    />
                  </div>
                  <div className="col-span-2">
                    <Label>Comments</Label>
                    <Textarea
                      defaultValue={detail.comments || ""}
                      onBlur={(e) => performanceService.update(detail.id, { comments: e.target.value }).then(refreshDetail)}
                    />
                  </div>
                </div>
              </div>

              <div className="mt-2">
                <h3 className="font-semibold mb-2">KPIs (weighted average → overall)</h3>
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>KPI</TableHead><TableHead className="w-24">Weight%</TableHead>
                    <TableHead className="w-24">Target</TableHead><TableHead className="w-24">Achieved</TableHead>
                    <TableHead className="w-24">Score</TableHead><TableHead></TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {(detail.kpis ?? []).map((k) => (
                      <TableRow key={k.id}>
                        <TableCell><Input defaultValue={k.kpi_name} onBlur={(e) => e.target.value !== k.kpi_name && updateKpi(k, { kpi_name: e.target.value })} /></TableCell>
                        <TableCell><Input type="number" defaultValue={k.weight} onBlur={(e) => Number(e.target.value) !== Number(k.weight) && updateKpi(k, { weight: Number(e.target.value) })} /></TableCell>
                        <TableCell><Input type="number" defaultValue={k.target} onBlur={(e) => Number(e.target.value) !== Number(k.target) && updateKpi(k, { target: Number(e.target.value) })} /></TableCell>
                        <TableCell><Input type="number" defaultValue={k.achieved} onBlur={(e) => Number(e.target.value) !== Number(k.achieved) && updateKpi(k, { achieved: Number(e.target.value) })} /></TableCell>
                        <TableCell><Input type="number" defaultValue={k.score} onBlur={(e) => Number(e.target.value) !== Number(k.score) && updateKpi(k, { score: Number(e.target.value) })} /></TableCell>
                        <TableCell><Button size="sm" variant="ghost" onClick={() => removeKpi(k)}><Trash2 className="h-3 w-3 text-destructive" /></Button></TableCell>
                      </TableRow>
                    ))}
                    <TableRow>
                      <TableCell><Input placeholder="New KPI…" value={newKpi.kpi_name ?? ""} onChange={(e) => setNewKpi({ ...newKpi, kpi_name: e.target.value })} /></TableCell>
                      <TableCell><Input type="number" value={newKpi.weight ?? 0} onChange={(e) => setNewKpi({ ...newKpi, weight: Number(e.target.value) })} /></TableCell>
                      <TableCell><Input type="number" value={newKpi.target ?? 0} onChange={(e) => setNewKpi({ ...newKpi, target: Number(e.target.value) })} /></TableCell>
                      <TableCell><Input type="number" value={newKpi.achieved ?? 0} onChange={(e) => setNewKpi({ ...newKpi, achieved: Number(e.target.value) })} /></TableCell>
                      <TableCell><Input type="number" value={newKpi.score ?? 0} onChange={(e) => setNewKpi({ ...newKpi, score: Number(e.target.value) })} /></TableCell>
                      <TableCell><Button size="sm" onClick={addKpi} disabled={savingKpi}><Plus className="h-3 w-3" /></Button></TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setDetail(null)}>Close</Button>
                <Button onClick={finalize}><CheckCircle2 className="h-4 w-4 mr-1" />Recompute & Finalize</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
