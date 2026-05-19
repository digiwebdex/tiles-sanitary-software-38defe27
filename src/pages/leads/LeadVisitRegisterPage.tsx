import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useDealerId } from "@/hooks/useDealerId";
import { leadService } from "@/services/leadService";
import { CalendarDays } from "lucide-react";

const today = () => new Date().toISOString().slice(0, 10);
const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
};

export default function LeadVisitRegisterPage() {
  const dealerId = useDealerId();
  const [from, setFrom] = useState(daysAgo(30));
  const [to, setTo] = useState(today());
  const [visitType, setVisitType] = useState("");

  const { data = [], isLoading, refetch } = useQuery({
    queryKey: ["lead-visit-register", dealerId, from, to, visitType],
    queryFn: () => leadService.visitRegister(dealerId, { from, to, visit_type: visitType || undefined }),
    enabled: !!dealerId,
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <CalendarDays className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">Lead Visit Register</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-4">
          <div>
            <Label>From</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <Label>To</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div>
            <Label>Visit Type</Label>
            <Input placeholder="visit, call, meeting…" value={visitType} onChange={(e) => setVisitType(e.target.value)} />
          </div>
          <div className="flex items-end">
            <Button onClick={() => refetch()} className="w-full">Apply</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Visits ({data.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading…</div>
          ) : data.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No visits in the selected range.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Lead</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Outcome</TableHead>
                  <TableHead>Next Action</TableHead>
                  <TableHead>Next Date</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((v) => (
                  <TableRow key={v.id}>
                    <TableCell>{v.visit_date}</TableCell>
                    <TableCell>
                      <div className="font-medium">{v.lead_name}</div>
                      {v.lead_company && <div className="text-xs text-muted-foreground">{v.lead_company}</div>}
                    </TableCell>
                    <TableCell>{v.lead_phone ?? "—"}</TableCell>
                    <TableCell><Badge variant="outline">{v.visit_type}</Badge></TableCell>
                    <TableCell className="max-w-xs truncate">{v.outcome ?? "—"}</TableCell>
                    <TableCell className="max-w-xs truncate">{v.next_action ?? "—"}</TableCell>
                    <TableCell>{v.next_date ?? "—"}</TableCell>
                    <TableCell><Badge variant="secondary">{v.lead_status}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
