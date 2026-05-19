import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Trash2, Plus, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { useDealerId } from "@/hooks/useDealerId";
import { leadOptionService, LeadOptionKind } from "@/services/leadService";

const KINDS: { value: LeadOptionKind; label: string }[] = [
  { value: "source", label: "Sources" },
  { value: "status", label: "Statuses" },
  { value: "visit_type", label: "Visit Types" },
  { value: "outcome", label: "Outcomes" },
];

export default function LeadOptionsPage() {
  const dealerId = useDealerId();
  const qc = useQueryClient();
  const [kind, setKind] = useState<LeadOptionKind>("source");
  const [form, setForm] = useState({ value: "", label: "", color: "", sort_order: 0 });

  const { data = [], isLoading } = useQuery({
    queryKey: ["lead-options", dealerId, kind],
    queryFn: () => leadOptionService.list(dealerId, kind),
    enabled: !!dealerId,
  });

  const saveMut = useMutation({
    mutationFn: () =>
      leadOptionService.upsert(dealerId, {
        kind,
        value: form.value.trim().toLowerCase().replace(/\s+/g, "_"),
        label: form.label.trim(),
        color: form.color.trim() || null,
        sort_order: Number(form.sort_order) || 0,
        is_active: true,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lead-options"] });
      setForm({ value: "", label: "", color: "", sort_order: 0 });
      toast.success("Option saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => leadOptionService.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lead-options"] });
      toast.success("Option removed");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Settings2 className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">Configurable Lead Options</h1>
      </div>

      <Tabs value={kind} onValueChange={(v) => setKind(v as LeadOptionKind)}>
        <TabsList>
          {KINDS.map((k) => (
            <TabsTrigger key={k.value} value={k.value}>{k.label}</TabsTrigger>
          ))}
        </TabsList>

        {KINDS.map((k) => (
          <TabsContent key={k.value} value={k.value} className="space-y-4">
            <Card>
              <CardHeader><CardTitle>Add / Update {k.label.slice(0, -1)}</CardTitle></CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-5">
                <div>
                  <Label>Value (code)</Label>
                  <Input value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} placeholder="e.g. tradeshow" />
                </div>
                <div>
                  <Label>Label</Label>
                  <Input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="Trade Show" />
                </div>
                <div>
                  <Label>Color (optional)</Label>
                  <Input value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} placeholder="#3b82f6" />
                </div>
                <div>
                  <Label>Sort</Label>
                  <Input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })} />
                </div>
                <div className="flex items-end">
                  <Button
                    onClick={() => saveMut.mutate()}
                    disabled={!form.value.trim() || !form.label.trim() || saveMut.isPending}
                    className="w-full"
                  >
                    <Plus className="h-4 w-4 mr-1" /> Save
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>{k.label} ({data.length})</CardTitle></CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="text-center py-6 text-muted-foreground">Loading…</div>
                ) : data.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground">No custom options yet.</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Value</TableHead>
                        <TableHead>Label</TableHead>
                        <TableHead>Color</TableHead>
                        <TableHead>Sort</TableHead>
                        <TableHead>Active</TableHead>
                        <TableHead className="w-24" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.map((o) => (
                        <TableRow key={o.id}>
                          <TableCell className="font-mono text-sm">{o.value}</TableCell>
                          <TableCell>{o.label}</TableCell>
                          <TableCell>
                            {o.color ? (
                              <span className="inline-flex items-center gap-2">
                                <span className="inline-block h-4 w-4 rounded" style={{ background: o.color }} />
                                <span className="text-xs">{o.color}</span>
                              </span>
                            ) : "—"}
                          </TableCell>
                          <TableCell>{o.sort_order}</TableCell>
                          <TableCell>
                            <Badge variant={o.is_active ? "default" : "secondary"}>{o.is_active ? "Yes" : "No"}</Badge>
                          </TableCell>
                          <TableCell>
                            <Button size="icon" variant="ghost" onClick={() => deleteMut.mutate(o.id)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
