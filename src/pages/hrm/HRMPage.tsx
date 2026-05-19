import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useDealerId } from "@/hooks/useDealerId";
import { employeeService, Employee } from "@/services/employeeService";
import { bankAccountService } from "@/services/bankAccountService";
import { formatCurrency } from "@/lib/utils";
import { Plus, Users, Wallet, Settings2, CalendarCheck, HandCoins, Trash2 } from "lucide-react";
import { toast } from "sonner";

const emptyEmp = {
  employee_code: "", name: "", designation: "", department: "",
  phone: "", email: "", nid: "", address: "", joining_date: "",
  status: "active" as const, notes: "",
};

const emptyStruct = {
  basic: 0, house_rent_pct: 0, medical_pct: 0, transport_pct: 0,
  other_allowance: 0, deduction: 0,
};

const HRMPage = () => {
  const dealerId = useDealerId();
  const qc = useQueryClient();
  const [tab, setTab] = useState("employees");
  const [empOpen, setEmpOpen] = useState(false);
  const [empForm, setEmpForm] = useState<typeof emptyEmp>(emptyEmp);
  const [structFor, setStructFor] = useState<Employee | null>(null);
  const [structForm, setStructForm] = useState(emptyStruct);
  const [payFor, setPayFor] = useState<Employee | null>(null);
  const [payPeriod, setPayPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [payMethod, setPayMethod] = useState<"cash" | "bank">("cash");
  const [payBank, setPayBank] = useState<string>("");
  const [filterPeriod, setFilterPeriod] = useState("");

  // Attendance
  const today = new Date().toISOString().slice(0, 10);
  const [attDate, setAttDate] = useState(today);
  const [bulkStatus, setBulkStatus] = useState<Record<string, string>>({});
  const [attPeriod, setAttPeriod] = useState(new Date().toISOString().slice(0, 7));

  // Advances
  const [advFor, setAdvFor] = useState<Employee | null>(null);
  const [advForm, setAdvForm] = useState({ amount: 0, payment_method: "cash" as "cash" | "bank", bank_account_id: "", notes: "" });

  const { data: employees = [], isLoading } = useQuery({
    queryKey: ["employees", dealerId],
    queryFn: () => employeeService.list(dealerId), enabled: !!dealerId,
  });
  const { data: payments = [] } = useQuery({
    queryKey: ["salary-payments", dealerId, filterPeriod],
    queryFn: () => employeeService.payments(dealerId, filterPeriod || undefined),
    enabled: !!dealerId,
  });
  const { data: banks = [] } = useQuery({
    queryKey: ["bank-accounts", dealerId],
    queryFn: () => bankAccountService.list(dealerId), enabled: !!dealerId,
  });

  const createEmp = useMutation({
    mutationFn: () => employeeService.create(dealerId, empForm),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["employees"] }); setEmpOpen(false); setEmpForm(emptyEmp); toast.success("Employee added"); },
    onError: (e: any) => toast.error(e.message),
  });
  const saveStruct = useMutation({
    mutationFn: () => employeeService.setStructure(structFor!.id, dealerId, structForm),
    onSuccess: () => { setStructFor(null); toast.success("Salary structure saved"); },
    onError: (e: any) => toast.error(e.message),
  });
  const payRoll = useMutation({
    mutationFn: () => employeeService.payRoll(payFor!.id, dealerId, {
      period: payPeriod, payment_method: payMethod, bank_account_id: payMethod === "bank" ? payBank : null,
    } as any),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["salary-payments"] }); setPayFor(null); toast.success("Salary disbursed"); },
    onError: (e: any) => toast.error(e.message),
  });

  // Attendance queries & mutations
  const { data: attRows = [] } = useQuery({
    queryKey: ["attendance", dealerId, attDate],
    queryFn: () => employeeService.attendance(dealerId, { from: attDate, to: attDate }),
    enabled: !!dealerId && tab === "attendance",
  });
  const { data: attSummary = [] } = useQuery({
    queryKey: ["attendance-summary", dealerId, attPeriod],
    queryFn: () => employeeService.attendanceSummary(dealerId, attPeriod),
    enabled: !!dealerId && tab === "attendance",
  });
  const saveBulk = useMutation({
    mutationFn: () => {
      const entries = Object.entries(bulkStatus)
        .filter(([, s]) => s)
        .map(([employee_id, status]) => ({ employee_id, status }));
      if (!entries.length) throw new Error("Mark at least one employee");
      return employeeService.bulkAttendance(dealerId, attDate, entries);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["attendance"] }); qc.invalidateQueries({ queryKey: ["attendance-summary"] }); setBulkStatus({}); toast.success("Attendance saved"); },
    onError: (e: any) => toast.error(e.message),
  });

  // Advances queries & mutations
  const { data: advances = [] } = useQuery({
    queryKey: ["advances", dealerId],
    queryFn: () => employeeService.advances(dealerId),
    enabled: !!dealerId && tab === "advances",
  });
  const issueAdvance = useMutation({
    mutationFn: () => employeeService.issueAdvance(advFor!.id, dealerId, {
      amount: Number(advForm.amount),
      payment_method: advForm.payment_method,
      bank_account_id: advForm.payment_method === "bank" ? advForm.bank_account_id : null,
      notes: advForm.notes || undefined,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["advances"] }); setAdvFor(null); setAdvForm({ amount: 0, payment_method: "cash", bank_account_id: "", notes: "" }); toast.success("Advance issued"); },
    onError: (e: any) => toast.error(e.message),
  });
  const cancelAdv = useMutation({
    mutationFn: (id: string) => employeeService.cancelAdvance(id, dealerId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["advances"] }); toast.success("Advance cancelled"); },
    onError: (e: any) => toast.error(e.message),
  });

  const openStruct = async (emp: Employee) => {
    setStructFor(emp);
    const s = await employeeService.getStructure(emp.id, dealerId);
    setStructForm(s ? { basic: Number(s.basic), house_rent_pct: Number(s.house_rent_pct), medical_pct: Number(s.medical_pct), transport_pct: Number(s.transport_pct), other_allowance: Number(s.other_allowance), deduction: Number(s.deduction) } : emptyStruct);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Users className="h-6 w-6 text-primary" /> HRM — Employees & Salary</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage staff, salary structures, and monthly disbursements</p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="employees">Employees</TabsTrigger>
          <TabsTrigger value="attendance"><CalendarCheck className="h-4 w-4 mr-1" />Attendance</TabsTrigger>
          <TabsTrigger value="advances"><HandCoins className="h-4 w-4 mr-1" />Advances</TabsTrigger>
          <TabsTrigger value="payments">Salary Payments</TabsTrigger>
        </TabsList>

        <TabsContent value="employees">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>All Employees</CardTitle>
              <Dialog open={empOpen} onOpenChange={setEmpOpen}>
                <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" /> Add Employee</Button></DialogTrigger>
                <DialogContent className="max-w-lg">
                  <DialogHeader><DialogTitle>New Employee</DialogTitle></DialogHeader>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Code</Label><Input value={empForm.employee_code} onChange={e => setEmpForm({ ...empForm, employee_code: e.target.value })} /></div>
                    <div><Label>Name *</Label><Input value={empForm.name} onChange={e => setEmpForm({ ...empForm, name: e.target.value })} /></div>
                    <div><Label>Designation</Label><Input value={empForm.designation} onChange={e => setEmpForm({ ...empForm, designation: e.target.value })} /></div>
                    <div><Label>Department</Label><Input value={empForm.department} onChange={e => setEmpForm({ ...empForm, department: e.target.value })} /></div>
                    <div><Label>Phone</Label><Input value={empForm.phone} onChange={e => setEmpForm({ ...empForm, phone: e.target.value })} /></div>
                    <div><Label>Email</Label><Input value={empForm.email} onChange={e => setEmpForm({ ...empForm, email: e.target.value })} /></div>
                    <div><Label>NID</Label><Input value={empForm.nid} onChange={e => setEmpForm({ ...empForm, nid: e.target.value })} /></div>
                    <div><Label>Joining Date</Label><Input type="date" value={empForm.joining_date} onChange={e => setEmpForm({ ...empForm, joining_date: e.target.value })} /></div>
                    <div className="col-span-2"><Label>Address</Label><Input value={empForm.address} onChange={e => setEmpForm({ ...empForm, address: e.target.value })} /></div>
                  </div>
                  <Button className="w-full mt-3" onClick={() => createEmp.mutate()} disabled={createEmp.isPending}>Save</Button>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {isLoading ? <p className="text-muted-foreground">Loading…</p> : (
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Code</TableHead><TableHead>Name</TableHead><TableHead>Designation</TableHead>
                    <TableHead>Phone</TableHead><TableHead>Status</TableHead><TableHead></TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {employees.map(e => (
                      <TableRow key={e.id}>
                        <TableCell>{e.employee_code || "—"}</TableCell>
                        <TableCell className="font-medium">{e.name}</TableCell>
                        <TableCell>{e.designation || "—"}</TableCell>
                        <TableCell>{e.phone || "—"}</TableCell>
                        <TableCell><Badge variant={e.status === "active" ? "default" : "secondary"}>{e.status}</Badge></TableCell>
                        <TableCell className="space-x-2">
                          <Button size="sm" variant="outline" onClick={() => openStruct(e)}><Settings2 className="h-3 w-3 mr-1" />Salary Setup</Button>
                          <Button size="sm" onClick={() => { setPayFor(e); setPayMethod("cash"); setPayBank(""); }}><Wallet className="h-3 w-3 mr-1" />Pay</Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {!employees.length && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">No employees yet.</TableCell></TableRow>}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payments">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Salary Disbursements</CardTitle>
              <div className="flex items-center gap-2">
                <Label className="text-xs">Period</Label>
                <Input type="month" value={filterPeriod} onChange={e => setFilterPeriod(e.target.value)} className="w-40" />
                <Button size="sm" variant="outline" onClick={() => setFilterPeriod("")}>All</Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Period</TableHead><TableHead>Employee</TableHead><TableHead>Designation</TableHead>
                  <TableHead className="text-right">Basic</TableHead><TableHead className="text-right">Allowances</TableHead>
                  <TableHead className="text-right">Deduction</TableHead><TableHead className="text-right">Net</TableHead>
                  <TableHead>Method</TableHead><TableHead>Date</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {payments.map(p => (
                    <TableRow key={p.id}>
                      <TableCell>{p.period}</TableCell>
                      <TableCell className="font-medium">{p.employee_name}</TableCell>
                      <TableCell className="text-muted-foreground">{p.designation || "—"}</TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(Number(p.basic))}</TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(Number(p.house_rent) + Number(p.medical) + Number(p.transport) + Number(p.other_allowance))}</TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(Number(p.deduction))}</TableCell>
                      <TableCell className="text-right font-mono font-semibold">{formatCurrency(Number(p.net_payable))}</TableCell>
                      <TableCell><Badge variant="outline">{p.payment_method}</Badge></TableCell>
                      <TableCell className="text-xs">{new Date(p.payment_date).toLocaleDateString()}</TableCell>
                    </TableRow>
                  ))}
                  {!payments.length && <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-6">No salary payments.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Salary structure dialog */}
      <Dialog open={!!structFor} onOpenChange={(o) => !o && setStructFor(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Salary Structure — {structFor?.name}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Basic *</Label><Input type="number" value={structForm.basic} onChange={e => setStructForm({ ...structForm, basic: Number(e.target.value) })} /></div>
            <div><Label>House Rent %</Label><Input type="number" value={structForm.house_rent_pct} onChange={e => setStructForm({ ...structForm, house_rent_pct: Number(e.target.value) })} /></div>
            <div><Label>Medical %</Label><Input type="number" value={structForm.medical_pct} onChange={e => setStructForm({ ...structForm, medical_pct: Number(e.target.value) })} /></div>
            <div><Label>Transport %</Label><Input type="number" value={structForm.transport_pct} onChange={e => setStructForm({ ...structForm, transport_pct: Number(e.target.value) })} /></div>
            <div><Label>Other Allowance (flat)</Label><Input type="number" value={structForm.other_allowance} onChange={e => setStructForm({ ...structForm, other_allowance: Number(e.target.value) })} /></div>
            <div><Label>Deduction (flat)</Label><Input type="number" value={structForm.deduction} onChange={e => setStructForm({ ...structForm, deduction: Number(e.target.value) })} /></div>
          </div>
          <div className="text-sm bg-muted p-3 rounded">
            Net est: <strong>{formatCurrency(structForm.basic + structForm.basic * (structForm.house_rent_pct + structForm.medical_pct + structForm.transport_pct) / 100 + structForm.other_allowance - structForm.deduction)}</strong>
          </div>
          <Button className="w-full" onClick={() => saveStruct.mutate()} disabled={saveStruct.isPending}>Save Structure</Button>
        </DialogContent>
      </Dialog>

      {/* Salary payment dialog */}
      <Dialog open={!!payFor} onOpenChange={(o) => !o && setPayFor(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Disburse Salary — {payFor?.name}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Period (YYYY-MM) *</Label><Input type="month" value={payPeriod} onChange={e => setPayPeriod(e.target.value)} /></div>
            <div>
              <Label>Payment Method</Label>
              <Select value={payMethod} onValueChange={(v: any) => setPayMethod(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="bank">Bank</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {payMethod === "bank" && (
              <div>
                <Label>Bank Account *</Label>
                <Select value={payBank} onValueChange={setPayBank}>
                  <SelectTrigger><SelectValue placeholder="Select bank" /></SelectTrigger>
                  <SelectContent>
                    {banks.filter(b => b.is_active).map(b => <SelectItem key={b.id} value={b.id}>{b.bank_name} — {b.account_number}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <Button className="w-full" onClick={() => payRoll.mutate()} disabled={payRoll.isPending || (payMethod === "bank" && !payBank)}>Disburse</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default HRMPage;
