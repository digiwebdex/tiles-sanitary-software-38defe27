import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Clock } from "lucide-react";
import { shiftService, Shift, WEEKDAYS, parseWorkingDays, formatWorkingDays } from "@/services/shiftService";

const EMPTY: Partial<Shift> = {
  code: "",
  name: "",
  start_time: "09:00",
  end_time: "18:00",
  grace_minutes: 10,
  half_day_after_minutes: 120,
  working_days: "0,1,2,3,4,6",
  color: "#f59e0b",
  is_active: true,
};

export default function ShiftsPage() {
  const [rows, setRows] = useState<Shift[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Shift | null>(null);
  const [form, setForm] = useState<Partial<Shift>>(EMPTY);
  const [days, setDays] = useState<number[]>([0, 1, 2, 3, 4, 6]);

  async function reload() {
    try { setRows(await shiftService.list()); }
    catch (e: any) { toast({ title: "Load failed", description: String(e.message ?? e), variant: "destructive" }); }
  }
  useEffect(() => { reload(); }, []);

  function startNew() {
    setEditing(null);
    setForm(EMPTY);
    setDays(parseWorkingDays(EMPTY.working_days!));
    setOpen(true);
  }
  function startEdit(s: Shift) {
    setEditing(s);
    setForm(s);
    setDays(parseWorkingDays(s.working_days));
    setOpen(true);
  }
  function toggleDay(d: number) {
    setDays((cur) => cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d]);
  }

  async function save() {
    if (!form.code || !form.name) return toast({ title: "Code and name required", variant: "destructive" });
    const payload = { ...form, working_days: formatWorkingDays(days) };
    try {
      if (editing) await shiftService.update(editing.id, payload);
      else await shiftService.create(payload);
      toast({ title: editing ? "Shift updated" : "Shift created" });
      setOpen(false); reload();
    } catch (e: any) {
      toast({ title: "Save failed", description: String(e.message ?? e), variant: "destructive" });
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this shift?")) return;
    try { await shiftService.remove(id); toast({ title: "Deleted" }); reload(); }
    catch (e: any) { toast({ title: "Delete failed", description: String(e.message ?? e), variant: "destructive" }); }
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Clock className="h-6 w-6" /> Shift Management</h1>
        <Button onClick={startNew}><Plus className="h-4 w-4 mr-2" /> New Shift</Button>
      </div>

      <Card>
        <CardHeader><CardTitle>Shifts</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Timing</TableHead>
                <TableHead>Grace</TableHead>
                <TableHead>Half-day after</TableHead>
                <TableHead>Working Days</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">No shifts yet</TableCell></TableRow>
              )}
              {rows.map((s) => {
                const wd = parseWorkingDays(s.working_days);
                return (
                  <TableRow key={s.id}>
                    <TableCell className="font-mono">{s.code}</TableCell>
                    <TableCell className="font-medium">
                      <span className="inline-flex items-center gap-2">
                        <span className="inline-block w-2 h-2 rounded-full" style={{ background: s.color ?? "#f59e0b" }} />
                        {s.name}
                      </span>
                    </TableCell>
                    <TableCell>{s.start_time} – {s.end_time}</TableCell>
                    <TableCell>{s.grace_minutes}m</TableCell>
                    <TableCell>{s.half_day_after_minutes}m</TableCell>
                    <TableCell>
                      <div className="flex gap-1 flex-wrap">
                        {WEEKDAYS.map((d) => (
                          <Badge key={d.value} variant="outline" className={wd.includes(d.value) ? "bg-primary/15 text-primary border-primary/30" : "opacity-40"}>
                            {d.label}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      {s.is_active ? <Badge className="bg-green-500/15 text-green-600 border-green-500/30">Active</Badge> : <Badge variant="outline">Inactive</Badge>}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => startEdit(s)}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => remove(s.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? "Edit Shift" : "New Shift"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Code</Label>
                <Input value={form.code ?? ""} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="DAY" />
              </div>
              <div>
                <Label>Name</Label>
                <Input value={form.name ?? ""} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Day Shift" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Start Time</Label>
                <Input type="time" value={form.start_time ?? ""} onChange={(e) => setForm({ ...form, start_time: e.target.value })} />
              </div>
              <div>
                <Label>End Time</Label>
                <Input type="time" value={form.end_time ?? ""} onChange={(e) => setForm({ ...form, end_time: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Grace (minutes)</Label>
                <Input type="number" value={form.grace_minutes ?? 0} onChange={(e) => setForm({ ...form, grace_minutes: Number(e.target.value) })} />
              </div>
              <div>
                <Label>Half-day after (minutes late)</Label>
                <Input type="number" value={form.half_day_after_minutes ?? 0} onChange={(e) => setForm({ ...form, half_day_after_minutes: Number(e.target.value) })} />
              </div>
            </div>
            <div>
              <Label>Working Days</Label>
              <div className="flex gap-2 flex-wrap mt-1">
                {WEEKDAYS.map((d) => (
                  <Button
                    key={d.value}
                    type="button"
                    size="sm"
                    variant={days.includes(d.value) ? "default" : "outline"}
                    onClick={() => toggleDay(d.value)}
                  >
                    {d.label}
                  </Button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 items-end">
              <div>
                <Label>Color</Label>
                <Input type="color" value={form.color ?? "#f59e0b"} onChange={(e) => setForm({ ...form, color: e.target.value })} />
              </div>
              <div className="flex items-center gap-2 mb-2">
                <Switch checked={form.is_active ?? true} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
                <Label>Active</Label>
              </div>
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save}>{editing ? "Update" : "Create"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
