import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Megaphone, Plus, Pencil, Trash2, Pin } from "lucide-react";
import { toast } from "sonner";
import { noticeService, Notice } from "@/services/branchNoticeService";

const emptyNotice: Partial<Notice> = {
  title: "",
  body: "",
  severity: "info",
  audience: "all",
  start_date: "",
  end_date: "",
  is_active: true,
  pinned: false,
};

const severityColor: Record<string, "default" | "secondary" | "destructive"> = {
  info: "secondary",
  warning: "default",
  critical: "destructive",
};

export default function NoticesPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<Notice>>(emptyNotice);

  const { data: notices = [], isLoading } = useQuery({
    queryKey: ["notices"],
    queryFn: () => noticeService.list(),
  });

  const save = useMutation({
    mutationFn: async (data: Partial<Notice>) => {
      const payload: Partial<Notice> = {
        ...data,
        start_date: data.start_date || null,
        end_date: data.end_date || null,
      };
      if (data.id) return noticeService.update(data.id, payload);
      return noticeService.create(payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notices"] });
      qc.invalidateQueries({ queryKey: ["notices-active"] });
      toast.success("Notice saved");
      setOpen(false);
      setEditing(emptyNotice);
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => noticeService.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notices"] });
      qc.invalidateQueries({ queryKey: ["notices-active"] });
      toast.success("Notice deleted");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Megaphone className="h-6 w-6" /> Notice Board
          </h1>
          <p className="text-muted-foreground text-sm">
            Broadcast announcements to staff. Pinned notices show first on dashboards.
          </p>
        </div>
        <Button onClick={() => { setEditing(emptyNotice); setOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" /> New Notice
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Notices ({notices.length})</CardTitle>
          <CardDescription>Visible to staff based on audience and active window.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : notices.length === 0 ? (
            <p className="text-muted-foreground text-sm py-8 text-center">No notices posted yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Audience</TableHead>
                  <TableHead>Window</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {notices.map((n) => (
                  <TableRow key={n.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {n.pinned && <Pin className="h-3 w-3 text-primary" />}
                        <span className="font-medium">{n.title}</span>
                      </div>
                      <div className="text-xs text-muted-foreground truncate max-w-md">{n.body}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={severityColor[n.severity]}>{n.severity}</Badge>
                    </TableCell>
                    <TableCell className="capitalize">{n.audience}</TableCell>
                    <TableCell className="text-xs">
                      {n.start_date ?? "—"} → {n.end_date ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={n.is_active ? "default" : "secondary"}>
                        {n.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button size="sm" variant="ghost" onClick={() => { setEditing(n); setOpen(true); }}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          if (confirm(`Delete notice "${n.title}"?`)) remove.mutate(n.id);
                        }}
                      >
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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing.id ? "Edit Notice" : "New Notice"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label>Title *</Label>
              <Input value={editing.title ?? ""} onChange={(e) => setEditing({ ...editing, title: e.target.value })} />
            </div>
            <div className="col-span-2">
              <Label>Body *</Label>
              <Textarea rows={4} value={editing.body ?? ""} onChange={(e) => setEditing({ ...editing, body: e.target.value })} />
            </div>
            <div>
              <Label>Severity</Label>
              <Select value={editing.severity ?? "info"} onValueChange={(v) => setEditing({ ...editing, severity: v as Notice["severity"] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="info">Info</SelectItem>
                  <SelectItem value="warning">Warning</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Audience</Label>
              <Select value={editing.audience ?? "all"} onValueChange={(v) => setEditing({ ...editing, audience: v as Notice["audience"] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All staff</SelectItem>
                  <SelectItem value="admin">Admins</SelectItem>
                  <SelectItem value="manager">Managers</SelectItem>
                  <SelectItem value="accountant">Accountants</SelectItem>
                  <SelectItem value="salesman">Salesmen</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Start date</Label>
              <Input type="date" value={editing.start_date ?? ""} onChange={(e) => setEditing({ ...editing, start_date: e.target.value })} />
            </div>
            <div>
              <Label>End date</Label>
              <Input type="date" value={editing.end_date ?? ""} onChange={(e) => setEditing({ ...editing, end_date: e.target.value })} />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={!!editing.is_active} onCheckedChange={(v) => setEditing({ ...editing, is_active: v })} />
              <Label>Active</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={!!editing.pinned} onCheckedChange={(v) => setEditing({ ...editing, pinned: v })} />
              <Label>Pin to top</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => save.mutate(editing)} disabled={save.isPending || !editing.title || !editing.body}>
              {save.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
