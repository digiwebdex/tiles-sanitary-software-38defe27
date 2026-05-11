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
import { bankAccountService, BankAccount } from "@/services/bankAccountService";
import { formatCurrency } from "@/lib/utils";
import { Plus, Wallet, BookOpen } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

const BankAccountsPage = () => {
  const dealerId = useDealerId();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    bank_name: "", account_name: "", account_number: "", branch: "",
    account_type: "current" as "current" | "savings" | "cc", opening_balance: 0,
  });

  const { data: accounts = [], isLoading } = useQuery({
    queryKey: ["bank-accounts", dealerId],
    queryFn: () => bankAccountService.list(dealerId),
    enabled: !!dealerId,
  });

  const createMut = useMutation({
    mutationFn: () => bankAccountService.create(dealerId, form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bank-accounts"] });
      setOpen(false);
      setForm({ bank_name: "", account_name: "", account_number: "", branch: "", account_type: "current", opening_balance: 0 });
      toast.success("Bank account added");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Wallet className="h-6 w-6 text-primary" /> Bank Accounts</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage your business bank accounts and track balances</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" /> Add Bank Account</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New Bank Account</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Bank Name *</Label><Input value={form.bank_name} onChange={e => setForm({ ...form, bank_name: e.target.value })} /></div>
              <div><Label>Account Name *</Label><Input value={form.account_name} onChange={e => setForm({ ...form, account_name: e.target.value })} /></div>
              <div><Label>Account Number *</Label><Input value={form.account_number} onChange={e => setForm({ ...form, account_number: e.target.value })} /></div>
              <div><Label>Branch</Label><Input value={form.branch} onChange={e => setForm({ ...form, branch: e.target.value })} /></div>
              <div>
                <Label>Type</Label>
                <Select value={form.account_type} onValueChange={(v: any) => setForm({ ...form, account_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="current">Current</SelectItem>
                    <SelectItem value="savings">Savings</SelectItem>
                    <SelectItem value="cc">Cash Credit</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Opening Balance</Label><Input type="number" value={form.opening_balance} onChange={e => setForm({ ...form, opening_balance: Number(e.target.value) })} /></div>
              <Button className="w-full" onClick={() => createMut.mutate()} disabled={createMut.isPending}>Save</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader><CardTitle>All Accounts</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <p className="text-muted-foreground">Loading…</p> : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Bank</TableHead><TableHead>Account</TableHead><TableHead>Branch</TableHead>
                <TableHead>Type</TableHead><TableHead className="text-right">Balance</TableHead>
                <TableHead>Status</TableHead><TableHead></TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {accounts.map(a => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">{a.bank_name}</TableCell>
                    <TableCell><div>{a.account_name}</div><div className="text-xs text-muted-foreground">{a.account_number}</div></TableCell>
                    <TableCell>{a.branch || "—"}</TableCell>
                    <TableCell><Badge variant="outline">{a.account_type}</Badge></TableCell>
                    <TableCell className="text-right font-mono">{formatCurrency(a.balance)}</TableCell>
                    <TableCell>{a.is_active ? <Badge>Active</Badge> : <Badge variant="secondary">Inactive</Badge>}</TableCell>
                    <TableCell><Button size="sm" variant="ghost" onClick={() => navigate(`/bank-accounts/${a.id}`)}><BookOpen className="h-4 w-4" /></Button></TableCell>
                  </TableRow>
                ))}
                {!accounts.length && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">No bank accounts yet. Add one to start tracking bank movements.</TableCell></TableRow>}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default BankAccountsPage;
