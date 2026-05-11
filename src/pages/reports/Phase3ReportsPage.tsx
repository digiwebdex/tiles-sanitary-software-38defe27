import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useDealerId } from "@/hooks/useDealerId";
import { phase3ReportService } from "@/services/phase3ReportService";
import { employeeService } from "@/services/employeeService";
import { directorService } from "@/services/directorService";
import { formatCurrency } from "@/lib/utils";
import { Printer, Users, Briefcase, Warehouse } from "lucide-react";
import { Link } from "react-router-dom";

const Phase3ReportsPage = () => {
  const dealerId = useDealerId();
  const today = new Date().toISOString().slice(0, 10);
  const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);

  const [salaryFilter, setSalaryFilter] = useState({ employeeId: "", from: monthAgo, to: today });
  const [directorFilter, setDirectorFilter] = useState({ directorId: "", from: monthAgo, to: today });

  const { data: employees } = useQuery({
    queryKey: ["employees", dealerId],
    queryFn: () => employeeService.list(dealerId),
    enabled: !!dealerId,
  });
  const { data: directors } = useQuery({
    queryKey: ["directors", dealerId],
    queryFn: () => directorService.list(dealerId),
    enabled: !!dealerId,
  });

  const { data: salary } = useQuery({
    queryKey: ["salary-history", dealerId, salaryFilter],
    queryFn: () => phase3ReportService.salaryHistory(
      dealerId,
      salaryFilter.employeeId === "all" ? undefined : salaryFilter.employeeId || undefined,
      salaryFilter.from,
      salaryFilter.to,
    ),
    enabled: !!dealerId,
  });

  const { data: dStatement } = useQuery({
    queryKey: ["director-statement", dealerId, directorFilter],
    queryFn: () => phase3ReportService.directorStatement(
      dealerId,
      directorFilter.directorId === "all" ? undefined : directorFilter.directorId || undefined,
      directorFilter.from,
      directorFilter.to,
    ),
    enabled: !!dealerId,
  });

  const { data: warehouseData } = useQuery({
    queryKey: ["warehouse-stock", dealerId],
    queryFn: () => phase3ReportService.warehouseStock(dealerId),
    enabled: !!dealerId,
  });

  return (
    <div className="container mx-auto p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Operations Reports</h1>
        <Button variant="outline" onClick={() => window.print()}><Printer className="h-4 w-4 mr-2" /> Print</Button>
      </div>

      <Tabs defaultValue="salary">
        <TabsList>
          <TabsTrigger value="salary"><Users className="h-4 w-4 mr-2" /> Salary History</TabsTrigger>
          <TabsTrigger value="director"><Briefcase className="h-4 w-4 mr-2" /> Director Statement</TabsTrigger>
          <TabsTrigger value="warehouse"><Warehouse className="h-4 w-4 mr-2" /> Warehouse Stock</TabsTrigger>
        </TabsList>

        {/* SALARY HISTORY */}
        <TabsContent value="salary" className="space-y-4">
          <Card>
            <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <Label>Employee</Label>
                <Select value={salaryFilter.employeeId} onValueChange={v => setSalaryFilter(s => ({ ...s, employeeId: v }))}>
                  <SelectTrigger><SelectValue placeholder="All employees" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All employees</SelectItem>
                    {employees?.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>From</Label><Input type="date" value={salaryFilter.from} onChange={e => setSalaryFilter(s => ({ ...s, from: e.target.value }))} /></div>
              <div><Label>To</Label><Input type="date" value={salaryFilter.to} onChange={e => setSalaryFilter(s => ({ ...s, to: e.target.value }))} /></div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Salary Payments — {salary?.count ?? 0} records, total {formatCurrency(salary?.total ?? 0)}</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead><TableHead>Employee</TableHead><TableHead>Period</TableHead>
                    <TableHead>Method</TableHead><TableHead className="text-right">Net Payable</TableHead><TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {salary?.rows.map(r => (
                    <TableRow key={r.id}>
                      <TableCell>{r.payment_date?.slice(0, 10)}</TableCell>
                      <TableCell>{r.employee_name}<div className="text-xs text-muted-foreground">{r.designation}</div></TableCell>
                      <TableCell>{r.period}</TableCell>
                      <TableCell className="capitalize">{r.payment_method}{r.bank_name ? ` (${r.bank_name})` : ""}</TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(r.net_payable)}</TableCell>
                      <TableCell><Link to={`/vouchers/salary/${r.id}`} className="text-primary text-xs underline">Voucher</Link></TableCell>
                    </TableRow>
                  ))}
                  {!salary?.rows.length && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">No records</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* DIRECTOR STATEMENT */}
        <TabsContent value="director" className="space-y-4">
          <Card>
            <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <Label>Director</Label>
                <Select value={directorFilter.directorId} onValueChange={v => setDirectorFilter(s => ({ ...s, directorId: v }))}>
                  <SelectTrigger><SelectValue placeholder="All directors" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All directors</SelectItem>
                    {directors?.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>From</Label><Input type="date" value={directorFilter.from} onChange={e => setDirectorFilter(s => ({ ...s, from: e.target.value }))} /></div>
              <div><Label>To</Label><Input type="date" value={directorFilter.to} onChange={e => setDirectorFilter(s => ({ ...s, to: e.target.value }))} /></div>
            </CardContent>
          </Card>
          {dStatement && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card><CardContent className="pt-6"><div className="text-xs text-muted-foreground">Deposits</div><div className="text-xl font-bold text-emerald-500">{formatCurrency(dStatement.summary.deposits)}</div></CardContent></Card>
              <Card><CardContent className="pt-6"><div className="text-xs text-muted-foreground">Withdrawals</div><div className="text-xl font-bold text-red-500">{formatCurrency(dStatement.summary.withdrawals)}</div></CardContent></Card>
              <Card><CardContent className="pt-6"><div className="text-xs text-muted-foreground">Dividends</div><div className="text-xl font-bold text-amber-500">{formatCurrency(dStatement.summary.dividends)}</div></CardContent></Card>
              <Card><CardContent className="pt-6"><div className="text-xs text-muted-foreground">Net Capital</div><div className="text-xl font-bold text-primary">{formatCurrency(dStatement.summary.net_capital)}</div></CardContent></Card>
            </div>
          )}
          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow><TableHead>Date</TableHead><TableHead>Director</TableHead><TableHead>Type</TableHead><TableHead>Method</TableHead><TableHead className="text-right">Amount</TableHead><TableHead></TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {dStatement?.rows.map(r => (
                    <TableRow key={r.id}>
                      <TableCell>{r.entry_date?.slice(0, 10)}</TableCell>
                      <TableCell>{r.director_name}</TableCell>
                      <TableCell className="capitalize">{r.type}</TableCell>
                      <TableCell className="capitalize">{r.payment_method}{r.bank_name ? ` (${r.bank_name})` : ""}</TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(r.amount)}</TableCell>
                      <TableCell><Link to={`/vouchers/director/${r.id}`} className="text-primary text-xs underline">Voucher</Link></TableCell>
                    </TableRow>
                  ))}
                  {!dStatement?.rows.length && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">No records</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* WAREHOUSE STOCK */}
        <TabsContent value="warehouse" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Warehouses</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow><TableHead>Name</TableHead><TableHead>Code</TableHead><TableHead>Manager</TableHead><TableHead className="text-right">Total In</TableHead><TableHead className="text-right">Total Out</TableHead><TableHead className="text-right">Net</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {warehouseData?.warehouses.map(w => (
                    <TableRow key={w.id}>
                      <TableCell className="font-medium">{w.name}{w.is_default ? <span className="text-xs text-primary ml-2">(default)</span> : null}</TableCell>
                      <TableCell>{w.code}</TableCell>
                      <TableCell>{w.manager_name}</TableCell>
                      <TableCell className="text-right font-mono text-emerald-500">{w.total_in}</TableCell>
                      <TableCell className="text-right font-mono text-red-500">{w.total_out}</TableCell>
                      <TableCell className="text-right font-mono font-semibold">{w.net}</TableCell>
                    </TableRow>
                  ))}
                  {!warehouseData?.warehouses.length && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">No warehouses</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Recent Transfers</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow><TableHead>Date</TableHead><TableHead>From → To</TableHead><TableHead>Product</TableHead><TableHead className="text-right">Qty</TableHead><TableHead className="text-right">Cost</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {warehouseData?.recent_transfers.map(t => (
                    <TableRow key={t.id}>
                      <TableCell>{t.transfer_date?.slice(0, 10)}</TableCell>
                      <TableCell>{t.from_name ?? "—"} → {t.to_name ?? "—"}</TableCell>
                      <TableCell>{t.product_name_snapshot}</TableCell>
                      <TableCell className="text-right font-mono">{t.quantity} {t.unit}</TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(t.transport_cost)}</TableCell>
                    </TableRow>
                  ))}
                  {!warehouseData?.recent_transfers.length && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">No transfers</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Phase3ReportsPage;
