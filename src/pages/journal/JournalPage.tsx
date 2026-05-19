import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useDealerId } from "@/hooks/useDealerId";
import { journalService, type JournalLine } from "@/services/financialService";
import { formatCurrency } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { Plus, Trash2, BookOpen } from "lucide-react";

const today = () => new Date().toISOString().slice(0, 10);
const emptyLine = (): JournalLine => ({ account: "", debit: 0, credit: 0, line_narration: "" });

const JournalPage = () => {
  const dealerId = useDealerId();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState({ from: "", to: "" });
  const [form, setForm] = useState({ entry_date: today(), narration: "", lines: [emptyLine(), emptyLine()] });
  const [saving, setSaving] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["journal", dealerId, filter],
    queryFn: () => journalService.list(dealerId!, { from: filter.from || undefined, to: filter.to || undefined, limit: 100 }),
    enabled: !!dealerId,
  });

  const updateLine = (idx: number, patch: Partial<JournalLine>) => {
    setForm(f => ({ ...f, lines: f.lines.map((l, i) => i === idx ? { ...l, ...patch } : l) }));
  };
  const addLine = () => setForm(f => ({ ...f, lines: [...f.lines, emptyLine()] }));
  const removeLine = (idx: number) => setForm(f => ({ ...f, lines: f.lines.filter((_, i) => i !== idx) }));

  const totalDebit = form.lines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
  const totalCredit = form.lines.reduce((s, l) => s + (Number(l.credit) || 0), 0);
  const balanced = Math.abs(totalDebit - totalCredit) < 0.01 && totalDebit > 0;

  const handleSave = async () => {
    if (!dealerId) return;
    if (!balanced) { toast({ title: "Unbalanced entry", description: "Debit must equal Credit and totals must be > 0.", variant: "destructive" }); return; }
    const cleanedLines = form.lines.filter(l => l.account.trim() && (Number(l.debit) > 0 || Number(l.credit) > 0));
    if (cleanedLines.length < 2) { toast({ title: "At least 2 lines required", variant: "destructive" }); return; }
    setSaving(true);
    try {
      await journalService.create(dealerId, {
        entry_date: form.entry_date,
        narration: form.narration,
        lines: cleanedLines.map(l => ({ ...l, debit: Number(l.debit) || 0, credit: Number(l.credit) || 0 })),
      });
      toast({ title: "Journal entry saved" });
      setOpen(false);
      setForm({ entry_date: today(), narration: "", lines: [emptyLine(), emptyLine()] });
      qc.invalidateQueries({ queryKey: ["journal"] });
      qc.invalidateQueries({ queryKey: ["trial-balance"] });
    } catch (e: any) {
      toast({ title: "Save failed", description: e?.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!dealerId || !confirm("Delete this journal entry?")) return;
    try {
      await journalService.remove(dealerId, id);
      toast({ title: "Deleted" });
      qc.invalidateQueries({ queryKey: ["journal"] });
      qc.invalidateQueries({ queryKey: ["trial-balance"] });
    } catch (e: any) {
      toast({ title: "Delete failed", description: e?.message, variant: "destructive" });
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2"><BookOpen className="h-6 w-6" /> Journal Entries</h1>
        <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-2" /> New Entry</Button>
      </div>

      <Card>
        <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-3 gap-3">
          <div><Label>From</Label><Input type="date" value={filter.from} onChange={e => setFilter({ ...filter, from: e.target.value })} /></div>
          <div><Label>To</Label><Input type="date" value={filter.to} onChange={e => setFilter({ ...filter, to: e.target.value })} /></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Entries {data ? `(${data.total})` : ""}</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <p>Loading…</p> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Voucher</TableHead>
                  <TableHead>Narration</TableHead>
                  <TableHead className="text-right">Debit</TableHead>
                  <TableHead className="text-right">Credit</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.rows.map((r: any) => (
                  <TableRow key={r.id}>
                    <TableCell>{r.entry_date}</TableCell>
                    <TableCell className="font-mono">{r.voucher_no}</TableCell>
                    <TableCell className="max-w-md truncate text-muted-foreground">{r.narration || "—"}</TableCell>
                    <TableCell className="text-right font-mono">{formatCurrency(Number(r.total_debit) || 0)}</TableCell>
                    <TableCell className="text-right font-mono">{formatCurrency(Number(r.total_credit) || 0)}</TableCell>
                    <TableCell><Button size="icon" variant="ghost" onClick={() => handleDelete(r.id)}><Trash2 className="h-4 w-4 text-red-500" /></Button></TableCell>
                  </TableRow>
                ))}
                {!data?.rows.length && (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">No entries yet</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader><DialogTitle>New Journal Entry</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div><Label>Date</Label><Input type="date" value={form.entry_date} onChange={e => setForm({ ...form, entry_date: e.target.value })} /></div>
              <div><Label>Narration</Label><Input value={form.narration} onChange={e => setForm({ ...form, narration: e.target.value })} placeholder="e.g. Opening balance adjustment" /></div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Lines</Label>
                <Button size="sm" variant="outline" onClick={addLine}><Plus className="h-3 w-3 mr-1" /> Add Line</Button>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Account</TableHead>
                    <TableHead>Note</TableHead>
                    <TableHead className="text-right w-32">Debit</TableHead>
                    <TableHead className="text-right w-32">Credit</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {form.lines.map((l, i) => (
                    <TableRow key={i}>
                      <TableCell><Input value={l.account} onChange={e => updateLine(i, { account: e.target.value })} placeholder="e.g. Cash on Hand" /></TableCell>
                      <TableCell><Input value={l.line_narration ?? ""} onChange={e => updateLine(i, { line_narration: e.target.value })} /></TableCell>
                      <TableCell><Input type="number" step="0.01" className="text-right font-mono" value={l.debit || ""} onChange={e => updateLine(i, { debit: Number(e.target.value) || 0, credit: 0 })} /></TableCell>
                      <TableCell><Input type="number" step="0.01" className="text-right font-mono" value={l.credit || ""} onChange={e => updateLine(i, { credit: Number(e.target.value) || 0, debit: 0 })} /></TableCell>
                      <TableCell><Button size="icon" variant="ghost" disabled={form.lines.length <= 2} onClick={() => removeLine(i)}><Trash2 className="h-4 w-4" /></Button></TableCell>
                    </TableRow>
                  ))}
                  <TableRow className={balanced ? "bg-emerald-500/10" : "bg-red-500/10"}>
                    <TableCell colSpan={2} className="font-bold">Totals {balanced ? "✓ balanced" : "✗ unbalanced"}</TableCell>
                    <TableCell className="text-right font-mono font-bold">{formatCurrency(totalDebit)}</TableCell>
                    <TableCell className="text-right font-mono font-bold">{formatCurrency(totalCredit)}</TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !balanced}>{saving ? "Saving…" : "Save Entry"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default JournalPage;
