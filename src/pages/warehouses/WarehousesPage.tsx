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
import { warehouseService } from "@/services/warehouseService";
import { bankAccountService } from "@/services/bankAccountService";
import { formatCurrency } from "@/lib/utils";
import { Plus, Warehouse as WhIcon, ArrowRightLeft } from "lucide-react";
import { toast } from "sonner";

const WarehousesPage = () => {
  const dealerId = useDealerId();
  const qc = useQueryClient();
  const [tab, setTab] = useState("warehouses");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", code: "", address: "", manager_name: "", manager_phone: "", is_default: false, notes: "" });
  const [trOpen, setTrOpen] = useState(false);
  const [tr, setTr] = useState({
    transfer_no: "", from_warehouse_id: "", to_warehouse_id: "",
    product_name_snapshot: "", quantity: 0, unit: "pc",
    transport_cost: 0, payment_method: "cash" as "cash" | "bank",
    bank_account_id: "", notes: "",
  });

  const { data: warehouses = [] } = useQuery({
    queryKey: ["warehouses", dealerId], queryFn: () => warehouseService.list(dealerId), enabled: !!dealerId,
  });
  const { data: transfers = [] } = useQuery({
    queryKey: ["warehouse-transfers", dealerId], queryFn: () => warehouseService.transfers(dealerId), enabled: !!dealerId,
  });
  const { data: banks = [] } = useQuery({
    queryKey: ["bank-accounts", dealerId], queryFn: () => bankAccountService.list(dealerId), enabled: !!dealerId,
  });

  const createMut = useMutation({
    mutationFn: () => warehouseService.create(dealerId, form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["warehouses"] }); setOpen(false); setForm({ name: "", code: "", address: "", manager_name: "", manager_phone: "", is_default: false, notes: "" }); toast.success("Warehouse added"); },
    onError: (e: any) => toast.error(e.message),
  });
  const trMut = useMutation({
    mutationFn: () => warehouseService.createTransfer(dealerId, {
      ...tr, bank_account_id: tr.payment_method === "bank" ? tr.bank_account_id : null,
      from_warehouse_id: tr.from_warehouse_id || null, to_warehouse_id: tr.to_warehouse_id || null,
    } as any),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["warehouse-transfers"] }); setTrOpen(false); toast.success("Transfer recorded"); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><WhIcon className="h-6 w-6 text-primary" /> Warehouses / Godowns</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage warehouses and stock transfers between them</p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="warehouses">Warehouses</TabsTrigger>
          <TabsTrigger value="transfers">Transfers</TabsTrigger>
        </TabsList>

        <TabsContent value="warehouses">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>All Warehouses</CardTitle>
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Add Warehouse</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>New Warehouse</DialogTitle></DialogHeader>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Name *</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
                    <div><Label>Code</Label><Input value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} /></div>
                    <div className="col-span-2"><Label>Address</Label><Input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} /></div>
                    <div><Label>Manager Name</Label><Input value={form.manager_name} onChange={e => setForm({ ...form, manager_name: e.target.value })} /></div>
                    <div><Label>Manager Phone</Label><Input value={form.manager_phone} onChange={e => setForm({ ...form, manager_phone: e.target.value })} /></div>
                    <div className="col-span-2 flex items-center gap-2">
                      <input type="checkbox" id="def" checked={form.is_default} onChange={e => setForm({ ...form, is_default: e.target.checked })} />
                      <Label htmlFor="def" className="cursor-pointer">Set as default warehouse</Label>
                    </div>
                  </div>
                  <Button className="w-full mt-3" onClick={() => createMut.mutate()} disabled={createMut.isPending}>Save</Button>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Name</TableHead><TableHead>Code</TableHead><TableHead>Manager</TableHead>
                  <TableHead>Address</TableHead><TableHead>Status</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {warehouses.map(w => (
                    <TableRow key={w.id}>
                      <TableCell className="font-medium">
                        {w.name} {w.is_default && <Badge variant="outline" className="ml-2">Default</Badge>}
                      </TableCell>
                      <TableCell>{w.code || "—"}</TableCell>
                      <TableCell>{w.manager_name || "—"} <span className="text-xs text-muted-foreground">{w.manager_phone}</span></TableCell>
                      <TableCell className="text-xs text-muted-foreground">{w.address || "—"}</TableCell>
                      <TableCell>{w.is_active ? <Badge>Active</Badge> : <Badge variant="secondary">Inactive</Badge>}</TableCell>
                    </TableRow>
                  ))}
                  {!warehouses.length && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">No warehouses yet.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="transfers">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Transfer History</CardTitle>
              <Dialog open={trOpen} onOpenChange={setTrOpen}>
                <DialogTrigger asChild><Button><ArrowRightLeft className="h-4 w-4 mr-2" />New Transfer</Button></DialogTrigger>
                <DialogContent className="max-w-lg">
                  <DialogHeader><DialogTitle>New Warehouse Transfer</DialogTitle></DialogHeader>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Transfer No.</Label><Input value={tr.transfer_no} onChange={e => setTr({ ...tr, transfer_no: e.target.value })} /></div>
                    <div></div>
                    <div>
                      <Label>From Warehouse</Label>
                      <Select value={tr.from_warehouse_id} onValueChange={(v) => setTr({ ...tr, from_warehouse_id: v })}>
                        <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                        <SelectContent>{warehouses.map(w => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>To Warehouse</Label>
                      <Select value={tr.to_warehouse_id} onValueChange={(v) => setTr({ ...tr, to_warehouse_id: v })}>
                        <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                        <SelectContent>{warehouses.map(w => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-2"><Label>Product / Item *</Label><Input value={tr.product_name_snapshot} onChange={e => setTr({ ...tr, product_name_snapshot: e.target.value })} /></div>
                    <div><Label>Quantity *</Label><Input type="number" value={tr.quantity} onChange={e => setTr({ ...tr, quantity: Number(e.target.value) })} /></div>
                    <div><Label>Unit</Label><Input value={tr.unit} onChange={e => setTr({ ...tr, unit: e.target.value })} /></div>
                    <div><Label>Transport Cost</Label><Input type="number" value={tr.transport_cost} onChange={e => setTr({ ...tr, transport_cost: Number(e.target.value) })} /></div>
                    <div>
                      <Label>Payment Method</Label>
                      <Select value={tr.payment_method} onValueChange={(v: any) => setTr({ ...tr, payment_method: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cash">Cash</SelectItem>
                          <SelectItem value="bank">Bank</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {tr.payment_method === "bank" && (
                      <div className="col-span-2">
                        <Label>Bank Account</Label>
                        <Select value={tr.bank_account_id} onValueChange={(v) => setTr({ ...tr, bank_account_id: v })}>
                          <SelectTrigger><SelectValue placeholder="Select bank" /></SelectTrigger>
                          <SelectContent>{banks.filter(b => b.is_active).map(b => <SelectItem key={b.id} value={b.id}>{b.bank_name} — {b.account_number}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                    )}
                    <div className="col-span-2"><Label>Notes</Label><Input value={tr.notes} onChange={e => setTr({ ...tr, notes: e.target.value })} /></div>
                  </div>
                  <Button className="w-full mt-3" onClick={() => trMut.mutate()} disabled={trMut.isPending || tr.quantity <= 0}>Save Transfer</Button>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Date</TableHead><TableHead>No.</TableHead><TableHead>From</TableHead><TableHead>To</TableHead>
                  <TableHead>Item</TableHead><TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Transport</TableHead><TableHead>Method</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {transfers.map(t => (
                    <TableRow key={t.id}>
                      <TableCell className="text-xs">{new Date(t.transfer_date).toLocaleDateString()}</TableCell>
                      <TableCell>{t.transfer_no || "—"}</TableCell>
                      <TableCell>{t.from_warehouse_name || "—"}</TableCell>
                      <TableCell>{t.to_warehouse_name || "—"}</TableCell>
                      <TableCell>{t.product_name_snapshot || "—"}</TableCell>
                      <TableCell className="text-right">{Number(t.quantity)} {t.unit}</TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(Number(t.transport_cost))}</TableCell>
                      <TableCell><Badge variant="outline">{t.payment_method}</Badge></TableCell>
                    </TableRow>
                  ))}
                  {!transfers.length && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-6">No transfers yet.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default WarehousesPage;
