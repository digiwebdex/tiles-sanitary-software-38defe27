/**
 * Super Admin → Create Dealer dialog.
 *
 * Calls POST /api/dealers to atomically create a dealer + dealer_admin user
 * (+ optional subscription plan). Used from the All Dealers page.
 */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus } from "lucide-react";
import { vpsAuthedFetch } from "@/lib/vpsAuthClient";

interface Plan {
  id: string;
  name: string;
  price_monthly: number | null;
  duration_days: number | null;
}

async function vpsJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await vpsAuthedFetch(path, init);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error || `Request failed (${res.status})`);
  return body as T;
}

const initialState = {
  name: "",
  phone: "",
  address: "",
  adminName: "",
  adminEmail: "",
  adminPassword: "",
  planId: "none",
};

export default function CreateDealerDialog() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(initialState);

  const { data: plansData } = useQuery({
    queryKey: ["vps-plans"],
    queryFn: () => vpsJson<{ plans: Plan[] }>("/api/plans"),
    enabled: open,
  });
  const plans = plansData?.plans ?? [];

  const set = (k: keyof typeof initialState) => (v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  const create = useMutation({
    mutationFn: async () => {
      const payload: any = {
        name: form.name.trim(),
        phone: form.phone.trim() || undefined,
        address: form.address.trim() || undefined,
        admin: {
          name: form.adminName.trim(),
          email: form.adminEmail.trim(),
          password: form.adminPassword,
        },
      };
      if (form.planId && form.planId !== "none") {
        payload.subscription = { plan_id: form.planId };
      }
      return vpsJson<{ dealer: { id: string; name: string } }>("/api/dealers", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },
    onSuccess: (res) => {
      toast({
        title: "Dealer created",
        description: `${res.dealer.name} can sign in with ${form.adminEmail}.`,
      });
      qc.invalidateQueries({ queryKey: ["vps-dealers"] });
      setForm(initialState);
      setOpen(false);
    },
    onError: (e: Error) => {
      toast({ variant: "destructive", title: "Create failed", description: e.message });
    },
  });

  const canSubmit =
    form.name.trim().length > 0 &&
    form.adminName.trim().length > 0 &&
    form.adminEmail.trim().length > 0 &&
    form.adminPassword.length >= 6 &&
    !create.isPending;

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setForm(initialState); }}>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4 mr-2" /> Create Dealer
      </Button>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create new dealer</DialogTitle>
          <DialogDescription>
            Creates an active dealer account with a primary admin login. Optionally
            assign a subscription plan.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="biz-name">Business name *</Label>
            <Input id="biz-name" value={form.name} onChange={(e) => set("name")(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="biz-phone">Phone</Label>
              <Input id="biz-phone" value={form.phone} onChange={(e) => set("phone")(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="biz-address">Address</Label>
              <Input id="biz-address" value={form.address} onChange={(e) => set("address")(e.target.value)} />
            </div>
          </div>

          <div className="border-t pt-3 space-y-3">
            <div className="text-sm font-medium">Primary admin (login)</div>
            <div className="space-y-2">
              <Label htmlFor="adm-name">Admin name *</Label>
              <Input id="adm-name" value={form.adminName} onChange={(e) => set("adminName")(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="adm-email">Admin email *</Label>
              <Input id="adm-email" type="email" autoComplete="off"
                value={form.adminEmail} onChange={(e) => set("adminEmail")(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="adm-pass">Password * (min 6 chars)</Label>
              <Input id="adm-pass" type="text" autoComplete="new-password"
                value={form.adminPassword} onChange={(e) => set("adminPassword")(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Subscription plan (optional)</Label>
            <Select value={form.planId} onValueChange={set("planId")}>
              <SelectTrigger><SelectValue placeholder="No plan" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No plan</SelectItem>
                {plans.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}{p.price_monthly ? ` — ৳${p.price_monthly}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={create.isPending}>
            Cancel
          </Button>
          <Button onClick={() => create.mutate()} disabled={!canSubmit}>
            {create.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Create dealer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
