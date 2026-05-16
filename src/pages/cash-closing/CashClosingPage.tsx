import { useMemo, useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useDealerId } from "@/hooks/useDealerId";
import { cashClosingService } from "@/services/cashClosingService";
import { formatCurrency } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { Lock, CheckCircle2, AlertTriangle, ClipboardCheck } from "lucide-react";

const DENOMS = [1000, 500, 200, 100, 50, 20, 10, 5, 2, 1];

const CashClosingPage = () => {
  const dealerId = useDealerId();
  const qc = useQueryClient();
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [denoms, setDenoms] = useState<Record<string, string>>({});
  const [varianceReason, setVarianceReason] = useState("");
  const [notes, setNotes] = useState("");
  const [approveNote, setApproveNote] = useState("");

  const todayQ = useQuery({
    queryKey: ["cash-closing-today", dealerId, date],
    queryFn: () => cashClosingService.today(dealerId, date),
    enabled: !!dealerId,
  });

  const listQ = useQuery({
    queryKey: ["cash-closings", dealerId],
    queryFn: () => cashClosingService.list(dealerId),
    enabled: !!dealerId,
  });

  // hydrate denoms when existing loads
  useEffect(() => {
    const ex = todayQ.data?.existing;
    if (ex) {
      const d: Record<string, string> = {};
      Object.entries(ex.denominations || {}).forEach(([k, v]) => { d[k] = String(v); });
      setDenoms(d);
      setVarianceReason(ex.variance_reason || "");
      setNotes(ex.notes || "");
    } else {
      setDenoms({});
      setVarianceReason("");
      setNotes("");
    }
  }, [todayQ.data?.existing?.id, date]);

  const countedFromDenoms = useMemo(() => {
    return DENOMS.reduce((sum, d) => sum + d * (Number(denoms[String(d)]) || 0), 0);
  }, [denoms]);

  const preview = todayQ.data?.preview;
  const existing = todayQ.data?.existing;
  const expected = preview?.expected_closing ?? 0;
  const variance = countedFromDenoms - expected;
  const isLocked = existing?.status === "approved";

  const submitM = useMutation({
    mutationFn: () => {
      const denomNumeric: Record<string, number> = {};
      DENOMS.forEach(d => { const c = Number(denoms[String(d)]) || 0; if (c > 0) denomNumeric[String(d)] = c; });
      return cashClosingService.submit({
        dealerId,
        closing_date: date,
        counted_cash: countedFromDenoms,
        denominations: denomNumeric,
        variance_reason: Math.abs(variance) > 0.005 ? varianceReason : undefined,
        notes: notes || undefined,
      });
    },
    onSuccess: () => {
      toast({ title: "Closing submitted", description: "Awaiting approval" });
      qc.invalidateQueries({ queryKey: ["cash-closing-today"] });
      qc.invalidateQueries({ queryKey: ["cash-closings"] });
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const approveM = useMutation({
    mutationFn: () => cashClosingService.approve(existing!.id, dealerId, approveNote || undefined),
    onSuccess: () => {
      toast({ title: "Closing approved", description: "Day is now locked" });
      setApproveNote("");
      qc.invalidateQueries({ queryKey: ["cash-closing-today"] });
      qc.invalidateQueries({ queryKey: ["cash-closings"] });
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const rejectM = useMutation({
    mutationFn: () => cashClosingService.reject(existing!.id, dealerId, approveNote || "Re-count requested"),
    onSuccess: () => {
      toast({ title: "Closing rejected", description: "Cashier can resubmit" });
      setApproveNote("");
      qc.invalidateQueries({ queryKey: ["cash-closing-today"] });
      qc.invalidateQueries({ queryKey: ["cash-closings"] });
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  if (!dealerId) return <div className="p-6">Loading…</div>;

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <ClipboardCheck className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Daily Cash Closing</h1>
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="date" className="text-sm">Date</Label>
          <Input id="date" type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} className="w-44" />
        </div>
      </div>

      <Tabs defaultValue="reconcile">
        <TabsList>
          <TabsTrigger value="reconcile">Reconcile</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="reconcile" className="space-y-4 mt-4">
          {/* Status banner */}
          {existing && (
            <div className={`p-3 rounded-md border flex items-center gap-2 ${
              existing.status === "approved" ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
              : existing.status === "rejected" ? "bg-destructive/10 border-destructive/30 text-destructive"
              : "bg-amber-500/10 border-amber-500/30 text-amber-400"
            }`}>
              {existing.status === "approved" ? <Lock className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
              <span className="text-sm font-medium">
                {existing.status === "approved" && "This day is approved and locked."}
                {existing.status === "submitted" && "Closing submitted — awaiting approval."}
                {existing.status === "rejected" && "Closing rejected — please recount and resubmit."}
              </span>
            </div>
          )}

          {/* System totals */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <SummaryCard title="Opening Cash" value={preview?.opening ?? 0} />
            <SummaryCard title="Cash In (system)" value={preview?.system_cash_in ?? 0} positive />
            <SummaryCard title="Cash Out (system)" value={preview?.system_cash_out ?? 0} negative />
            <SummaryCard title="Expected Closing" value={expected} emphasize />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Denomination counter */}
            <Card>
              <CardHeader><CardTitle className="text-base">Physical Cash Count</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-2">
                  {DENOMS.map((d) => {
                    const count = Number(denoms[String(d)]) || 0;
                    return (
                      <div key={d} className="flex items-center gap-2">
                        <Label className="w-16 text-right text-sm">৳{d}</Label>
                        <span className="text-muted-foreground">×</span>
                        <Input
                          type="number" min={0}
                          disabled={isLocked}
                          value={denoms[String(d)] ?? ""}
                          onChange={(e) => setDenoms(prev => ({ ...prev, [String(d)]: e.target.value }))}
                          className="w-20"
                        />
                        <span className="text-sm font-mono text-muted-foreground ml-auto">
                          {formatCurrency(d * count)}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <div className="border-t mt-3 pt-3 flex justify-between items-center">
                  <span className="font-semibold">Total Counted</span>
                  <span className="text-xl font-bold text-primary">{formatCurrency(countedFromDenoms)}</span>
                </div>
              </CardContent>
            </Card>

            {/* Variance + submit */}
            <Card>
              <CardHeader><CardTitle className="text-base">Reconciliation</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between"><span>Expected</span><span className="font-mono">{formatCurrency(expected)}</span></div>
                <div className="flex justify-between"><span>Counted</span><span className="font-mono">{formatCurrency(countedFromDenoms)}</span></div>
                <div className={`flex justify-between text-lg font-bold p-2 rounded ${
                  Math.abs(variance) < 0.005 ? "bg-emerald-500/10 text-emerald-400"
                  : variance > 0 ? "bg-amber-500/10 text-amber-400"
                  : "bg-destructive/10 text-destructive"
                }`}>
                  <span>Variance</span>
                  <span className="font-mono">{variance >= 0 ? "+" : ""}{formatCurrency(variance)}</span>
                </div>

                {Math.abs(variance) > 0.005 && (
                  <div>
                    <Label className="text-sm">Variance Reason <span className="text-destructive">*</span></Label>
                    <Textarea
                      placeholder="Explain shortage/surplus (e.g., missed receipt, change given without entry)"
                      value={varianceReason} disabled={isLocked}
                      onChange={(e) => setVarianceReason(e.target.value)} rows={2}
                    />
                  </div>
                )}

                <div>
                  <Label className="text-sm">Notes (optional)</Label>
                  <Textarea value={notes} disabled={isLocked} onChange={(e) => setNotes(e.target.value)} rows={2} />
                </div>

                {!isLocked && (
                  <Button
                    onClick={() => submitM.mutate()}
                    disabled={submitM.isPending || (Math.abs(variance) > 0.005 && !varianceReason.trim()) || countedFromDenoms === 0}
                    className="w-full"
                  >
                    {existing?.status === "submitted" ? "Re-submit Closing" : "Submit Closing"}
                  </Button>
                )}

                {existing?.status === "submitted" && (
                  <div className="border-t pt-3 space-y-2">
                    <Label className="text-sm">Approval Note (optional)</Label>
                    <Input value={approveNote} onChange={(e) => setApproveNote(e.target.value)} placeholder="Optional note" />
                    <div className="flex gap-2">
                      <Button onClick={() => approveM.mutate()} disabled={approveM.isPending} className="flex-1 gap-1">
                        <CheckCircle2 className="h-4 w-4" /> Approve & Lock Day
                      </Button>
                      <Button onClick={() => rejectM.mutate()} disabled={rejectM.isPending} variant="outline" className="flex-1">
                        Reject
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Opening</TableHead>
                    <TableHead className="text-right">In</TableHead>
                    <TableHead className="text-right">Out</TableHead>
                    <TableHead className="text-right">Expected</TableHead>
                    <TableHead className="text-right">Counted</TableHead>
                    <TableHead className="text-right">Variance</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {listQ.data?.rows.map(r => (
                    <TableRow key={r.id} className="cursor-pointer" onClick={() => setDate(r.closing_date)}>
                      <TableCell className="font-mono">{r.closing_date}</TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(r.opening_cash)}</TableCell>
                      <TableCell className="text-right font-mono text-emerald-400">{formatCurrency(r.system_cash_in)}</TableCell>
                      <TableCell className="text-right font-mono text-destructive">{formatCurrency(r.system_cash_out)}</TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(r.expected_closing)}</TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(r.counted_cash)}</TableCell>
                      <TableCell className={`text-right font-mono ${Math.abs(r.variance) < 0.005 ? "" : r.variance > 0 ? "text-amber-400" : "text-destructive"}`}>
                        {r.variance >= 0 ? "+" : ""}{formatCurrency(r.variance)}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground">{r.variance_reason || "—"}</TableCell>
                      <TableCell>
                        <Badge variant={r.status === "approved" ? "default" : r.status === "rejected" ? "destructive" : "secondary"}>
                          {r.status === "approved" && <Lock className="h-3 w-3 mr-1" />}
                          {r.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  {listQ.data && listQ.data.rows.length === 0 && (
                    <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-6">No closings yet</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

const SummaryCard = ({ title, value, positive, negative, emphasize }: { title: string; value: number; positive?: boolean; negative?: boolean; emphasize?: boolean }) => (
  <Card>
    <CardContent className="p-4">
      <p className="text-xs text-muted-foreground">{title}</p>
      <p className={`text-xl font-bold font-mono ${
        emphasize ? "text-primary" : positive ? "text-emerald-400" : negative ? "text-destructive" : ""
      }`}>{formatCurrency(value)}</p>
    </CardContent>
  </Card>
);

export default CashClosingPage;
