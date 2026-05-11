import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
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
import { bankAccountService } from "@/services/bankAccountService";
import { formatCurrency } from "@/lib/utils";
import { ArrowLeft, Plus } from "lucide-react";
import { toast } from "sonner";

const BankAccountDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const dealerId = useDealerId();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [entry, setEntry] = useState({ type: "deposit", amount: 0, description: "", entry_date: new Date().toISOString().slice(0, 10) });

  const { data: accounts = [] } = useQuery({
    queryKey: ["bank-accounts", dealerId],
    queryFn: () => bankAccountService.list(dealerId),
    enabled: !!dealerId,
  });
  const account = accounts.find(a => a.id === id);

  const { data: ledger } = useQuery({
    queryKey: ["bank-ledger", id, dealerId],
    queryFn: () => bankAccountService.ledger(id!, dealerId),
    enabled: !!id && !!dealerId,
  });

  const entryMut = useMutation({
    mutationFn: () => bankAccountService.addEntry(id!, dealerId, entry),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bank-ledger", id] });
      qc.invalidateQueries({ queryKey: ["bank-accounts"] });
      setOpen(false);
      setEntry({ type: "deposit", amount: 0, description: "", entry_date: new Date().toISOString().slice(0, 10) });
      toast.success("Entry recorded");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="container mx-auto p-6 space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => navigate("/bank-accounts")}><ArrowLeft className="h-4 w-4" /></Button>
        <h1 className="text-2xl font-bold">{account?.bank_name || "Bank Account"}</h1>
      </div>

      {account && (
        <Card>
          <CardContent className="pt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
            <div><div className="text-xs text-muted-foreground">Account No</div><div className="font-mono">{account.account_number}</div></div>
            <div><div className="text-xs text-muted-foreground">Branch</div><div>{account.branch || "—"}</div></div>
            <div><div className="text-xs text-muted-foreground">Type</div><Badge variant="outline">{account.account_type}</Badge></div>
            <div><div className="text-xs text-muted-foreground">Current Balance</div><div className="text-xl font-bold text-primary">{formatCurrency(account.balance)}</div></div>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" /> Add Entry</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New Bank Entry</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Type</Label>
                <Select value={entry.type} onValueChange={v => setEntry({ ...entry, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="deposit">Deposit (in)</SelectItem>
                    <SelectItem value="withdrawal">Withdrawal (out)</SelectItem>
                    <SelectItem value="payment">Payment to supplier (out)</SelectItem>
                    <SelectItem value="expense">Expense (out)</SelectItem>
                    <SelectItem value="transfer">Transfer</SelectItem>
                    <SelectItem value="adjustment">Adjustment</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Amount (positive number)</Label><Input type="number" value={entry.amount} onChange={e => setEntry({ ...entry, amount: Number(e.target.value) })} /></div>
              <div><Label>Date</Label><Input type="date" value={entry.entry_date} onChange={e => setEntry({ ...entry, entry_date: e.target.value })} /></div>
              <div><Label>Description</Label><Input value={entry.description} onChange={e => setEntry({ ...entry, description: e.target.value })} /></div>
              <Button className="w-full" onClick={() => entryMut.mutate()} disabled={entryMut.isPending}>Save</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader><CardTitle>Transactions</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow>
              <TableHead>Date</TableHead><TableHead>Type</TableHead><TableHead>Description</TableHead><TableHead className="text-right">Amount</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {ledger?.rows.map(r => (
                <TableRow key={r.id}>
                  <TableCell>{new Date(r.entry_date).toLocaleDateString()}</TableCell>
                  <TableCell><Badge variant="outline">{r.type}</Badge></TableCell>
                  <TableCell>{r.description || "—"}</TableCell>
                  <TableCell className={`text-right font-mono ${Number(r.amount) >= 0 ? "text-emerald-500" : "text-red-500"}`}>{formatCurrency(Math.abs(Number(r.amount)))}</TableCell>
                </TableRow>
              ))}
              {!ledger?.rows?.length && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">No transactions</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default BankAccountDetailPage;
