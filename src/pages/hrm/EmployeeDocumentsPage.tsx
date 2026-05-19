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
import { Plus, Trash2, ExternalLink, AlertTriangle, FileText } from "lucide-react";
import { employeeDocumentService, EmployeeDocument, DocType } from "@/services/employeeDocumentService";
import { employeeService } from "@/services/employeeService";
import { useAuth } from "@/contexts/AuthContext";

const DOC_TYPES: { value: DocType; label: string }[] = [
  { value: "nid", label: "NID" },
  { value: "passport", label: "Passport" },
  { value: "contract", label: "Contract" },
  { value: "certificate", label: "Certificate" },
  { value: "license", label: "License" },
  { value: "photo", label: "Photo" },
  { value: "other", label: "Other" },
];

function daysUntil(dateStr?: string | null): number | null {
  if (!dateStr) return null;
  const target = new Date(dateStr + "T00:00:00").getTime();
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return Math.round((target - today.getTime()) / (24 * 60 * 60 * 1000));
}

function expiryBadge(dateStr?: string | null) {
  const d = daysUntil(dateStr);
  if (d == null) return <span className="text-muted-foreground text-xs">—</span>;
  if (d < 0) return <Badge variant="outline" className="bg-red-500/15 text-red-600 border-red-500/30">Expired {Math.abs(d)}d ago</Badge>;
  if (d <= 30) return <Badge variant="outline" className="bg-yellow-500/15 text-yellow-600 border-yellow-500/30">Expires in {d}d</Badge>;
  return <Badge variant="outline" className="bg-green-500/15 text-green-600 border-green-500/30">{d}d left</Badge>;
}

export default function EmployeeDocumentsPage() {
  const { profile } = useAuth();
  const dealerId = profile?.dealer_id;
  const [tab, setTab] = useState("all");
  const [docs, setDocs] = useState<EmployeeDocument[]>([]);
  const [expiring, setExpiring] = useState<EmployeeDocument[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [employeeFilter, setEmployeeFilter] = useState<string>("all");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Partial<EmployeeDocument>>({ doc_type: "nid" });

  async function reload() {
    if (!dealerId) return;
    const [all, exp, emp] = await Promise.all([
      employeeDocumentService.list(employeeFilter === "all" ? {} : { employee_id: employeeFilter }),
      employeeDocumentService.expiring(30),
      employeeService.list(dealerId),
    ]);
    setDocs(all); setExpiring(exp); setEmployees(emp);
  }
  useEffect(() => {
    reload().catch((e) => toast({ title: "Load failed", description: String(e.message ?? e), variant: "destructive" }));
  }, [employeeFilter, dealerId]);

  const filtered = useMemo(() => docs, [docs]);

  function resetForm() {
    setForm({ doc_type: "nid", employee_id: employeeFilter !== "all" ? employeeFilter : undefined });
  }

  async function handleSave() {
    if (!form.employee_id) return toast({ title: "Select employee", variant: "destructive" });
    if (!form.title) return toast({ title: "Title required", variant: "destructive" });
    try {
      await employeeDocumentService.create(form);
      toast({ title: "Document added" });
      setOpen(false); resetForm();
      reload();
    } catch (e: any) {
      toast({ title: "Save failed", description: String(e.message ?? e), variant: "destructive" });
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this document?")) return;
    try {
      await employeeDocumentService.remove(id);
      toast({ title: "Deleted" });
      reload();
    } catch (e: any) {
      toast({ title: "Delete failed", description: String(e.message ?? e), variant: "destructive" });
    }
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <FileText className="h-6 w-6" /> Employee Documents
        </h1>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (o) resetForm(); }}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" /> Add Document</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>New Document</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Employee</Label>
                <Select value={form.employee_id} onValueChange={(v) => setForm({ ...form, employee_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
                  <SelectContent>
                    {employees.map((e) => (
                      <SelectItem key={e.id} value={e.id}>{e.name} ({e.employee_code})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Type</Label>
                  <Select value={form.doc_type} onValueChange={(v) => setForm({ ...form, doc_type: v as DocType })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {DOC_TYPES.map((t) => (<SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Doc Number</Label>
                  <Input value={form.doc_number ?? ""} onChange={(e) => setForm({ ...form, doc_number: e.target.value })} />
                </div>
              </div>
              <div>
                <Label>Title</Label>
                <Input value={form.title ?? ""} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. National ID Card" />
              </div>
              <div>
                <Label>File URL</Label>
                <Input value={form.file_url ?? ""} onChange={(e) => setForm({ ...form, file_url: e.target.value })} placeholder="https://... or /uploads/..." />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Issue Date</Label>
                  <Input type="date" value={form.issue_date ?? ""} onChange={(e) => setForm({ ...form, issue_date: e.target.value })} />
                </div>
                <div>
                  <Label>Expiry Date</Label>
                  <Input type="date" value={form.expiry_date ?? ""} onChange={(e) => setForm({ ...form, expiry_date: e.target.value })} />
                </div>
              </div>
              <div>
                <Label>Notes</Label>
                <Textarea value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={handleSave}>Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="all">All Documents</TabsTrigger>
          <TabsTrigger value="expiring">
            <AlertTriangle className="h-4 w-4 mr-1" /> Expiring Soon
            {expiring.length > 0 && (<Badge variant="destructive" className="ml-2">{expiring.length}</Badge>)}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-3">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <CardTitle>Documents</CardTitle>
                <div className="w-64">
                  <Select value={employeeFilter} onValueChange={setEmployeeFilter}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Employees</SelectItem>
                      {employees.map((e) => (<SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Doc #</TableHead>
                    <TableHead>Issued</TableHead>
                    <TableHead>Expiry</TableHead>
                    <TableHead>File</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 && (
                    <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">No documents</TableCell></TableRow>
                  )}
                  {filtered.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell>{d.employee_name} <span className="text-xs text-muted-foreground">({d.employee_code})</span></TableCell>
                      <TableCell><Badge variant="outline">{d.doc_type}</Badge></TableCell>
                      <TableCell>{d.title}</TableCell>
                      <TableCell>{d.doc_number ?? "—"}</TableCell>
                      <TableCell>{d.issue_date ?? "—"}</TableCell>
                      <TableCell>{d.expiry_date ? <div className="flex flex-col gap-1"><span>{d.expiry_date}</span>{expiryBadge(d.expiry_date)}</div> : "—"}</TableCell>
                      <TableCell>
                        {d.file_url ? (
                          <a href={d.file_url} target="_blank" rel="noreferrer" className="text-primary inline-flex items-center gap-1">
                            <ExternalLink className="h-4 w-4" /> Open
                          </a>
                        ) : "—"}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(d.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="expiring" className="space-y-3">
          <Card>
            <CardHeader><CardTitle>Expiring or Expired (Next 30 Days)</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Expiry</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expiring.length === 0 && (
                    <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">All clear — no documents expiring soon</TableCell></TableRow>
                  )}
                  {expiring.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell>{d.employee_name}</TableCell>
                      <TableCell><Badge variant="outline">{d.doc_type}</Badge></TableCell>
                      <TableCell>{d.title}</TableCell>
                      <TableCell>{d.expiry_date}</TableCell>
                      <TableCell>{expiryBadge(d.expiry_date)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
