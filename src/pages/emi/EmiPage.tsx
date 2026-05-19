import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useDealerId } from "@/hooks/useDealerId";
import { emiService, type EmiPlan, type EmiInstallment } from "@/services/emiService";
import { customerService } from "@/services/customerService";
import { formatCurrency } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { Plus, AlertTriangle, CalendarClock, CheckCircle2, XCircle, Eye } from "lucide-react";

const today = () => new Date().toISOString().slice(0, 10);

const statusBadge = (s: string) => {
  const map: Record<string, string> = {
    active: "bg-blue-500/15 text-blue-500 border-blue-500/30",
    closed: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30",
    cancelled: "bg-muted text-muted-foreground",
    paid: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30",
    pending: "bg-amber-500/15 text-amber-500 border-amber-500/30",
    partial: "bg-orange-500/15 text-orange-500 border-orange-500/30",
    overdue: "bg-red-500/15 text-red-500 border-red-500/30",
  };
  return <Badge variant="outline" className={map[s] || ""}>{s}</Badge>;
};

const EmiPage = () => {
  const dealerId = useDealerId();
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("");

  const { data: plans, isLoading } = useQuery({
    queryKey: ["emi-plans", dealerId, statusFilter],
    queryFn: () => emiService.list(dealerId!, { status: statusFilter || undefined, limit: 100 }),
    enabled: !!dealerId,
  });

  const { data: overdue } = useQuery({
    queryKey: ["emi-overdue", dealerId],
    queryFn: () => emiService.overdue(dealerId!),
    enabled: !!dealerId,
  });

  const { data: customers } = useQuery({
    queryKey: ["customers-for-emi", dealerId],
    queryFn: () => customerService.list(dealerId!, "", "", 1),
    enabled: !!dealerId && createOpen,
  });

  const summary = useMemo(() => {
    const rows = plans?.rows ?? [];
    return {
      activeCount: rows.filter(r => r.status === "active").length,
      totalPrincipal: rows.reduce((s, r) => s + Number(r.principal || 0), 0),
      totalPaid: rows.reduce((s, r) => s + Number(r.paid_total || 0), 0),
      overdueCount: overdue?.rows.length ?? 0,
      overdueAmount: (overdue?.rows ?? []).reduce((s, r) => s + (Number(r.amount) - Number(r.paid_amount)), 0),
    };
  }, [plans, overdue]);

  return (
    <div className="container mx-auto p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2"><CalendarClock className="h-6 w-6" /> EMI Plans</h1>
        <Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4 mr-2" /> New EMI Plan</Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="pt-6"><div className="text-xs text-muted-foreground">Active Plans</div><div className="text-2xl font-bold">{summary.activeCount}</div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="text-xs text-muted-foreground">Total Financed</div><div className="text-2xl font-bold font-mono">{formatCurrency(summary.totalPrincipal)}</div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="text-xs text-muted-foreground">Collected</div><div className="text-2xl font-bold font-mono text-emerald-500">{formatCurrency(summary.totalPaid)}</div></CardContent></Card>
        <Card className="border-red-500/30"><CardContent className="pt-6"><div className="text-xs text-muted-foreground flex items-center gap-1"><AlertTriangle className="h-3 w-3 text-red-500" /> Overdue ({summary.overdueCount})</div><div className="text-2xl font-bold font-mono text-red-500">{formatCurrency(summary.overdueAmount)}</div></CardContent></Card>
      </div>

      {/* Overdue alerts */}
      {!!overdue?.rows.length && (
        <Card className="border-red-500/30">
          <CardHeader><CardTitle className="text-base flex items-center gap-2 text-red-500"><AlertTriangle className="h-4 w-4" /> Overdue Installments</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow>
                <TableHead>Plan</TableHead><TableHead>Customer</TableHead><TableHead>Inst. #</TableHead>
                <TableHead>Due Date</TableHead><TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Days Late</TableHead><TableHead></TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {overdue.rows.slice(0, 10).map(r => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs">{r.plan_no}</TableCell>
                    <TableCell>{r.customer_name}<div className="text-xs text-muted-foreground">{r.customer_phone || ""}</div></TableCell>
                    <TableCell>#{r.installment_no}</TableCell>
                    <TableCell>{r.due_date}</TableCell>
                    <TableCell className="text-right font-mono">{formatCurrency(Number(r.amount) - Number(r.paid_amount))}</TableCell>
                    <TableCell className="text-right text-red-500 font-bold">{r.days_overdue}</TableCell>
                    <TableCell><Button size="sm" variant="outline" onClick={() => setDetailId(r.plan_id)}><Eye className="h-3 w-3" /></Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Plans list */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>All Plans {plans ? `(${plans.total})` : ""}</CardTitle>
          <Select value={statusFilter || "all"} onValueChange={v => setStatusFilter(v === "all" ? "" : v)}>
            <SelectTrigger className="w-40"><SelectValue placeholder="All statuses" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          {isLoading ? <p>Loading…</p> : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Plan #</TableHead><TableHead>Customer</TableHead>
                <TableHead>Start</TableHead><TableHead>Tenure</TableHead>
                <TableHead className="text-right">Principal</TableHead>
                <TableHead className="text-right">Installment</TableHead>
                <TableHead className="text-right">Paid</TableHead>
                <TableHead>Progress</TableHead>
                <TableHead>Status</TableHead><TableHead></TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {plans?.rows.map(r => {
                  const paid = Number(r.paid_total || 0);
                  const pct = r.principal > 0 ? Math.min(100, Math.round((paid / Number(r.principal)) * 100)) : 0;
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono text-xs">{r.plan_no}</TableCell>
                      <TableCell>{r.customer_name || "—"}</TableCell>
                      <TableCell>{r.start_date}</TableCell>
                      <TableCell>{r.tenure_months} mo</TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(Number(r.principal))}</TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(Number(r.installment_amount))}</TableCell>
                      <TableCell className="text-right font-mono text-emerald-500">{formatCurrency(paid)}</TableCell>
                      <TableCell><div className="text-xs">{Number(r.paid_count || 0)}/{r.tenure_months} ({pct}%)</div><div className="h-1 bg-muted rounded mt-1 overflow-hidden"><div className="h-full bg-emerald-500" style={{ width: `${pct}%` }} /></div></TableCell>
                      <TableCell>{statusBadge(r.status)}</TableCell>
                      <TableCell><Button size="sm" variant="ghost" onClick={() => setDetailId(r.id)}><Eye className="h-4 w-4" /></Button></TableCell>
                    </TableRow>
                  );
                })}
                {!plans?.rows.length && <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground">No EMI plans yet</TableCell></TableRow>}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <CreatePlanDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        customers={customers?.data ?? []}
        onCreated={() => {
          qc.invalidateQueries({ queryKey: ["emi-plans"] });
          qc.invalidateQueries({ queryKey: ["emi-overdue"] });
        }}
      />

      <PlanDetailDialog
        planId={detailId}
        onClose={() => setDetailId(null)}
        onChanged={() => {
          qc.invalidateQueries({ queryKey: ["emi-plans"] });
          qc.invalidateQueries({ queryKey: ["emi-overdue"] });
        }}
      />
    </div>
  );
};

// ────────────────────────────────────────────────────────────────────
const CreatePlanDialog = ({ open, onOpenChange, customers, onCreated }: {
  open: boolean; onOpenChange: (v: boolean) => void; customers: any[]; onCreated: () => void;
}) => {
  const dealerId = useDealerId();
  const [form, setForm] = useState({
    customer_id: "", principal: 0, tenure_months: 12, start_date: today(), narration: "",
  });
  const [saving, setSaving] = useState(false);
  const installment = form.principal > 0 && form.tenure_months > 0
    ? Math.round((Number(form.principal) / form.tenure_months) * 100) / 100 : 0;

  const handleSave = async () => {
    if (!dealerId) return;
    if (!form.customer_id) return toast({ title: "Select a customer", variant: "destructive" });
    if (form.principal <= 0) return toast({ title: "Principal must be > 0", variant: "destructive" });
    setSaving(true);
    try {
      const res = await emiService.create(dealerId, {
        customer_id: form.customer_id,
        principal: Number(form.principal),
        tenure_months: Number(form.tenure_months),
        start_date: form.start_date,
        narration: form.narration || null,
      });
      toast({ title: `EMI plan ${res.plan_no} created` });
      onOpenChange(false);
      setForm({ customer_id: "", principal: 0, tenure_months: 12, start_date: today(), narration: "" });
      onCreated();
    } catch (e: any) {
      toast({ title: "Failed", description: e?.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>New EMI Plan</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Customer</Label>
            <Select value={form.customer_id} onValueChange={v => setForm({ ...form, customer_id: v })}>
              <SelectTrigger><SelectValue placeholder="Select customer…" /></SelectTrigger>
              <SelectContent>
                {customers.map((c: any) => (
                  <SelectItem key={c.id} value={c.id}>{c.name} {c.phone ? `— ${c.phone}` : ""}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Principal Amount</Label><Input type="number" step="0.01" value={form.principal || ""} onChange={e => setForm({ ...form, principal: Number(e.target.value) || 0 })} /></div>
            <div><Label>Tenure (months)</Label><Input type="number" value={form.tenure_months} onChange={e => setForm({ ...form, tenure_months: Number(e.target.value) || 0 })} /></div>
          </div>
          <div><Label>Start Date</Label><Input type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} /></div>
          <div><Label>Narration</Label><Textarea rows={2} value={form.narration} onChange={e => setForm({ ...form, narration: e.target.value })} /></div>
          <div className="bg-muted/50 rounded p-3 text-sm flex justify-between">
            <span className="text-muted-foreground">Monthly installment:</span>
            <span className="font-mono font-bold">{formatCurrency(installment)}</span>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? "Saving…" : "Create Plan"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ────────────────────────────────────────────────────────────────────
const PlanDetailDialog = ({ planId, onClose, onChanged }: {
  planId: string | null; onClose: () => void; onChanged: () => void;
}) => {
  const dealerId = useDealerId();
  const { data, refetch, isLoading } = useQuery({
    queryKey: ["emi-plan", planId],
    queryFn: () => emiService.get(dealerId!, planId!),
    enabled: !!dealerId && !!planId,
  });
  const [payOpen, setPayOpen] = useState<EmiInstallment | null>(null);
  const [payForm, setPayForm] = useState({ paid_amount: 0, paid_date: today() });
  const [saving, setSaving] = useState(false);

  const handlePay = async () => {
    if (!dealerId || !payOpen || !planId) return;
    if (payForm.paid_amount <= 0) return toast({ title: "Amount required", variant: "destructive" });
    setSaving(true);
    try {
      await emiService.pay(dealerId, planId, payOpen.id, payForm.paid_amount, payForm.paid_date);
      toast({ title: "Payment recorded" });
      setPayOpen(null);
      refetch();
      onChanged();
    } catch (e: any) {
      toast({ title: "Failed", description: e?.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  const handleCancel = async () => {
    if (!dealerId || !planId || !confirm("Cancel this EMI plan?")) return;
    try {
      await emiService.cancel(dealerId, planId);
      toast({ title: "Plan cancelled" });
      onClose();
      onChanged();
    } catch (e: any) {
      toast({ title: "Failed", description: e?.message, variant: "destructive" });
    }
  };

  return (
    <>
      <Dialog open={!!planId} onOpenChange={(v) => !v && onClose()}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">EMI Plan {data?.plan_no} {data && statusBadge(data.status)}</DialogTitle>
          </DialogHeader>
          {isLoading || !data ? <p>Loading…</p> : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div><div className="text-muted-foreground">Customer</div><div className="font-medium">{data.customer_name}</div></div>
                <div><div className="text-muted-foreground">Start</div><div>{data.start_date}</div></div>
                <div><div className="text-muted-foreground">Principal</div><div className="font-mono">{formatCurrency(Number(data.principal))}</div></div>
                <div><div className="text-muted-foreground">Installment</div><div className="font-mono">{formatCurrency(Number(data.installment_amount))} × {data.tenure_months}</div></div>
              </div>
              {data.narration && <div className="text-sm text-muted-foreground italic">{data.narration}</div>}

              <Table>
                <TableHeader><TableRow>
                  <TableHead>#</TableHead><TableHead>Due Date</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Paid</TableHead>
                  <TableHead>Paid Date</TableHead><TableHead>Status</TableHead><TableHead></TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {data.schedule?.map(s => {
                    const isOverdue = s.status !== "paid" && new Date(s.due_date) < new Date(today());
                    const displayStatus = isOverdue && s.status === "pending" ? "overdue" : s.status;
                    return (
                      <TableRow key={s.id}>
                        <TableCell>#{s.installment_no}</TableCell>
                        <TableCell>{s.due_date}</TableCell>
                        <TableCell className="text-right font-mono">{formatCurrency(Number(s.amount))}</TableCell>
                        <TableCell className="text-right font-mono text-emerald-500">{formatCurrency(Number(s.paid_amount))}</TableCell>
                        <TableCell>{s.paid_date || "—"}</TableCell>
                        <TableCell>{statusBadge(displayStatus)}</TableCell>
                        <TableCell>
                          {s.status !== "paid" && data.status === "active" && (
                            <Button size="sm" variant="outline" onClick={() => { setPayOpen(s); setPayForm({ paid_amount: Number(s.amount) - Number(s.paid_amount), paid_date: today() }); }}>
                              <CheckCircle2 className="h-3 w-3 mr-1" /> Pay
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
          <DialogFooter>
            {data?.status === "active" && <Button variant="destructive" onClick={handleCancel}><XCircle className="h-4 w-4 mr-2" /> Cancel Plan</Button>}
            <Button variant="outline" onClick={onClose}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!payOpen} onOpenChange={(v) => !v && setPayOpen(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Record Payment — Installment #{payOpen?.installment_no}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Amount</Label><Input type="number" step="0.01" value={payForm.paid_amount || ""} onChange={e => setPayForm({ ...payForm, paid_amount: Number(e.target.value) || 0 })} /></div>
            <div><Label>Date</Label><Input type="date" value={payForm.paid_date} onChange={e => setPayForm({ ...payForm, paid_date: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayOpen(null)} disabled={saving}>Cancel</Button>
            <Button onClick={handlePay} disabled={saving}>{saving ? "Saving…" : "Record"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default EmiPage;
