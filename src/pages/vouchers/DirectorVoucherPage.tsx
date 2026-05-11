import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useDealerId } from "@/hooks/useDealerId";
import { phase3ReportService } from "@/services/phase3ReportService";
import { formatCurrency } from "@/lib/utils";
import { Printer } from "lucide-react";

const DirectorVoucherPage = () => {
  const dealerId = useDealerId();
  const { id } = useParams();
  const { data, isLoading } = useQuery({
    queryKey: ["director-voucher", id, dealerId],
    queryFn: () => phase3ReportService.directorVoucher(dealerId, id!),
    enabled: !!dealerId && !!id,
  });

  if (isLoading) return <div className="p-6">Loading…</div>;
  if (!data) return <div className="p-6">Not found</div>;

  const isInflow = data.type === "deposit";

  return (
    <div className="container mx-auto p-6 max-w-2xl">
      <div className="flex justify-end mb-4 print:hidden">
        <Button onClick={() => window.print()}><Printer className="h-4 w-4 mr-2" /> Print</Button>
      </div>
      <div className="border-2 border-foreground p-6 space-y-4 bg-background">
        <div className="text-center border-b pb-3">
          <h1 className="text-xl font-bold">{data.dealer_name ?? "Director Voucher"}</h1>
          <p className="text-xs text-muted-foreground">{data.dealer_address}</p>
          <p className="text-xs text-muted-foreground">{data.dealer_phone}</p>
          <h2 className="text-lg font-semibold mt-2">{isInflow ? "RECEIPT" : "PAYMENT"} VOUCHER — DIRECTOR</h2>
        </div>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div><strong>Voucher No:</strong> DIR-{String(data.id).slice(0, 8)}</div>
          <div className="text-right"><strong>Date:</strong> {String(data.entry_date).slice(0, 10)}</div>
          <div><strong>Director:</strong> {data.director_name}</div>
          <div className="text-right"><strong>Role:</strong> {data.director_role ?? "—"}</div>
          <div><strong>Type:</strong> <span className="uppercase">{data.type}</span></div>
          <div className="text-right"><strong>Share %:</strong> {data.share_pct ?? 0}%</div>
        </div>
        <div className="border-t border-b py-4 text-center">
          <div className="text-xs text-muted-foreground uppercase">Amount</div>
          <div className={`text-3xl font-bold font-mono ${isInflow ? "text-emerald-500" : "text-red-500"}`}>
            {isInflow ? "+" : "−"}{formatCurrency(data.amount)}
          </div>
        </div>
        <div className="text-sm space-y-1">
          <p><strong>Payment Method:</strong> <span className="capitalize">{data.payment_method}</span>{data.bank_name ? ` — ${data.bank_name} (${data.account_number})` : ""}</p>
          {data.description && <p><strong>Description:</strong> {data.description}</p>}
        </div>
        <div className="grid grid-cols-3 gap-8 pt-12 text-center text-xs">
          <div className="border-t pt-1">Prepared By</div>
          <div className="border-t pt-1">Approved By</div>
          <div className="border-t pt-1">{isInflow ? "Received By" : "Paid To"}</div>
        </div>
      </div>
    </div>
  );
};

export default DirectorVoucherPage;
