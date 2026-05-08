import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";
import {
  requestPlanUpgrade,
  type PlanOption,
} from "@/services/dealerSubscriptionService";

interface Props {
  plan: PlanOption | null;
  onClose: () => void;
  onSubmitted: () => void;
}

const UpgradeRequestDialog = ({ plan, onClose, onSubmitted }: Props) => {
  const { toast } = useToast();
  const [cycle, setCycle] = useState<"monthly" | "yearly">("monthly");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const open = !!plan;
  const amount =
    plan && cycle === "yearly"
      ? Number(plan.price_yearly)
      : Number(plan?.price_monthly ?? 0);

  const handleSubmit = async () => {
    if (!plan) return;
    setSubmitting(true);
    try {
      await requestPlanUpgrade({ plan_id: plan.id, billing_cycle: cycle, note });
      toast({
        title: "Request submitted",
        description: "Our team will contact you shortly to confirm payment.",
      });
      setNote("");
      setCycle("monthly");
      onSubmitted();
    } catch (err: any) {
      toast({
        title: "Could not submit request",
        description: err?.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Request {plan?.name} Plan</DialogTitle>
          <DialogDescription>
            Submit a request and our team will contact you to complete payment.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Billing Cycle</Label>
            <Select value={cycle} onValueChange={(v) => setCycle(v as any)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">
                  Monthly — {formatCurrency(Number(plan?.price_monthly ?? 0))}
                </SelectItem>
                <SelectItem value="yearly">
                  Yearly — {formatCurrency(Number(plan?.price_yearly ?? 0))}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-md border bg-muted/40 p-3 text-sm flex items-center justify-between">
            <span className="text-muted-foreground">Amount</span>
            <span className="font-semibold">{formatCurrency(amount)}</span>
          </div>

          <div className="space-y-2">
            <Label>Note (optional)</Label>
            <Textarea
              placeholder="Any preferences or questions…"
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, 500))}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Submitting…" : "Submit Request"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default UpgradeRequestDialog;
