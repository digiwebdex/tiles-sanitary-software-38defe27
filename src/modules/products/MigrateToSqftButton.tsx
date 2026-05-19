import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ArrowRightLeft, Loader2 } from "lucide-react";
import { vpsAuthedFetch } from "@/lib/vpsAuthClient";
import { toast } from "sonner";

interface MigrateToSqftButtonProps {
  productId: string;
  dealerId: string;
  productName?: string;
  /** Called after successful real (non-dry) migration so the parent can refetch. */
  onMigrated?: () => void;
  disabled?: boolean;
}

interface MigrationResult {
  ok: boolean;
  dry_run: boolean;
  before?: {
    stock_base_unit: string;
    active_batches: number;
    computed_total_sqft: number;
    stock_qty_sqft: number;
  };
  after?: {
    stock_base_unit: string;
    active_batches: number;
    computed_total_sqft: number;
    stock_qty_sqft: number;
  };
  errors?: string[];
}

/**
 * Phase T5 — Per-product cutover from `piece` base unit → `sqft` base unit.
 * Always runs a dry-run first; user must explicitly confirm the commit.
 */
const MigrateToSqftButton = ({
  productId,
  dealerId,
  productName,
  onMigrated,
  disabled,
}: MigrateToSqftButtonProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<MigrationResult | null>(null);

  async function callApi(dryRun: boolean): Promise<MigrationResult | null> {
    const res = await vpsAuthedFetch(`/api/products/${productId}/migrate-to-sqft`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dealerId, dryRun }),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      toast.error(body?.error || "Migration request failed");
      return null;
    }
    return body as MigrationResult;
  }

  async function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next && !preview) {
      setLoading(true);
      const r = await callApi(true);
      setLoading(false);
      setPreview(r);
    }
    if (!next) {
      // reset so re-open re-fetches a fresh dry-run
      setPreview(null);
    }
  }

  async function handleConfirm() {
    setLoading(true);
    const r = await callApi(false);
    setLoading(false);
    if (r?.ok) {
      toast.success("Product is now SQFT-based.");
      onMigrated?.();
      setOpen(false);
    } else if (r?.errors?.length) {
      toast.error(r.errors.join("; "));
    }
  }

  const blocked = preview && !preview.ok;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm" disabled={disabled}>
          <ArrowRightLeft className="mr-2 h-4 w-4" />
          Convert to SQFT base
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Convert stock base to SQFT</DialogTitle>
          <DialogDescription>
            {productName ? <span className="font-medium">{productName} — </span> : null}
            Backfills every active batch's <code>qty_sqft_remaining</code>, syncs stock total,
            and flips the product's base unit. This is reversible (resetting the flag back
            to <code>piece</code> leaves legacy columns intact).
          </DialogDescription>
        </DialogHeader>

        {loading && !preview && (
          <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Computing dry-run…
          </div>
        )}

        {preview?.errors && preview.errors.length > 0 && (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm">
            <p className="mb-1 font-medium text-destructive">Cannot migrate:</p>
            <ul className="list-inside list-disc text-destructive">
              {preview.errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </div>
        )}

        {preview?.before && preview?.after && (
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-md border bg-muted/30 p-3">
              <p className="mb-1 text-[11px] uppercase text-muted-foreground">Before</p>
              <p>Base: <span className="font-semibold">{preview.before.stock_base_unit}</span></p>
              <p>Batches: {preview.before.active_batches}</p>
              <p>Stock SQFT: {preview.before.stock_qty_sqft}</p>
            </div>
            <div className="rounded-md border bg-primary/10 p-3">
              <p className="mb-1 text-[11px] uppercase text-muted-foreground">After</p>
              <p>Base: <span className="font-semibold">{preview.after.stock_base_unit}</span></p>
              <p>Batches: {preview.after.active_batches}</p>
              <p>Stock SQFT: {preview.after.stock_qty_sqft}</p>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={loading || !!blocked || !preview}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Confirm cutover
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default MigrateToSqftButton;
