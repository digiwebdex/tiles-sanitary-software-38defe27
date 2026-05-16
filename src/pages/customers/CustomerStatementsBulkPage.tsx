import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useDealerId } from "@/hooks/useDealerId";
import { customerStatementService, type CreditCustomerWithDue } from "@/services/customerStatementService";
import { buildWaLink, normalizePhoneForWa, isValidWaPhone } from "@/services/whatsappService";
import { useAuth } from "@/contexts/AuthContext";
import { formatCurrency } from "@/lib/utils";
import { FileText, MessageCircle, Search, Send, ExternalLink } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const CustomerStatementsBulkPage = () => {
  const dealerId = useDealerId();
  const { profile } = useAuth();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { data: customers, isLoading } = useQuery({
    queryKey: ["credit-customer-list", dealerId],
    queryFn: () => customerStatementService.creditList(dealerId),
    enabled: !!dealerId,
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return customers || [];
    return (customers || []).filter((c) =>
      c.name.toLowerCase().includes(q) || (c.phone || "").includes(q)
    );
  }, [customers, search]);

  const toggleAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map((c) => c.id)));
  };

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };

  const bulkWhatsApp = () => {
    const targets = (filtered || []).filter((c) => selected.has(c.id) && isValidWaPhone(c.phone || ""));
    if (targets.length === 0) {
      toast({ title: "No valid phone numbers selected", variant: "destructive" });
      return;
    }
    if (targets.length > 5) {
      if (!confirm(`Open ${targets.length} WhatsApp tabs? Your browser may block multiple pop-ups.`)) return;
    }
    let opened = 0;
    targets.forEach((c, idx) => {
      const msg = [
        `Hello ${c.name},`,
        `Friendly reminder — your account at ${profile?.full_name || "us"} has an outstanding balance.`,
        ``,
        `*Total due: ৳${c.due_balance.toFixed(2)}*`,
        ``,
        `Kindly clear the outstanding at your earliest convenience.`,
        `Thank you.`,
      ].join("\n");
      setTimeout(() => {
        window.open(buildWaLink(normalizePhoneForWa(c.phone || ""), msg), "_blank");
        opened++;
      }, idx * 400);
    });
    toast({ title: `Opening ${targets.length} WhatsApp message(s)…` });
  };

  const totalDue = (customers || []).reduce((s, c) => s + c.due_balance, 0);

  return (
    <div className="container mx-auto p-4 space-y-4 max-w-7xl">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><FileText className="h-6 w-6" /> Customer Statements</h1>
          <p className="text-sm text-muted-foreground">Send monthly statements to all credit customers in one click.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Credit customers with due</p><p className="text-2xl font-bold">{customers?.length || 0}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total receivables</p><p className="text-2xl font-bold text-destructive">{formatCurrency(totalDue)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Selected</p><p className="text-2xl font-bold">{selected.size}</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2 flex-1 min-w-64">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search name or phone…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-md" />
          </div>
          <Button onClick={bulkWhatsApp} disabled={selected.size === 0}>
            <Send className="h-4 w-4 mr-2" /> Send WhatsApp Reminder ({selected.size})
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <p className="p-6 text-muted-foreground">Loading customers…</p>
          ) : filtered.length === 0 ? (
            <Alert className="m-4"><AlertDescription>No customers with outstanding balance.</AlertDescription></Alert>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox checked={selected.size === filtered.length && filtered.length > 0} onCheckedChange={toggleAll} />
                  </TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead className="text-right">Credit Limit</TableHead>
                  <TableHead className="text-right">Due Balance</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell><Checkbox checked={selected.has(c.id)} onCheckedChange={() => toggle(c.id)} /></TableCell>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell>
                      {c.phone}
                      {!isValidWaPhone(c.phone || "") && <Badge variant="outline" className="ml-2 text-xs">no WA</Badge>}
                    </TableCell>
                    <TableCell className="text-right">{c.credit_limit > 0 ? formatCurrency(c.credit_limit) : "—"}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant={c.credit_limit > 0 && c.due_balance > c.credit_limit ? "destructive" : "secondary"}>
                        {formatCurrency(c.due_balance)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" asChild>
                        <Link to={`/customers/${c.id}/statement`} target="_blank">
                          <ExternalLink className="h-4 w-4 mr-1" /> Statement
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default CustomerStatementsBulkPage;
