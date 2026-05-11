import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useDealerId } from "@/hooks/useDealerId";
import { directorService, DirectorEquity } from "@/services/directorService";
import { bankAccountService } from "@/services/bankAccountService";
import { formatCurrency } from "@/lib/utils";
import { Plus, Crown, ArrowDownCircle, ArrowUpCircle } from "lucide-react";
import { toast } from "sonner";

const DirectorsPage = () => {
  const dealerId = useDealerId();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", role: "Director", phone: "", email: "", address: "", share_pct: 0, notes: "" });
  const [txFor, setTxFor] = useState<DirectorEquity | null>(null);
  const [tx, setTx] = useState({ type: "deposit" as "deposit" | "withdrawal" | "dividend", amount: 0, payment_method: "cash" as "cash" | "bank", bank_account_id: "", description: "" });

  const { data: directors = [], isLoading } = useQuery({
    queryKey: ["directors-equity", dealerId],
    queryFn: () => directorService.equitySummary(dealerId), enabled: !!dealerId,
  });
  const { data: banks = [] } = useQuery({
    queryKey: ["bank-accounts", dealerId],
    queryFn: () => bankAccountService.list(dealerId), enabled: !!dealerId,
  });

  const createMut = useMutation({
    mutationFn: () => directorService.create(dealerId, form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["directors-equity"] }); setOpen(false); setForm({ name: "", role: "Director", phone: "", email: "", address: "", share_pct: 0, notes: "" }); toast.success("Director added"); },
    onError: (e: any) => toast.error(e.message),
  });
  const txMut = useMutation({
    mutationFn: () => directorService.addTransaction(txFor!.id, dealerId, {
      ...tx, bank_account_id: tx.payment_method === "bank" ? tx.bank_account_id : null,
    } as any),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["directors-equity"] }); setTxFor(null); setTx({ type: "deposit", amount: 0, payment_method: "cash", bank_account_id: "", description: "" }); toast.success("Transaction recorded"); },
    onError: (e: any) => toast.error(e.message),
  });

  const totalEquity = directors.reduce((s, d) => s + Number(d.net_equity || 0), 0);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Crown className="h-6 w-6 text-primary" /> Directors / Investors</h1>
          <p className="text-sm text-muted-foreground mt-1">Track deposits, withdrawals, and equity per director</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Add Director</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New Director / Investor</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><Label>Name *</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
              <div><Label>Role</Label><Input value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} /></div>
              <div><Label>Share %</Label><Input type="number" value={form.share_pct} onChange={e => setForm({ ...form, share_pct: Number(e.target.value) })} /></div>
              <div><Label>Phone</Label><Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
              <div><Label>Email</Label><Input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
              <div className="col-span-2"><Label>Address</Label><Input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} /></div>
            </div>
            <Button className="w-full mt-3" onClick={() => createMut.mutate()} disabled={createMut.isPending}>Save</Button>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader><CardTitle>Equity Summary</CardTitle></CardHeader>
        <CardContent>
          <div className="text-sm mb-3">Total Net Equity: <strong className="text-primary">{formatCurrency(totalEquity)}</strong></div>
          {isLoading ? <p className="text-muted-foreground">Loading…</p> : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Name</TableHead><TableHead>Role</TableHead><TableHead className="text-right">Share %</TableHead>
                <TableHead className="text-right">Deposits</TableHead><TableHead className="text-right">Withdrawals</TableHead>
                <TableHead className="text-right">Dividends</TableHead><TableHead className="text-right">Net Equity</TableHead>
                <TableHead></TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {directors.map(d => (
                  <TableRow key={d.id}>
                    <TableCell className="font-medium">{d.name}</TableCell>
                    <TableCell><Badge variant="outline">{d.role || "Director"}</Badge></TableCell>
                    <TableCell className="text-right">{Number(d.share_pct).toFixed(2)}%</TableCell>
                    <TableCell className="text-right font-mono text-green-600">{formatCurrency(d.deposit)}</TableCell>
                    <TableCell className="text-right font-mono text-red-600">{formatCurrency(d.withdrawal)}</TableCell>
                    <TableCell className="text-right font-mono text-amber-600">{formatCurrency(d.dividend)}</TableCell>
                    <TableCell className="text-right font-mono font-semibold">{formatCurrency(d.net_equity)}</TableCell>
                    <TableCell><Button size="sm" onClick={() => setTxFor(d)}>Transaction</Button></TableCell>
                  </TableRow>
                ))}
                {!directors.length && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-6">No directors yet.</TableCell></TableRow>}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!txFor} onOpenChange={(o) => !o && setTxFor(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{txFor?.name} — Transaction</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Type *</Label>
              <Select value={tx.type} onValueChange={(v: any) => setTx({ ...tx, type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="deposit"><ArrowDownCircle className="inline h-3 w-3 mr-1" />Deposit (capital in)</SelectItem>
                  <SelectItem value="withdrawal"><ArrowUpCircle className="inline h-3 w-3 mr-1" />Withdrawal</SelectItem>
                  <SelectItem value="dividend">Dividend Paid</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Amount *</Label><Input type="number" value={tx.amount} onChange={e => setTx({ ...tx, amount: Number(e.target.value) })} /></div>
            <div>
              <Label>Payment Method</Label>
              <Select value={tx.payment_method} onValueChange={(v: any) => setTx({ ...tx, payment_method: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="bank">Bank</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {tx.payment_method === "bank" && (
              <div>
                <Label>Bank Account *</Label>
                <Select value={tx.bank_account_id} onValueChange={(v) => setTx({ ...tx, bank_account_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select bank" /></SelectTrigger>
                  <SelectContent>
                    {banks.filter(b => b.is_active).map(b => <SelectItem key={b.id} value={b.id}>{b.bank_name} — {b.account_number}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div><Label>Description</Label><Input value={tx.description} onChange={e => setTx({ ...tx, description: e.target.value })} /></div>
            <Button className="w-full" onClick={() => txMut.mutate()} disabled={txMut.isPending || tx.amount <= 0 || (tx.payment_method === "bank" && !tx.bank_account_id)}>Save Transaction</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DirectorsPage;
