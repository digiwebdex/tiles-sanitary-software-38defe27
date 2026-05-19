import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Edit, CalendarDays, Upload } from "lucide-react";
import { toast } from "sonner";
import { useDealerId } from "@/hooks/useDealerId";
import { holidayService, Holiday, HolidayInput, HolidayType } from "@/services/holidayService";

const TYPE_META: Record<HolidayType, { label: string; color: string }> = {
  public:    { label: "Public",    color: "bg-blue-500" },
  religious: { label: "Religious", color: "bg-purple-500" },
  national:  { label: "National",  color: "bg-green-600" },
  company:   { label: "Company",   color: "bg-amber-500" },
  weekend:   { label: "Weekend",   color: "bg-slate-500" },
  other:     { label: "Other",     color: "bg-zinc-500" },
};

const emptyForm: HolidayInput = {
  holiday_date: new Date().toISOString().slice(0, 10),
  name: "",
  type: "public",
  recurring: false,
  paid: true,
  notes: "",
};

const HolidaysPage = () => {
  const dealerId = useDealerId();
  const qc = useQueryClient();
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [typeFilter, setTypeFilter] = useState<HolidayType | "all">("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Holiday | null>(null);
  const [form, setForm] = useState<HolidayInput>(emptyForm);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["holidays", dealerId, year],
    queryFn: () => holidayService.list({ dealerId, year }),
    enabled: !!dealerId,
  });

  const rows = useMemo(() => {
    const all = data?.rows ?? [];
    return typeFilter === "all" ? all : all.filter(r => r.type === typeFilter);
  }, [data, typeFilter]);

  const summary = useMemo(() => {
    const all = data?.rows ?? [];
    return {
      total: all.length,
      paid: all.filter(r => r.paid).length,
      recurring: all.filter(r => r.recurring).length,
    };
  }, [data]);

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!form.holiday_date || !form.name.trim()) {
        throw new Error("Date and name are required");
      }
      if (editing) {
        return holidayService.update(editing.id, dealerId, form);
      }
      return holidayService.create(dealerId, form);
    },
    onSuccess: () => {
      toast.success(editing ? "Holiday updated" : "Holiday added");
      setFormOpen(false);
      setEditing(null);
      setForm(emptyForm);
      qc.invalidateQueries({ queryKey: ["holidays", dealerId] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to save"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => holidayService.remove(id, dealerId),
    onSuccess: () => {
      toast.success("Holiday removed");
      qc.invalidateQueries({ queryKey: ["holidays", dealerId] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to delete"),
  });

  const bulkMut = useMutation({
    mutationFn: async () => {
      const parsed: HolidayInput[] = [];
      for (const line of bulkText.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        // CSV format: date,name,type,recurring,paid
        const [date, name, type = "public", recurring = "false", paid = "true"] = trimmed.split(",").map(s => s.trim());
        if (!date || !name) continue;
        parsed.push({
          holiday_date: date,
          name,
          type: type as HolidayType,
          recurring: recurring.toLowerCase() === "true",
          paid: paid.toLowerCase() !== "false",
        });
      }
      if (!parsed.length) throw new Error("No valid rows parsed");
      return holidayService.bulkCreate(dealerId, parsed);
    },
    onSuccess: (r) => {
      toast.success(`Imported ${r.inserted} holidays`);
      setBulkOpen(false);
      setBulkText("");
      qc.invalidateQueries({ queryKey: ["holidays", dealerId] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Bulk import failed"),
  });

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setFormOpen(true);
  };

  const openEdit = (h: Holiday) => {
    setEditing(h);
    setForm({
      holiday_date: h.holiday_date.slice(0, 10),
      name: h.name,
      type: h.type,
      recurring: h.recurring,
      paid: h.paid,
      notes: h.notes ?? "",
    });
    setFormOpen(true);
  };

  const years = useMemo(() => {
    const current = new Date().getFullYear();
    return [current - 1, current, current + 1, current + 2];
  }, []);

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CalendarDays className="h-6 w-6 text-primary" />
            Holiday Setup
          </h1>
          <p className="text-sm text-muted-foreground">
            Calendar used by HR, Attendance, and Payroll modules.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setBulkOpen(true)}>
            <Upload className="h-4 w-4 mr-2" /> Bulk Import
          </Button>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" /> Add Holiday
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Total this year</div><div className="text-2xl font-bold">{summary.total}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Paid leave</div><div className="text-2xl font-bold">{summary.paid}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Recurring</div><div className="text-2xl font-bold">{summary.recurring}</div></CardContent></Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2">
          <CardTitle>Calendar</CardTitle>
          <div className="flex gap-2">
            <Select value={String(year)} onValueChange={v => setYear(Number(v))}>
              <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
              <SelectContent>
                {years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as any)}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                {Object.entries(TYPE_META).map(([k, m]) => (
                  <SelectItem key={k} value={k}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-sm text-muted-foreground py-8 text-center">Loading…</div>
          ) : rows.length === 0 ? (
            <div className="text-sm text-muted-foreground py-8 text-center">No holidays configured for {year}.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Day</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Recurring</TableHead>
                  <TableHead>Paid</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(h => {
                  const d = new Date(h.holiday_date);
                  const meta = TYPE_META[h.type];
                  return (
                    <TableRow key={h.id}>
                      <TableCell className="font-mono">{h.holiday_date.slice(0, 10)}</TableCell>
                      <TableCell>{d.toLocaleDateString(undefined, { weekday: "short" })}</TableCell>
                      <TableCell className="font-medium">{h.name}</TableCell>
                      <TableCell><Badge className={meta.color}>{meta.label}</Badge></TableCell>
                      <TableCell>{h.recurring ? "Yes" : "—"}</TableCell>
                      <TableCell>{h.paid ? "Paid" : "Unpaid"}</TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="ghost" onClick={() => openEdit(h)}><Edit className="h-4 w-4" /></Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => { if (confirm(`Delete "${h.name}"?`)) deleteMut.mutate(h.id); }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create / Edit dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? "Edit Holiday" : "Add Holiday"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Date *</Label>
                <Input
                  type="date"
                  value={form.holiday_date}
                  onChange={e => setForm({ ...form, holiday_date: e.target.value })}
                />
              </div>
              <div>
                <Label>Type</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as HolidayType })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(TYPE_META).map(([k, m]) => (
                      <SelectItem key={k} value={k}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Name *</Label>
              <Input
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Eid-ul-Fitr"
              />
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <div className="font-medium text-sm">Repeats every year</div>
                <div className="text-xs text-muted-foreground">Recurring holidays auto-apply to future years</div>
              </div>
              <Switch checked={!!form.recurring} onCheckedChange={(v) => setForm({ ...form, recurring: v })} />
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <div className="font-medium text-sm">Paid leave</div>
                <div className="text-xs text-muted-foreground">Counts as paid in payroll</div>
              </div>
              <Switch checked={form.paid !== false} onCheckedChange={(v) => setForm({ ...form, paid: v })} />
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea
                rows={2}
                value={form.notes ?? ""}
                onChange={e => setForm({ ...form, notes: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>
              {saveMut.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk import dialog */}
      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Bulk Import Holidays (CSV)</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              One per line: <code>date,name,type,recurring,paid</code>. Lines starting with <code>#</code> are ignored.
            </p>
            <Textarea
              rows={12}
              className="font-mono text-xs"
              value={bulkText}
              onChange={e => setBulkText(e.target.value)}
              placeholder={`# Example
2026-02-21,International Mother Language Day,national,true,true
2026-03-26,Independence Day,national,true,true
2026-12-16,Victory Day,national,true,true`}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkOpen(false)}>Cancel</Button>
            <Button onClick={() => bulkMut.mutate()} disabled={bulkMut.isPending}>
              {bulkMut.isPending ? "Importing…" : "Import"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default HolidaysPage;
