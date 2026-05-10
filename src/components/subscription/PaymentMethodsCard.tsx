import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Phone, Building2 } from "lucide-react";

/**
 * Payment Methods card for dealer admins — shows mobile banking + bank
 * transfer details for paying their subscription invoice.
 */
export function PaymentMethodsCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">পেমেন্ট মাধ্যম / Payment Methods</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Mobile Banking */}
          <div className="rounded-xl border border-border bg-muted/30 p-5">
            <div className="flex items-center gap-2 mb-4">
              <Phone className="h-5 w-5 text-primary" />
              <h4 className="font-bold text-base">মোবাইল ব্যাংকিং (Mobile Banking)</h4>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between bg-background/60 rounded-lg px-4 py-3 border border-border/50">
                <div>
                  <p className="font-semibold text-pink-500 dark:text-pink-400">bKash / Nagad (Personal)</p>
                  <p className="text-muted-foreground text-xs mt-0.5">Send Money</p>
                </div>
                <span className="font-mono font-bold text-base tracking-wide">01674533303</span>
              </div>
              <div className="flex items-center justify-between bg-background/60 rounded-lg px-4 py-3 border border-border/50">
                <div>
                  <p className="font-semibold text-purple-500 dark:text-purple-400">Rocket</p>
                  <p className="text-muted-foreground text-xs mt-0.5">Send Money</p>
                </div>
                <span className="font-mono font-bold text-base tracking-wide">
                  01674533303<span className="text-primary">3</span>
                </span>
              </div>
            </div>
          </div>

          {/* Bank Transfer */}
          <div className="rounded-xl border border-border bg-muted/30 p-5">
            <div className="flex items-center gap-2 mb-4">
              <Building2 className="h-5 w-5 text-primary" />
              <h4 className="font-bold text-base">ব্যাংক ট্রান্সফার (Bank Transfer)</h4>
            </div>
            <div className="bg-background/60 rounded-lg px-4 py-3 space-y-2 text-sm border border-border/50">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Account Name</span>
                <span className="font-semibold">Md. Iqbal Hossain</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Account Type</span>
                <span>Savings Account</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">A/C No.</span>
                <span className="font-mono font-bold">2706101077904</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Routing No.</span>
                <span className="font-mono">175260162</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Bank</span>
                <span className="font-semibold">Pubali Bank Limited</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Branch</span>
                <span className="text-right text-xs">Asad Avenue, Mohammadpur, Dhaka-1207</span>
              </div>
            </div>
          </div>
        </div>
        <p className="text-center text-xs text-muted-foreground mt-4">
          পেমেন্ট করার পর অবশ্যই Transaction ID সহ আমাদের জানান
        </p>
      </CardContent>
    </Card>
  );
}

export default PaymentMethodsCard;
