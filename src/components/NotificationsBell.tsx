import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Bell, ShieldAlert, Package, AlertTriangle, CheckCircle2 } from "lucide-react";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { listPendingApprovals } from "@/services/approvalService";
import { dashboardService } from "@/services/dashboardService";
import { useAuth } from "@/contexts/AuthContext";

export function NotificationsBell() {
  const navigate = useNavigate();
  const { profile, isDealerAdmin } = useAuth();
  const dealerId = profile?.dealer_id ?? "";

  const approvalsQ = useQuery({
    queryKey: ["bell-approvals", dealerId],
    queryFn: () => listPendingApprovals(dealerId),
    enabled: !!dealerId && isDealerAdmin,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const dashQ = useQuery({
    queryKey: ["bell-dashboard", dealerId],
    queryFn: () => dashboardService.getData(dealerId),
    enabled: !!dealerId,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const approvalsCount = isDealerAdmin ? (approvalsQ.data?.length ?? 0) : 0;
  const lowStock = dashQ.data?.lowStockItems ?? [];
  const overdueCount = dashQ.data?.overdueCustomerCount ?? 0;
  const creditExceeded = dashQ.data?.creditExceededCount ?? 0;

  const total = approvalsCount + (lowStock.length > 0 ? 1 : 0) + (overdueCount > 0 ? 1 : 0) + (creditExceeded > 0 ? 1 : 0);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
          <Bell className="h-5 w-5" />
          {total > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
              {total > 9 ? "9+" : total}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="border-b px-3 py-2 flex items-center justify-between">
          <span className="text-sm font-semibold">Notifications</span>
          <Badge variant="outline" className="text-[10px]">{total} new</Badge>
        </div>
        <ScrollArea className="max-h-96">
          <div className="divide-y">
            {total === 0 && (
              <div className="px-3 py-6 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
                <CheckCircle2 className="h-6 w-6 text-emerald-500" />
                You're all caught up
              </div>
            )}

            {approvalsCount > 0 && (
              <button
                onClick={() => navigate("/approvals")}
                className="flex w-full items-start gap-3 px-3 py-3 text-left hover:bg-accent"
              >
                <ShieldAlert className="h-4 w-4 text-amber-500 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">{approvalsCount} pending approval{approvalsCount > 1 ? "s" : ""}</div>
                  <div className="text-xs text-muted-foreground">Review and approve in the Approvals inbox</div>
                </div>
              </button>
            )}

            {lowStock.length > 0 && (
              <button
                onClick={() => navigate("/products")}
                className="flex w-full items-start gap-3 px-3 py-3 text-left hover:bg-accent"
              >
                <Package className="h-4 w-4 text-orange-500 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">{lowStock.length} item{lowStock.length > 1 ? "s" : ""} low on stock</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {lowStock.slice(0, 2).map((i: any) => i.name).join(", ")}
                    {lowStock.length > 2 && ` +${lowStock.length - 2} more`}
                  </div>
                </div>
              </button>
            )}

            {overdueCount > 0 && (
              <button
                onClick={() => navigate("/reports/credit")}
                className="flex w-full items-start gap-3 px-3 py-3 text-left hover:bg-accent"
              >
                <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">{overdueCount} overdue customer{overdueCount > 1 ? "s" : ""}</div>
                  <div className="text-xs text-muted-foreground">Send a payment reminder</div>
                </div>
              </button>
            )}

            {creditExceeded > 0 && (
              <button
                onClick={() => navigate("/reports/credit")}
                className="flex w-full items-start gap-3 px-3 py-3 text-left hover:bg-accent"
              >
                <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">{creditExceeded} customer{creditExceeded > 1 ? "s" : ""} over credit limit</div>
                  <div className="text-xs text-muted-foreground">Review credit status</div>
                </div>
              </button>
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
