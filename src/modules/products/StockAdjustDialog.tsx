import { useState, useEffect, useMemo } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { stockService } from "@/services/stockService";
import { logAudit } from "@/services/auditService";
import { useAuth } from "@/contexts/AuthContext";
import {
  getApprovalSettings, isApprovalRequired, createApprovalRequest,
  findValidApproval, consumeApprovalRequest, generateActionHash,
  type ApprovalContextData,
} from "@/services/approvalService";
import { ApprovalRequestDialog } from "@/components/approval/ApprovalRequestDialog";
import { toTotalPieces, formatBoxPiece } from "@/lib/units";

interface StockAdjustDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: {
    id: string;
    name: string;
    sku: string;
    unit_type: string;
    pieces_per_box?: number | null;
    per_box_sft?: number | null;
  } | null;
  dealerId: string;
  onSuccess: () => void;
}

const StockAdjustDialog = ({ open, onOpenChange, product, dealerId, onSuccess }: StockAdjustDialogProps) => {
  const { user, isDealerAdmin } = useAuth();
  const [boxQty, setBoxQty] = useState("");
  const [pieceQty, setPieceQty] = useState("");
  const [adjustType, setAdjustType] = useState<"add" | "deduct">("add");
  const [reason, setReason] = useState("");
  const [approvalDialogOpen, setApprovalDialogOpen] = useState(false);
  const [approvalContext, setApprovalContext] = useState<ApprovalContextData>({});
  const [settings, setSettings] = useState<Awaited<ReturnType<typeof getApprovalSettings>> | null>(null);

  useEffect(() => {
    if (open && dealerId) {
      getApprovalSettings(dealerId).then(setSettings).catch(() => {});
    }
    if (!open) {
      setBoxQty(""); setPieceQty(""); setReason(""); setAdjustType("add");
    }
  }, [open, dealerId]);

  const ppb = Math.max(1, Number(product?.pieces_per_box ?? 1) || 1);
  const isTile = product?.unit_type === "box_sft";
  const perBoxSft = Number(product?.per_box_sft ?? 0) || 0;

  const totalPieces = useMemo(
    () => toTotalPieces({ box: Number(boxQty) || 0, piece: Number(pieceQty) || 0 }, ppb),
    [boxQty, pieceQty, ppb]
  );
  const sftPreview = isTile && perBoxSft > 0
    ? ((Number(boxQty) || 0) + (Number(pieceQty) || 0) / ppb) * perBoxSft
    : 0;

  const performAdjust = async () => {
    await stockService.adjustStockBoxPiece(product!.id, adjustType, dealerId, {
      box_qty: isTile ? Number(boxQty) || 0 : 0,
      piece_qty: Number(pieceQty) || 0,
      reason: reason.trim(),
    });
    await logAudit({
      dealer_id: dealerId,
      action: `stock_manual_${adjustType}`,
      table_name: "stock",
      record_id: product!.id,
      new_data: {
        box_qty: isTile ? Number(boxQty) || 0 : 0,
        piece_qty: Number(pieceQty) || 0,
        total_pieces: totalPieces,
        type: adjustType,
        reason: reason.trim(),
      },
    });
  };

  const mutation = useMutation({
    mutationFn: async () => {
      if (totalPieces <= 0) throw new Error("Quantity must be > 0");
      if (!reason.trim()) throw new Error("Reason is required");
      if (!product) throw new Error("No product selected");

      if (settings && isApprovalRequired(settings, "stock_adjustment")) {
        const ctx: ApprovalContextData = {
          product_name: product.name,
          adjustment_type: adjustType,
          adjustment_qty: totalPieces,
          adjustment_display: formatBoxPiece(totalPieces, ppb),
        };
        const existing = await findValidApproval(dealerId, "stock_adjustment", ctx);
        if (existing) {
          const hash = await generateActionHash("stock_adjustment", ctx);
          await consumeApprovalRequest(existing.id, hash);
        } else if (isDealerAdmin && settings.auto_approve_for_admins) {
          await createApprovalRequest({
            dealerId, approvalType: "stock_adjustment",
            sourceType: "stock_adjustment", requestedBy: user!.id,
            reason: reason.trim(), context: ctx, isAdmin: true,
            autoApproveForAdmins: true,
            expiryHours: settings.approval_expiry_hours,
          });
        } else {
          setApprovalContext(ctx);
          setApprovalDialogOpen(true);
          throw new Error("__APPROVAL_PENDING__");
        }
      }

      await performAdjust();
    },
    onSuccess: () => {
      toast.success(`Stock ${adjustType === "add" ? "added" : "deducted"} successfully`);
      setBoxQty(""); setPieceQty(""); setReason(""); setAdjustType("add");
      onSuccess();
    },
    onError: (e: any) => {
      if (e.message !== "__APPROVAL_PENDING__") toast.error(e.message);
    },
  });

  const handleApprovalRequest = async (note: string) => {
    try {
      await createApprovalRequest({
        dealerId, approvalType: "stock_adjustment",
        sourceType: "stock_adjustment", requestedBy: user!.id,
        reason: note || reason.trim(), context: approvalContext, isAdmin: false,
        expiryHours: settings?.approval_expiry_hours,
      });
      toast.success("Approval request submitted. Wait for manager approval.");
      setApprovalDialogOpen(false);
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  if (!product) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Adjust Stock</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              <strong>{product.sku}</strong> — {product.name}
            </p>
            <div>
              <Label>Adjustment Type *</Label>
              <Select value={adjustType} onValueChange={(v) => setAdjustType(v as "add" | "deduct")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="add">Add Stock</SelectItem>
                  <SelectItem value="deduct">Deduct Stock</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {isTile ? (
              <div className="space-y-2">
                <Label>Quantity *</Label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Input
                      type="number" min="0" step="1"
                      value={boxQty}
                      onChange={(e) => setBoxQty(e.target.value)}
                      placeholder="Box"
                    />
                    <p className="mt-1 text-[11px] text-muted-foreground">Box</p>
                  </div>
                  <div>
                    <Input
                      type="number" min="0" step="1"
                      value={pieceQty}
                      onChange={(e) => setPieceQty(e.target.value)}
                      placeholder="Pc"
                    />
                    <p className="mt-1 text-[11px] text-muted-foreground">Pc (ppb {ppb})</p>
                  </div>
                </div>
                {totalPieces > 0 && (
                  <p className="text-xs text-muted-foreground">
                    = {formatBoxPiece(totalPieces, ppb)} ({totalPieces} pcs)
                    {perBoxSft > 0 && ` ≈ ${sftPreview.toFixed(2)} SFT`}
                  </p>
                )}
              </div>
            ) : (
              <div>
                <Label>Quantity (Pieces) *</Label>
                <Input
                  type="number" step="1" min="0"
                  value={pieceQty}
                  onChange={(e) => setPieceQty(e.target.value)}
                  placeholder="Enter pieces"
                />
              </div>
            )}

            <div>
              <Label>Reason *</Label>
              <Textarea value={reason} onChange={(e) => setReason(e.target.value)}
                placeholder="Physical count correction, damaged goods…" rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={() => mutation.mutate()}
              disabled={mutation.isPending || totalPieces <= 0 || !reason.trim()}>
              {mutation.isPending ? "Processing…" : adjustType === "add" ? "Add Stock" : "Deduct Stock"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ApprovalRequestDialog
        open={approvalDialogOpen}
        onClose={() => setApprovalDialogOpen(false)}
        onRequestApproval={handleApprovalRequest}
        approvalType="stock_adjustment"
        context={approvalContext}
      />
    </>
  );
};

export default StockAdjustDialog;
