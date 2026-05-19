import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Phone, Calendar, UserCheck, Trash2, Edit, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/utils";
import { useDealerId } from "@/hooks/useDealerId";
import { leadService, Lead, LeadFormData, LeadStatus, LeadVisit } from "@/services/leadService";

const STATUSES: { value: LeadStatus; label: string; color: string }[] = [
  { value: "new", label: "New", color: "bg-blue-500" },
  { value: "contacted", label: "Contacted", color: "bg-yellow-500" },
  { value: "qualified", label: "Qualified", color: "bg-purple-500" },
  { value: "converted", label: "Converted", color: "bg-green-500" },
  { value: "lost", label: "Lost", color: "bg-red-500" },
];

const SOURCES = ["walk_in", "phone", "referral", "online", "facebook", "whatsapp", "other"] as const;

const emptyForm: LeadFormData = {
  name: "",
  phone: "",
  email: "",
  address: "",
  company: "",
  source: "walk_in",
  status: "new",
  interest: "",
  estimated_value: 0,
  next_followup: "",
  notes: "",
};

const LeadsPage = () => {
  const dealerId = useDealerId();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [statusTab, setStatusTab] = useState<LeadStatus | "all">("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Lead | null>(null);
  const [form, setForm] = useState<LeadFormData>(emptyForm);
  const [visitsOpen, setVisitsOpen] = useState<Lead | null>(null);
  const [visitForm, setVisitForm] = useState({
    visit_date: new Date().toISOString().slice(0, 10),
    visit_type: "visit",
    outcome: "",
    next_action: "",
    next_date: "",
    notes: "",
  });

  const { data, isLoading } = useQuery({
    queryKey: ["leads", dealerId, search, statusTab],
    queryFn: () => leadService.list(dealerId, {
      search,
      status: statusTab === "all" ? undefined : statusTab,
    }),
    enabled: !!dealerId,
  });

  const { data: visits = [] } = useQuery({
    queryKey: ["lead-visits", visitsOpen?.id],
    queryFn: () => leadService.listVisits(visitsOpen!.id),
    enabled: !!visitsOpen,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editing) return leadService.update(editing.id, form);
      return leadService.create(dealerId, form);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["leads"] });
      setFormOpen(false);
      setEditing(null);
      setForm(emptyForm);
      toast.success(editing ? "Lead updated" : "Lead added");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => leadService.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["leads"] });
      toast.success("Lead deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const convertMutation = useMutation({
    mutationFn: (id: string) => leadService.convertToCustomer(id, dealerId),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["leads"] });
      qc.invalidateQueries({ queryKey: ["customers"] });
      toast.success("Lead converted to customer");
      navigate(`/customers`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addVisitMutation = useMutation({
    mutationFn: () => leadService.addVisit(visitsOpen!.id, dealerId, visitForm),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lead-visits"] });
      qc.invalidateQueries({ queryKey: ["leads"] });
      setVisitForm({
        visit_date: new Date().toISOString().slice(0, 10),
        visit_type: "visit",
        outcome: "",
        next_action: "",
        next_date: "",
        notes: "",
      });
      toast.success("Visit logged");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setFormOpen(true);
  };

  const openEdit = (lead: Lead) => {
    setEditing(lead);
    setForm({
      name: lead.name,
      phone: lead.phone ?? "",
      email: lead.email ?? "",
      address: lead.address ?? "",
      company: lead.company ?? "",
      source: lead.source,
      status: lead.status,
      interest: lead.interest ?? "",
      estimated_value: lead.estimated_value,
      next_followup: lead.next_followup ?? "",
      notes: lead.notes ?? "",
    });
    setFormOpen(true);
  };

  const statusBadge = (s: LeadStatus) => {
    const meta = STATUSES.find((x) => x.value === s);
    return <Badge className={`${meta?.color} text-white`}>{meta?.label}</Badge>;
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Leads Management</h1>
          <p className="text-sm text-muted-foreground">Track prospects, follow-ups & visits</p>
        </div>
        <Button onClick={openCreate}><Plus className="w-4 h-4 mr-2" />New Lead</Button>
      </div>

      <Tabs value={statusTab} onValueChange={(v) => setStatusTab(v as any)}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          {STATUSES.map((s) => (
            <TabsTrigger key={s.value} value={s.value}>{s.label}</TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <Card>
        <CardHeader className="pb-3">
          <Input
            placeholder="Search by name, phone, company…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm"
          />
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground py-6 text-center">Loading…</p>
          ) : data?.data.length === 0 ? (
            <p className="text-muted-foreground py-6 text-center">No leads yet. Click "New Lead" to add one.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Est. Value</TableHead>
                    <TableHead>Next Follow-up</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.data.map((lead) => (
                    <TableRow key={lead.id}>
                      <TableCell>
                        <div className="font-medium">{lead.name}</div>
                        {lead.company && <div className="text-xs text-muted-foreground">{lead.company}</div>}
                      </TableCell>
                      <TableCell>{lead.phone ?? "—"}</TableCell>
                      <TableCell className="capitalize">{lead.source.replace("_", " ")}</TableCell>
                      <TableCell>{statusBadge(lead.status)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(lead.estimated_value)}</TableCell>
                      <TableCell>{lead.next_followup ?? "—"}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="ghost" onClick={() => setVisitsOpen(lead)} title="Visits">
                            <MessageSquare className="w-4 h-4" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => openEdit(lead)} title="Edit">
                            <Edit className="w-4 h-4" />
                          </Button>
                          {lead.status !== "converted" && (
                            <Button size="sm" variant="ghost" onClick={() => {
                              if (confirm(`Convert "${lead.name}" to a customer?`)) convertMutation.mutate(lead.id);
                            }} title="Convert to Customer">
                              <UserCheck className="w-4 h-4 text-green-600" />
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" onClick={() => {
                            if (confirm(`Delete "${lead.name}"?`)) deleteMutation.mutate(lead.id);
                          }} title="Delete">
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create / Edit Lead Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Lead" : "New Lead"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label>Name *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <Label>Phone</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div>
              <Label>Email</Label>
              <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <Label>Company</Label>
              <Input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
            </div>
            <div>
              <Label>Source</Label>
              <Select value={form.source} onValueChange={(v) => setForm({ ...form, source: v as any })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SOURCES.map((s) => (<SelectItem key={s} value={s} className="capitalize">{s.replace("_", " ")}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as any })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => (<SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Estimated Value (৳)</Label>
              <Input type="number" value={form.estimated_value ?? 0}
                onChange={(e) => setForm({ ...form, estimated_value: Number(e.target.value) || 0 })} />
            </div>
            <div className="col-span-2">
              <Label>Address</Label>
              <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </div>
            <div className="col-span-2">
              <Label>Interest / Product</Label>
              <Input placeholder="e.g. Floor tiles 16x16, basin"
                value={form.interest} onChange={(e) => setForm({ ...form, interest: e.target.value })} />
            </div>
            <div>
              <Label>Next Follow-up</Label>
              <Input type="date" value={form.next_followup ?? ""}
                onChange={(e) => setForm({ ...form, next_followup: e.target.value })} />
            </div>
            <div className="col-span-2">
              <Label>Notes</Label>
              <Textarea rows={2} value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={!form.name.trim() || saveMutation.isPending}>
              {saveMutation.isPending ? "Saving…" : editing ? "Update" : "Add Lead"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Visits Dialog */}
      <Dialog open={!!visitsOpen} onOpenChange={(o) => !o && setVisitsOpen(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Visits — {visitsOpen?.name}</DialogTitle>
          </DialogHeader>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Log new visit</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-3">
              <div>
                <Label>Date</Label>
                <Input type="date" value={visitForm.visit_date}
                  onChange={(e) => setVisitForm({ ...visitForm, visit_date: e.target.value })} />
              </div>
              <div>
                <Label>Type</Label>
                <Select value={visitForm.visit_type} onValueChange={(v) => setVisitForm({ ...visitForm, visit_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="visit">Site Visit</SelectItem>
                    <SelectItem value="call">Phone Call</SelectItem>
                    <SelectItem value="meeting">Meeting</SelectItem>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Label>Outcome</Label>
                <Input value={visitForm.outcome} onChange={(e) => setVisitForm({ ...visitForm, outcome: e.target.value })} />
              </div>
              <div>
                <Label>Next action</Label>
                <Input value={visitForm.next_action} onChange={(e) => setVisitForm({ ...visitForm, next_action: e.target.value })} />
              </div>
              <div>
                <Label>Next date</Label>
                <Input type="date" value={visitForm.next_date}
                  onChange={(e) => setVisitForm({ ...visitForm, next_date: e.target.value })} />
              </div>
              <div className="col-span-2">
                <Label>Notes</Label>
                <Textarea rows={2} value={visitForm.notes}
                  onChange={(e) => setVisitForm({ ...visitForm, notes: e.target.value })} />
              </div>
              <div className="col-span-2 flex justify-end">
                <Button onClick={() => addVisitMutation.mutate()} disabled={addVisitMutation.isPending}>
                  <Plus className="w-4 h-4 mr-2" />Add Visit
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="mt-4">
            <CardHeader className="pb-2"><CardTitle className="text-base">History ({visits.length})</CardTitle></CardHeader>
            <CardContent>
              {visits.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">No visits logged yet.</p>
              ) : (
                <div className="space-y-3">
                  {visits.map((v) => (
                    <div key={v.id} className="border rounded p-3 text-sm">
                      <div className="flex items-center justify-between">
                        <div className="font-medium capitalize">
                          <Calendar className="w-4 h-4 inline mr-1" />
                          {v.visit_date} · {v.visit_type}
                        </div>
                        {v.next_date && <Badge variant="outline">Next: {v.next_date}</Badge>}
                      </div>
                      {v.outcome && <div className="mt-1"><strong>Outcome:</strong> {v.outcome}</div>}
                      {v.next_action && <div><strong>Next:</strong> {v.next_action}</div>}
                      {v.notes && <div className="text-muted-foreground mt-1">{v.notes}</div>}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LeadsPage;
