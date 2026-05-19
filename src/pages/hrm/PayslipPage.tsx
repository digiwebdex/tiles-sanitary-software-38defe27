import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useDealerId } from "@/hooks/useDealerId";
import { useDealerInfo } from "@/hooks/useDealerInfo";
import { employeeService } from "@/services/employeeService";
import { formatCurrency } from "@/lib/utils";
import { ArrowLeft, Printer } from "lucide-react";

interface SnapshotLine {
  component_id: string;
  code: string;
  name: string;
  kind: "allowance" | "deduction";
  amount: number;
}

const Row = ({ label, value, bold }: { label: string; value: string; bold?: boolean }) => (
  <div className={`flex justify-between py-1.5 text-sm ${bold ? "font-semibold" : ""}`}>
    <span>{label}</span>
    <span>{value}</span>
  </div>
);

const PayslipPage = () => {
  const { id } = useParams<{ id: string }>();
  const dealerId = useDealerId();
  const { data: dealer } = useDealerInfo();
  const { data: p, isLoading, error } = useQuery({
    queryKey: ["salary-payment", id, dealerId],
    queryFn: () => employeeService.paymentById(id!, dealerId),
    enabled: !!id && !!dealerId,
  });

  if (isLoading) return <div className="p-6 text-muted-foreground">Loading payslip…</div>;
  if (error || !p) return <div className="p-6 text-destructive">Payslip not found</div>;

  const snapshot: SnapshotLine[] = Array.isArray(p.components_snapshot)
    ? p.components_snapshot
    : (typeof p.components_snapshot === "string" ? JSON.parse(p.components_snapshot || "[]") : []);
  const extraAllow = snapshot.filter((l) => l.kind === "allowance");
  const extraDed = snapshot.filter((l) => l.kind === "deduction");

  const gross =
    Number(p.basic) + Number(p.house_rent) + Number(p.medical) +
    Number(p.transport) + Number(p.other_allowance) + Number(p.components_allowance || 0);

  return (
    <div className="min-h-screen bg-muted/30 print:bg-white">
      <div className="mx-auto max-w-3xl p-4 sm:p-6 space-y-4">
        <div className="flex items-center justify-between print:hidden">
          <Button asChild variant="ghost" size="sm">
            <Link to="/hrm"><ArrowLeft className="mr-2 h-4 w-4" />Back</Link>
          </Button>
          <Button size="sm" onClick={() => window.print()}>
            <Printer className="mr-2 h-4 w-4" />Print
          </Button>
        </div>

        <Card className="print:shadow-none print:border-0">
          <CardContent className="p-6 space-y-4">
            <div className="text-center space-y-1">
              <h1 className="text-2xl font-bold">{dealer?.name ?? "Salary Slip"}</h1>
              {dealer?.address && <p className="text-xs text-muted-foreground">{dealer.address}</p>}
              <h2 className="text-lg font-semibold pt-2">Payslip — {p.period}</h2>
            </div>

            <Separator />

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-muted-foreground">Employee:</span> <strong>{p.employee_name}</strong></div>
              <div><span className="text-muted-foreground">Code:</span> {p.employee_code ?? "—"}</div>
              <div><span className="text-muted-foreground">Designation:</span> {p.designation ?? "—"}</div>
              <div><span className="text-muted-foreground">Department:</span> {p.department ?? "—"}</div>
              <div><span className="text-muted-foreground">Payment Date:</span> {new Date(p.payment_date).toLocaleDateString()}</div>
              <div>
                <span className="text-muted-foreground">Method:</span>{" "}
                {p.payment_method === "bank"
                  ? `Bank — ${p.bank_name ?? ""} ${p.bank_account_name ?? ""}`.trim()
                  : "Cash"}
              </div>
            </div>

            <Separator />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-semibold mb-2 text-primary">Earnings</h3>
                <Row label="Basic" value={formatCurrency(Number(p.basic))} />
                {Number(p.house_rent) > 0 && <Row label="House Rent" value={formatCurrency(Number(p.house_rent))} />}
                {Number(p.medical) > 0 && <Row label="Medical" value={formatCurrency(Number(p.medical))} />}
                {Number(p.transport) > 0 && <Row label="Transport" value={formatCurrency(Number(p.transport))} />}
                {Number(p.other_allowance) > 0 && <Row label="Other Allowance" value={formatCurrency(Number(p.other_allowance))} />}
                {extraAllow.map((l) => (
                  <Row key={l.component_id} label={l.name} value={formatCurrency(l.amount)} />
                ))}
                <Separator className="my-2" />
                <Row label="Gross" value={formatCurrency(gross)} bold />
              </div>

              <div>
                <h3 className="font-semibold mb-2 text-destructive">Deductions</h3>
                {extraDed.map((l) => (
                  <Row key={l.component_id} label={l.name} value={formatCurrency(l.amount)} />
                ))}
                <Row
                  label="Other / Advances"
                  value={formatCurrency(Number(p.deduction) - extraDed.reduce((s, l) => s + l.amount, 0))}
                />
                <Separator className="my-2" />
                <Row label="Total Deductions" value={formatCurrency(Number(p.deduction))} bold />
              </div>
            </div>

            <Separator />

            <div className="rounded-md bg-primary/10 p-4">
              <div className="flex items-center justify-between">
                <span className="text-base font-semibold">Net Payable</span>
                <span className="text-2xl font-bold text-primary">{formatCurrency(Number(p.net_payable))}</span>
              </div>
            </div>

            {p.notes && (
              <p className="text-xs text-muted-foreground pt-2"><strong>Notes:</strong> {p.notes}</p>
            )}

            <div className="grid grid-cols-2 gap-6 pt-12 text-xs text-center text-muted-foreground">
              <div><div className="border-t pt-1">Prepared By</div></div>
              <div><div className="border-t pt-1">Received By</div></div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PayslipPage;
