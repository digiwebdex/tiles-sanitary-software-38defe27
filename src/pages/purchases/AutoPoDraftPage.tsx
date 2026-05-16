import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useDealerId } from "@/hooks/useDealerId";
import { autoPoService, type AutoPoSuggestionItem } from "@/services/autoPoService";
import { purchaseService } from "@/services/purchaseService";
import { formatCurrency } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { Sparkles, Send, Trash2, CheckCircle2, ShoppingCart, Package, AlertTriangle, Loader2 } from "lucide-react";

const AutoPoDraftPage = () => {
  const dealerId = useDealerId();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [openDraft, setOpenDraft] = useState<string | null>(null);
  const [editedQtys, setEditedQtys] = useState<Record<string, string>>({});
  const [editedRates, setEditedRates] = useState<Record<string, string>>({});

  const sugQ = useQuery({
    queryKey: ["auto-po-suggestions", dealerId],
    queryFn: () => autoPoService.suggestions(dealerId),
    enabled: !!dealerId,
  });
  const draftsQ = useQuery({
    queryKey: ["auto-po-drafts", dealerId],
    queryFn: () => autoPoService.listDrafts(dealerId, "draft"),
    enabled: !!dealerId,
  });
  const detailQ = useQuery({
    queryKey: ["auto-po-draft", openDraft, dealerId],
    queryFn: () => autoPoService.getDraft(openDraft!, dealerId),
    enabled: !!openDraft && !!dealerId,
  });

  const genAllMut = useMutation({
    mutationFn: () => autoPoService.generateAll(dealerId),
    onSuccess: (r) => {
      toast({ title: r.created > 0 ? `Created ${r.created} draft PO(s)` : "All suppliers already have open drafts" });
      qc.invalidateQueries({ queryKey: ["auto-po-drafts"] });
      qc.invalidateQueries({ queryKey: ["auto-po-suggestions"] });
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const createOneMut = useMutation({
    mutationFn: (g: { supplier_id: string; items: AutoPoSuggestionItem[] }) =>
      autoPoService.createDraft({
        dealerId,
        supplier_id: g.supplier_id,
        source: "auto_low_stock",
        items: g.items.map((i) => ({
          product_id: i.product_id,
          suggested_qty: i.suggested_qty,
          suggested_rate: i.suggested_rate,
        })),
      }),
    onSuccess: () => {
      toast({ title: "Draft PO created" });
      qc.invalidateQueries({ queryKey: ["auto-po-drafts"] });
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const discardMut = useMutation({
    mutationFn: (id: string) => autoPoService.discard(id, dealerId),
    onSuccess: () => {
      toast({ title: "Draft discarded" });
      setOpenDraft(null);
      qc.invalidateQueries({ queryKey: ["auto-po-drafts"] });
    },
  });

  const approveMut = useMutation({
    mutationFn: async () => {
      const d = detailQ.data!;
      const items = d.items.map((it) => ({
        product_id: it.product_id,
        quantity: Number(editedQtys[it.id] ?? it.suggested_qty) || 0,
        purchase_rate: Number(editedRates[it.id] ?? it.suggested_rate) || 0,
        offer_price: 0, transport_cost: 0, labor_cost: 0, other_cost: 0,
      })).filter((x) => x.quantity > 0);
      if (!items.length) throw new Error("No items with quantity > 0");
      const today = new Date().toISOString().slice(0, 10);
      const result = await purchaseService.create({
        dealer_id: dealerId,
        supplier_id: d.supplier_id,
        invoice_number: "",
        purchase_date: today,
        notes: `From auto-PO draft #${d.id.slice(0, 8)}`,
        items,
      });
      const purchaseId = (result as any)?.id || (result as any)?.purchase?.id;
      if (purchaseId) await autoPoService.markConverted(d.id, dealerId, purchaseId);
      return purchaseId;
    },
    onSuccess: (purchaseId) => {
      toast({ title: "Purchase order created and approved" });
      setOpenDraft(null);
      qc.invalidateQueries({ queryKey: ["auto-po-drafts"] });
      qc.invalidateQueries({ queryKey: ["auto-po-suggestions"] });
      if (purchaseId) navigate(`/purchases`);
    },
    onError: (e: any) => toast({ title: "Approval failed", description: e.message, variant: "destructive" }),
  });

  const detailItems = detailQ.data?.items || [];
  const detailTotal = useMemo(() => {
    return detailItems.reduce((s, it) => {
      const q = Number(editedQtys[it.id] ?? it.suggested_qty) || 0;
      const r = Number(editedRates[it.id] ?? it.suggested_rate) || 0;
      return s + q * r;
    }, 0);
  }, [detailItems, editedQtys, editedRates]);

  return (
    <div className="container mx-auto p-4 space-y-4 max-w-7xl">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Sparkles className="h-6 w-6 text-amber-500" /> Auto-PO Draft</h1>
          <p className="text-sm text-muted-foreground">Generate draft purchase orders for low-stock items, grouped by last supplier.</p>
        </div>
        <Button onClick={() => genAllMut.mutate()} disabled={genAllMut.isPending} size="lg">
          {genAllMut.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
          Generate All Drafts
        </Button>
      </div>

      <Tabs defaultValue="suggestions">
        <TabsList>
          <TabsTrigger value="suggestions">
            Suggestions {sugQ.data && <Badge variant="secondary" className="ml-2">{sugQ.data.groups.length + (sugQ.data.unassigned.length > 0 ? 1 : 0)}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="drafts">
            Pending Drafts {draftsQ.data && <Badge variant="secondary" className="ml-2">{draftsQ.data.length}</Badge>}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="suggestions" className="space-y-3">
          {sugQ.isLoading && <p className="text-muted-foreground">Loading suggestions…</p>}
          {sugQ.data && sugQ.data.groups.length === 0 && sugQ.data.unassigned.length === 0 && (
            <Alert><CheckCircle2 className="h-4 w-4" /><AlertDescription>All stock levels are healthy. No reorder needed.</AlertDescription></Alert>
          )}
          {sugQ.data?.groups.map((g) => (
            <Card key={g.supplier_id}>
              <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Package className="h-4 w-4" /> {g.supplier_name || "(unnamed)"}
                  <Badge variant="outline">{g.items.length} items</Badge>
                </CardTitle>
                <Button size="sm" onClick={() => createOneMut.mutate({ supplier_id: g.supplier_id, items: g.items })} disabled={createOneMut.isPending}>
                  <ShoppingCart className="h-4 w-4 mr-2" /> Create Draft
                </Button>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead className="text-right">Reorder</TableHead>
                      <TableHead className="text-right">On Hand</TableHead>
                      <TableHead className="text-right">Suggested Qty</TableHead>
                      <TableHead className="text-right">Last Rate</TableHead>
                      <TableHead className="text-right">Est. Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {g.items.map((it) => (
                      <TableRow key={it.product_id}>
                        <TableCell>
                          <div className="font-medium">{it.name}</div>
                          <div className="text-xs text-muted-foreground">{it.sku} {it.brand && `• ${it.brand}`}</div>
                        </TableCell>
                        <TableCell className="text-right">{it.reorder_level}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant={it.on_hand <= 0 ? "destructive" : "secondary"}>{it.on_hand}</Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium">{it.suggested_qty} {it.unit_type === "piece" ? "pc" : "bx"}</TableCell>
                        <TableCell className="text-right">{formatCurrency(it.suggested_rate)}</TableCell>
                        <TableCell className="text-right font-semibold">{formatCurrency(it.suggested_qty * it.suggested_rate)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ))}
          {sugQ.data && sugQ.data.unassigned.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2 text-amber-600">
                  <AlertTriangle className="h-4 w-4" /> Low stock — no purchase history (assign supplier manually)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead className="text-right">Reorder</TableHead>
                      <TableHead className="text-right">On Hand</TableHead>
                      <TableHead className="text-right">Suggested Qty</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sugQ.data.unassigned.map((it) => (
                      <TableRow key={it.product_id}>
                        <TableCell>
                          <div className="font-medium">{it.name}</div>
                          <div className="text-xs text-muted-foreground">{it.sku}</div>
                        </TableCell>
                        <TableCell className="text-right">{it.reorder_level}</TableCell>
                        <TableCell className="text-right">{it.on_hand}</TableCell>
                        <TableCell className="text-right">{it.suggested_qty}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="drafts" className="space-y-3">
          {!openDraft ? (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Supplier</TableHead>
                      <TableHead className="text-right">Items</TableHead>
                      <TableHead className="text-right">Est. Total</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {draftsQ.data?.length === 0 && (
                      <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">No pending drafts</TableCell></TableRow>
                    )}
                    {draftsQ.data?.map((d) => (
                      <TableRow key={d.id} className="cursor-pointer" onClick={() => { setOpenDraft(d.id); setEditedQtys({}); setEditedRates({}); }}>
                        <TableCell className="font-medium">{d.supplier_name}</TableCell>
                        <TableCell className="text-right">{d.item_count}</TableCell>
                        <TableCell className="text-right">{formatCurrency(d.total_amount || 0)}</TableCell>
                        <TableCell>{new Date(d.created_at).toLocaleDateString()}</TableCell>
                        <TableCell><Badge variant="outline">{d.source === "auto_low_stock" ? "Auto" : "Manual"}</Badge></TableCell>
                        <TableCell><Button variant="ghost" size="sm">Review →</Button></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ) : detailQ.data ? (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2">
                <div>
                  <CardTitle>Draft PO — {detailQ.data.supplier_name}</CardTitle>
                  {detailQ.data.supplier_phone && <p className="text-sm text-muted-foreground">{detailQ.data.supplier_phone}</p>}
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setOpenDraft(null)}>Back</Button>
                  <Button variant="destructive" onClick={() => discardMut.mutate(detailQ.data!.id)} disabled={discardMut.isPending}>
                    <Trash2 className="h-4 w-4 mr-2" /> Discard
                  </Button>
                  <Button onClick={() => approveMut.mutate()} disabled={approveMut.isPending}>
                    {approveMut.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                    Approve & Create Purchase
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead className="text-right w-32">Quantity</TableHead>
                      <TableHead className="text-right w-32">Rate</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detailItems.map((it) => {
                      const q = Number(editedQtys[it.id] ?? it.suggested_qty) || 0;
                      const r = Number(editedRates[it.id] ?? it.suggested_rate) || 0;
                      return (
                        <TableRow key={it.id}>
                          <TableCell>
                            <div className="font-medium">{it.product_name}</div>
                            <div className="text-xs text-muted-foreground">{it.product_sku}</div>
                          </TableCell>
                          <TableCell className="text-right">
                            <Input type="number" inputMode="decimal" step="0.01"
                              className="h-8 text-right"
                              value={editedQtys[it.id] ?? String(it.suggested_qty)}
                              onChange={(e) => setEditedQtys((p) => ({ ...p, [it.id]: e.target.value }))} />
                          </TableCell>
                          <TableCell className="text-right">
                            <Input type="number" inputMode="decimal" step="0.01"
                              className="h-8 text-right"
                              value={editedRates[it.id] ?? String(it.suggested_rate)}
                              onChange={(e) => setEditedRates((p) => ({ ...p, [it.id]: e.target.value }))} />
                          </TableCell>
                          <TableCell className="text-right font-semibold">{formatCurrency(q * r)}</TableCell>
                        </TableRow>
                      );
                    })}
                    <TableRow>
                      <TableCell colSpan={3} className="text-right font-semibold">Total</TableCell>
                      <TableCell className="text-right text-lg font-bold">{formatCurrency(detailTotal)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ) : <p className="text-muted-foreground">Loading…</p>}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AutoPoDraftPage;
