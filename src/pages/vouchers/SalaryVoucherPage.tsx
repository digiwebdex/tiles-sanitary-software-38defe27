import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useDealerId } from "@/hooks/useDealerId";
import { phase3ReportService } from "@/services/phase3ReportService";
import { formatCurrency } from "@/lib/utils";
import { Printer } from "lucide-react";

const Row = ({ k, v, bold = false }: { k: string; v: React.ReactNode; bold?: boolean }) => (
  <div className={`flex justify-between border-b border-dashed py-1 ${bold ? "font-bold border-solid" : ""}`}>
    <span>{k}</span><span className="font-mono">{v}</span>
  </div>
);

const SalaryVoucherPage = () => {
  const dealerId = useDealerId();
  const { id } = useParams();
  const { data, isLoading } = useQuery({
    queryKey: ["salary-voucher", id, dealerId],
    queryFn: () => phase3ReportService.salaryVoucher(dealerId, id!),
    enabled: !!dealerId && !!id,
  });

  if (isLoading) return <div className="p-6">Loading…</div>;
  if (!data) return <div className="p-6">Not found</div>;

  return (
    <div className="container mx-auto p-6 max-w-2xl">
      <div className="flex justify-end mb-4 print:hidden">
        <Button onClick={() => window.print()}><Printer className="h-4 w-4 mr-2" /> Print</Button>
      </div>
      <div className="border-2 border-foreground p-6 space-y-4 bg-background">
        <div className="text-center border-b pb-3">
          <h1 className="text-xl font-bold">{data.dealer_name ?? "Salary Voucher"}</h1>
          <p className="text-xs text-muted-foreground">{data.dealer_address}</p>
          <p className="text-xs text-muted-foreground">{data.dealer_phone}</p>
          <h2 className="text-lg font-semibold mt-2">SALARY VOUCHER</h2>
        </div>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div><strong>Voucher No:</strong> SAL-{String(data.id).slice(0, 8)}</div>
          <div className="text-right"><strong>Date:</strong> {String(data.payment_date).slice(0, 10)}</div>
          <div><strong>Employee:</strong> {data.employee_name}</div>
          <div className="text-right"><strong>Period:</strong> {data.period}</div>
          <div><strong>Designation:</strong> {data.designation ?? "—"}</div>
          <div className="text-right"><strong>Code:</strong> {data.employee_code ?? "—"}</div>
        </div>
        <div className="text-sm space-y-1 pt-2">
          <Row k="Basic" v={formatCurrency(data.basic)} />
          <Row k="House Rent" v={formatCurrency(data.house_rent)} />
          <Row k="Medical" v={formatCurrency(data.medical)} />
          <Row k="Transport" v={formatCurrency(data.transport)} />
          <Row k="Other Allowance" v={formatCurrency(data.other_allowance)} />
          <Row k="(−) Deduction" v={`(${formatCurrency(data.deduction)})`} />
          <Row k="Net Payable" v={formatCurrency(data.net_payable)} bold />
        </div>
        <div className="text-sm pt-2">
          <p><strong>Payment Method:</strong> <span className="capitalize">{data.payment_method}</span>{data.bank_name ? ` — ${data.bank_name} (${data.account_number})` : ""}</p>
          {data.notes && <p><strong>Notes:</strong> {data.notes}</p>}
        </div>
        <div className="grid grid-cols-3 gap-8 pt-12 text-center text-xs">
          <div className="border-t pt-1">Prepared By</div>
          <div className="border-t pt-1">Approved By</div>
          <div className="border-t pt-1">Received By</div>
        </div>
      </div>
    </div>
  );
};

export default SalaryVoucherPage;
