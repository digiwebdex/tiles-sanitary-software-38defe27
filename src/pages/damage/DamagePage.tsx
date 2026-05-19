/**
 * P2 — Damage / Broken Stock Page.
 *
 * One-stop screen for dealer_admin to:
 *   - Mark inventory as broken/damaged (deducts stock atomically via VPS)
 *   - Review a chronological list of past damage entries with reason + qty.
 *
 * Backed by:
 *   POST /api/adjustments/broken  (BrokenStockDialog)
 *   GET  /api/adjustments/broken  (stockService.listDamages)
 */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Search, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import BrokenStockDialog from "@/modules/products/BrokenStockDialog";
import { productService } from "@/services/productService";
import { stockService, type DamageEntry } from "@/services/stockService";
import { useDealerId } from "@/hooks/useDealerId";
import { formatBoxPiece } from "@/lib/units";
import { format } from "date-fns";

export default function DamagePage() {
  const dealerId = useDealerId();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<any | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const damagesQ = useQuery({
    queryKey: ["damages", dealerId],
    queryFn: () => stockService.listDamages(dealerId, { limit: 200 }),
  });

  const productsQ = useQuery({
    queryKey: ["damage-product-picker", dealerId, search],
    queryFn: () => productService.list(dealerId, search, 1),
    enabled: pickerOpen,
  });

  const totals = useMemo(() => {
    const rows = damagesQ.data ?? [];
    return {
      count: rows.length,
      pieces: rows.reduce((s, r) => s + Math.abs(Number(r.total_pieces_delta) || 0), 0),
    };
  }, [damagesQ.data]);

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <AlertTriangle className="h-6 w-6 text-destructive" />
            Damage / Broken Stock
          </h1>
          <p className="text-sm text-muted-foreground">
            Record damaged inventory. Stock is deducted immediately and logged for audit.
          </p>
        </div>
        <Button onClick={() => setPickerOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" /> New Damage Entry
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Entries</CardTitle></CardHeader>
          <CardContent className="text-2xl font-bold">{totals.count}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Total Pieces Damaged</CardTitle></CardHeader>
          <CardContent className="text-2xl font-bold">{totals.pieces.toLocaleString()}</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Recent Damage Entries</CardTitle></CardHeader>
        <CardContent>
          {damagesQ.isLoading ? (
            <div className="text-sm text-muted-foreground py-6 text-center">Loading…</div>
          ) : !damagesQ.data?.length ? (
            <div className="text-sm text-muted-foreground py-8 text-center">
              No damage entries yet. Click <strong>New Damage Entry</strong> to record one.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead className="text-right">Quantity Damaged</TableHead>
                  <TableHead>Reason</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {damagesQ.data.map((r: DamageEntry) => (
                  <DamageRow key={r.id} row={r} />
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Product picker */}
      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Select Product</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                autoFocus
                placeholder="Search by name or SKU…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>
            <div className="max-h-80 overflow-y-auto border rounded-md">
              {productsQ.isLoading ? (
                <div className="p-4 text-sm text-muted-foreground">Loading…</div>
              ) : !productsQ.data?.data?.length ? (
                <div className="p-4 text-sm text-muted-foreground">No products found.</div>
              ) : (
                productsQ.data.data.map((p: any) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      setSelected(p);
                      setPickerOpen(false);
                      setDialogOpen(true);
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-accent border-b last:border-b-0 flex items-center justify-between gap-2"
                  >
                    <div>
                      <div className="font-medium">{p.name}</div>
                      <div className="text-xs text-muted-foreground">{p.sku}</div>
                    </div>
                    <Badge variant="outline">{p.unit_type === "box_sft" ? "Tile" : "Piece"}</Badge>
                  </button>
                ))
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <BrokenStockDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        product={selected}
        dealerId={dealerId}
        onSuccess={() => {
          setDialogOpen(false);
          setSelected(null);
          damagesQ.refetch();
        }}
      />
    </div>
  );
}

function DamageRow({ row }: { row: DamageEntry }) {
  const ppb = Math.max(1, Number(row.pieces_per_box ?? 1) || 1);
  const pieces = Math.abs(Number(row.total_pieces_delta) || 0);
  const display = row.unit_type === "box_sft"
    ? formatBoxPiece(pieces, ppb)
    : `${pieces} pc`;
  return (
    <TableRow>
      <TableCell className="whitespace-nowrap text-sm">
        {format(new Date(row.created_at), "dd MMM yyyy, HH:mm")}
      </TableCell>
      <TableCell className="font-medium">{row.product_name}</TableCell>
      <TableCell className="text-sm text-muted-foreground">{row.sku}</TableCell>
      <TableCell className="text-right font-mono text-destructive">−{display}</TableCell>
      <TableCell className="text-sm">{row.reason || <span className="text-muted-foreground">—</span>}</TableCell>
    </TableRow>
  );
}
