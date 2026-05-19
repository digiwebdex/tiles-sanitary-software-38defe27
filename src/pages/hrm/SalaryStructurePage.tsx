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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Edit, Calculator, Wallet } from "lucide-react";
import { toast } from "sonner";
import { useDealerId } from "@/hooks/useDealerId";
import { employeeService } from "@/services/employeeService";
import {
  salaryComponentService,
  SalaryComponent,
  SalaryComponentInput,
  ComponentKind,
  ComponentCalc,
} from "@/services/salaryComponentService";

const formatBdt = (n: number) =>
  `৳ ${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const emptyComponent: SalaryComponentInput = {
  code: "",
  name: "",
  kind: "allowance",
  calc: "fixed",
  default_amount: 0,
  default_percent: 0,
  is_taxable: true,
  active: true,
  notes: "",
};

const SalaryStructurePage = () => {
  const dealerId = useDealerId();
  const qc = useQueryClient();

  // ── Components library state
  const [compFormOpen, setCompFormOpen] = useState(false);
  const [editingComp, setEditingComp] = useState<SalaryComponent | null>(null);
  const [compForm, setCompForm] = useState<SalaryComponentInput>(emptyComponent);

  // ── Employee assignment state
  const [employeeId, setEmployeeId] = useState<string>("");
  const [basicForPreview, setBasicForPreview] = useState<number>(0);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignForm, setAssignForm] = useState<{
    component_id: string;
    amount_override: string;
    percent_override: string;
  }>({ component_id: "", amount_override: "", percent_override: "" });

  const componentsQ = useQuery({
    queryKey: ["salary-components", dealerId],
    queryFn: () => salaryComponentService.list(dealerId),
    enabled: !!dealerId,
  });

  const employeesQ = useQuery({
    queryKey: ["employees", dealerId, "all"],
    queryFn: () => employeeService.list(dealerId),
    enabled: !!dealerId,
  });

  const assignmentsQ = useQuery({
    queryKey: ["salary-components-emp", dealerId, employeeId],
    queryFn: () => salaryComponentService.listForEmployee(dealerId, employeeId),
    enabled: !!dealerId && !!employeeId,
  });

  const previewQ = useQuery({
    queryKey: ["salary-preview", dealerId, employeeId, basicForPreview],
    queryFn: () => salaryComponentService.preview(dealerId, employeeId, basicForPreview),
    enabled: !!dealerId && !!employeeId && basicForPreview >= 0,
  });

  // ── mutations
  const saveCompMut = useMutation({
    mutationFn: async () => {
      if (!compForm.code.trim() || !compForm.name.trim()) throw new Error("Code and name are required");
      if (editingComp) return salaryComponentService.update(editingComp.id, dealerId, compForm);
      return salaryComponentService.create(dealerId, compForm);
    },
    onSuccess: () => {
      toast.success(editingComp ? "Component updated" : "Component created");
      setCompFormOpen(false);
      setEditingComp(null);
      setCompForm(emptyComponent);
      qc.invalidateQueries({ queryKey: ["salary-components", dealerId] });
      qc.invalidateQueries({ queryKey: ["salary-components-emp"] });
      qc.invalidateQueries({ queryKey: ["salary-preview"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to save"),
  });

  const deleteCompMut = useMutation({
    mutationFn: (id: string) => salaryComponentService.remove(id, dealerId),
    onSuccess: () => {
      toast.success("Component removed");
      qc.invalidateQueries({ queryKey: ["salary-components", dealerId] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to delete"),
  });

  const assignMut = useMutation({
    mutationFn: async () => {
      if (!assignForm.component_id) throw new Error("Select a component");
      return salaryComponentService.assign(dealerId, employeeId, {
        component_id: assignForm.component_id,
        amount_override: assignForm.amount_override === "" ? null : Number(assignForm.amount_override),
        percent_override: assignForm.percent_override === "" ? null : Number(assignForm.percent_override),
      });
    },
    onSuccess: () => {
      toast.success("Component assigned");
      setAssignOpen(false);
      setAssignForm({ component_id: "", amount_override: "", percent_override: "" });
      qc.invalidateQueries({ queryKey: ["salary-components-emp", dealerId, employeeId] });
      qc.invalidateQueries({ queryKey: ["salary-preview"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to assign"),
  });

  const removeAssignMut = useMutation({
    mutationFn: (id: string) => salaryComponentService.removeAssignment(id, dealerId),
    onSuccess: () => {
      toast.success("Removed");
      qc.invalidateQueries({ queryKey: ["salary-components-emp", dealerId, employeeId] });
      qc.invalidateQueries({ queryKey: ["salary-preview"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to remove"),
  });

  const openCreateComp = () => {
    setEditingComp(null);
    setCompForm(emptyComponent);
    setCompFormOpen(true);
  };

  const openEditComp = (c: SalaryComponent) => {
    setEditingComp(c);
    setCompForm({
      code: c.code,
      name: c.name,
      kind: c.kind,
      calc: c.calc,
      default_amount: Number(c.default_amount),
      default_percent: Number(c.default_percent),
      is_taxable: c.is_taxable,
      active: c.active,
      notes: c.notes ?? "",
    });
    setCompFormOpen(true);
  };

  const allowances = useMemo(
    () => (componentsQ.data?.rows ?? []).filter(c => c.kind === "allowance"),
    [componentsQ.data]
  );
  const deductions = useMemo(
    () => (componentsQ.data?.rows ?? []).filter(c => c.kind === "deduction"),
    [componentsQ.data]
  );

  const employees = employeesQ.data ?? [];

  // when employee changes, prefill basic preview using their base_salary if present
  const setActiveEmployee = (id: string) => {
    setEmployeeId(id);
    const emp = employees.find((e: any) => e.id === id);
    setBasicForPreview(Number(emp?.basic ?? emp?.base_salary ?? emp?.basic_salary ?? 0) || 0);
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Wallet className="h-6 w-6 text-primary" />
            Salary Structure
          </h1>
          <p className="text-sm text-muted-foreground">
            Define allowance &amp; deduction components, then assign them to employees.
          </p>
        </div>
      </div>

      <Tabs defaultValue="components" className="w-full">
        <TabsList>
          <TabsTrigger value="components">Components</TabsTrigger>
          <TabsTrigger value="assignments">Employee Assignments</TabsTrigger>
        </TabsList>

        {/* ── Components Library ── */}
        <TabsContent value="components" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={openCreateComp}>
              <Plus className="h-4 w-4 mr-2" /> Add Component
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Allowances ({allowances.length})</CardTitle></CardHeader>
              <CardContent>
                <ComponentTable rows={allowances} onEdit={openEditComp} onDelete={(id) => {
                  if (confirm("Delete this component?")) deleteCompMut.mutate(id);
                }} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Deductions ({deductions.length})</CardTitle></CardHeader>
              <CardContent>
                <ComponentTable rows={deductions} onEdit={openEditComp} onDelete={(id) => {
                  if (confirm("Delete this component?")) deleteCompMut.mutate(id);
                }} />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── Employee Assignments ── */}
        <TabsContent value="assignments" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Select Employee</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap items-end gap-3">
              <div className="min-w-[260px]">
                <Label>Employee</Label>
                <Select value={employeeId} onValueChange={setActiveEmployee}>
                  <SelectTrigger><SelectValue placeholder="Choose employee" /></SelectTrigger>
                  <SelectContent>
                    {employees.map((e: any) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.name}{e.designation ? ` — ${e.designation}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-40">
                <Label>Basic (preview)</Label>
                <Input
                  type="number"
                  value={basicForPreview}
                  onChange={e => setBasicForPreview(Number(e.target.value) || 0)}
                />
              </div>
              <Button disabled={!employeeId} onClick={() => setAssignOpen(true)}>
                <Plus className="h-4 w-4 mr-2" /> Assign Component
              </Button>
            </CardContent>
          </Card>

          {employeeId && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <Card className="lg:col-span-2">
                <CardHeader><CardTitle className="text-base">Assigned Components</CardTitle></CardHeader>
                <CardContent>
                  {assignmentsQ.isLoading ? (
                    <div className="text-sm text-muted-foreground py-4">Loading…</div>
                  ) : (assignmentsQ.data?.rows ?? []).length === 0 ? (
                    <div className="text-sm text-muted-foreground py-4">No components assigned yet.</div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Kind</TableHead>
                          <TableHead>Calc</TableHead>
                          <TableHead className="text-right">Default</TableHead>
                          <TableHead className="text-right">Override</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(assignmentsQ.data?.rows ?? []).map(a => (
                          <TableRow key={a.id}>
                            <TableCell className="font-medium">{a.component_name} <span className="text-xs text-muted-foreground">({a.component_code})</span></TableCell>
                            <TableCell>
                              <Badge variant={a.kind === "allowance" ? "default" : "destructive"}>{a.kind}</Badge>
                            </TableCell>
                            <TableCell className="text-xs">{a.calc === "percent_basic" ? "% of basic" : "fixed"}</TableCell>
                            <TableCell className="text-right text-xs text-muted-foreground">
                              {a.calc === "percent_basic" ? `${Number(a.default_percent)}%` : formatBdt(Number(a.default_amount))}
                            </TableCell>
                            <TableCell className="text-right">
                              {a.amount_override !== null ? formatBdt(Number(a.amount_override))
                                : a.percent_override !== null ? `${Number(a.percent_override)}%`
                                : <span className="text-xs text-muted-foreground">—</span>}
                            </TableCell>
                            <TableCell>{a.active ? <Badge variant="outline">Active</Badge> : <Badge variant="secondary">Inactive</Badge>}</TableCell>
                            <TableCell className="text-right">
                              <Button
                                size="sm" variant="ghost"
                                onClick={() => { if (confirm("Remove this component from employee?")) removeAssignMut.mutate(a.id); }}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Calculator className="h-4 w-4" /> Salary Breakdown
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {previewQ.isLoading ? (
                    <div className="text-muted-foreground">Calculating…</div>
                  ) : previewQ.data ? (
                    <>
                      <div className="flex justify-between"><span>Basic</span><span className="font-mono">{formatBdt(previewQ.data.basic)}</span></div>
                      <div className="flex justify-between text-emerald-600"><span>+ Allowances</span><span className="font-mono">{formatBdt(previewQ.data.allowances)}</span></div>
                      <div className="border-t pt-1 flex justify-between font-medium"><span>Gross</span><span className="font-mono">{formatBdt(previewQ.data.gross)}</span></div>
                      <div className="flex justify-between text-destructive"><span>− Deductions</span><span className="font-mono">{formatBdt(previewQ.data.deductions)}</span></div>
                      <div className="border-t pt-1 flex justify-between text-base font-bold"><span>Net Payable</span><span className="font-mono">{formatBdt(previewQ.data.net)}</span></div>
                      {previewQ.data.lines.length > 0 && (
                        <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                          {previewQ.data.lines.map(l => (
                            <div key={l.code} className="flex justify-between">
                              <span>{l.kind === "allowance" ? "+" : "−"} {l.name}</span>
                              <span>{formatBdt(l.value)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  ) : null}
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Component create/edit dialog */}
      <Dialog open={compFormOpen} onOpenChange={setCompFormOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editingComp ? "Edit Component" : "Add Component"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Code *</Label>
                <Input value={compForm.code} onChange={e => setCompForm({ ...compForm, code: e.target.value })} placeholder="HRA" />
              </div>
              <div>
                <Label>Name *</Label>
                <Input value={compForm.name} onChange={e => setCompForm({ ...compForm, name: e.target.value })} placeholder="House Rent" />
              </div>
              <div>
                <Label>Kind</Label>
                <Select value={compForm.kind} onValueChange={(v) => setCompForm({ ...compForm, kind: v as ComponentKind })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="allowance">Allowance</SelectItem>
                    <SelectItem value="deduction">Deduction</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Calculation</Label>
                <Select value={compForm.calc} onValueChange={(v) => setCompForm({ ...compForm, calc: v as ComponentCalc })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fixed">Fixed Amount</SelectItem>
                    <SelectItem value="percent_basic">% of Basic</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {compForm.calc === "fixed" ? (
                <div>
                  <Label>Default Amount</Label>
                  <Input type="number" value={compForm.default_amount ?? 0}
                    onChange={e => setCompForm({ ...compForm, default_amount: Number(e.target.value) || 0 })} />
                </div>
              ) : (
                <div>
                  <Label>Default Percent</Label>
                  <Input type="number" value={compForm.default_percent ?? 0}
                    onChange={e => setCompForm({ ...compForm, default_percent: Number(e.target.value) || 0 })} />
                </div>
              )}
              <div className="flex items-center justify-between rounded-md border p-3 col-span-2">
                <div className="text-sm">Active</div>
                <Switch checked={compForm.active !== false} onCheckedChange={(v) => setCompForm({ ...compForm, active: v })} />
              </div>
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea rows={2} value={compForm.notes ?? ""} onChange={e => setCompForm({ ...compForm, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCompFormOpen(false)}>Cancel</Button>
            <Button onClick={() => saveCompMut.mutate()} disabled={saveCompMut.isPending}>
              {saveCompMut.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assignment dialog */}
      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Assign Component</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Component</Label>
              <Select value={assignForm.component_id} onValueChange={v => setAssignForm({ ...assignForm, component_id: v })}>
                <SelectTrigger><SelectValue placeholder="Pick a component" /></SelectTrigger>
                <SelectContent>
                  {(componentsQ.data?.rows ?? []).filter(c => c.active).map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      [{c.kind === "allowance" ? "+" : "−"}] {c.name} ({c.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Amount Override</Label>
                <Input type="number" placeholder="(use default)"
                  value={assignForm.amount_override}
                  onChange={e => setAssignForm({ ...assignForm, amount_override: e.target.value })} />
              </div>
              <div>
                <Label>Percent Override</Label>
                <Input type="number" placeholder="(use default)"
                  value={assignForm.percent_override}
                  onChange={e => setAssignForm({ ...assignForm, percent_override: e.target.value })} />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">Leave overrides blank to use the component's default value.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignOpen(false)}>Cancel</Button>
            <Button onClick={() => assignMut.mutate()} disabled={assignMut.isPending}>
              {assignMut.isPending ? "Saving…" : "Assign"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const ComponentTable = ({
  rows, onEdit, onDelete,
}: {
  rows: SalaryComponent[];
  onEdit: (c: SalaryComponent) => void;
  onDelete: (id: string) => void;
}) => {
  if (!rows.length) return <div className="text-sm text-muted-foreground py-4 text-center">None configured.</div>;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Code</TableHead>
          <TableHead>Name</TableHead>
          <TableHead>Calc</TableHead>
          <TableHead className="text-right">Default</TableHead>
          <TableHead></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map(c => (
          <TableRow key={c.id} className={c.active ? "" : "opacity-50"}>
            <TableCell className="font-mono text-xs">{c.code}</TableCell>
            <TableCell className="font-medium">{c.name}</TableCell>
            <TableCell className="text-xs">{c.calc === "percent_basic" ? "% basic" : "fixed"}</TableCell>
            <TableCell className="text-right font-mono text-xs">
              {c.calc === "percent_basic" ? `${Number(c.default_percent)}%` : formatBdt(Number(c.default_amount))}
            </TableCell>
            <TableCell className="text-right">
              <Button size="sm" variant="ghost" onClick={() => onEdit(c)}><Edit className="h-4 w-4" /></Button>
              <Button size="sm" variant="ghost" onClick={() => onDelete(c.id)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};

export default SalaryStructurePage;
