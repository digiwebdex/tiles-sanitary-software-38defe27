import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Building2, Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { branchService, Branch } from "@/services/branchNoticeService";

const emptyBranch: Partial<Branch> = {
  code: "",
  name: "",
  address: "",
  phone: "",
  email: "",
  manager_name: "",
  is_active: true,
  is_default: false,
  notes: "",
};

export default function BranchesPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<Branch>>(emptyBranch);

  const { data: branches = [], isLoading } = useQuery({
    queryKey: ["branches"],
    queryFn: () => branchService.list(),
  });

  const save = useMutation({
    mutationFn: async (data: Partial<Branch>) => {
      if (data.id) return branchService.update(data.id, data);
      return branchService.create(data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["branches"] });
      toast.success("Branch saved");
      setOpen(false);
      setEditing(emptyBranch);
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => branchService.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["branches"] });
      toast.success("Branch deleted");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Building2 className="h-6 w-6" /> Manage Branches
          </h1>
          <p className="text-muted-foreground text-sm">
            Outlets / branches under your dealership. Mark one as default for new transactions.
          </p>
        </div>
        <Button onClick={() => { setEditing(emptyBranch); setOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" /> Add Branch
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Branches ({branches.length})</CardTitle>
          <CardDescription>Default branch is auto-selected during sales / purchases.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : branches.length === 0 ? (
            <p className="text-muted-foreground text-sm py-8 text-center">No branches yet. Add your first branch.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Manager</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {branches.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell className="font-mono">{b.code}</TableCell>
                    <TableCell>
                      {b.name}
                      {b.is_default && <Badge variant="default" className="ml-2">Default</Badge>}
                    </TableCell>
                    <TableCell>{b.manager_name ?? "-"}</TableCell>
                    <TableCell>{b.phone ?? "-"}</TableCell>
                    <TableCell>
                      <Badge variant={b.is_active ? "default" : "secondary"}>
                        {b.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button size="sm" variant="ghost" onClick={() => { setEditing(b); setOpen(true); }}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          if (confirm(`Delete branch "${b.name}"?`)) remove.mutate(b.id);
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
            <DialogTitle>{editing.id ? "Edit Branch" : "Add Branch"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Code *</Label>
              <Input value={editing.code ?? ""} onChange={(e) => setEditing({ ...editing, code: e.target.value })} placeholder="HQ, BR01" />
            </div>
            <div>
              <Label>Name *</Label>
              <Input value={editing.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
            </div>
            <div>
              <Label>Manager</Label>
              <Input value={editing.manager_name ?? ""} onChange={(e) => setEditing({ ...editing, manager_name: e.target.value })} />
            </div>
            <div>
              <Label>Phone</Label>
              <Input value={editing.phone ?? ""} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} />
            </div>
            <div className="col-span-2">
              <Label>Email</Label>
              <Input value={editing.email ?? ""} onChange={(e) => setEditing({ ...editing, email: e.target.value })} />
            </div>
            <div className="col-span-2">
              <Label>Address</Label>
              <Textarea rows={2} value={editing.address ?? ""} onChange={(e) => setEditing({ ...editing, address: e.target.value })} />
            </div>
            <div className="col-span-2">
              <Label>Notes</Label>
              <Textarea rows={2} value={editing.notes ?? ""} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={!!editing.is_active} onCheckedChange={(v) => setEditing({ ...editing, is_active: v })} />
              <Label>Active</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={!!editing.is_default} onCheckedChange={(v) => setEditing({ ...editing, is_default: v })} />
              <Label>Default branch</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => save.mutate(editing)} disabled={save.isPending || !editing.code || !editing.name}>
              {save.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
