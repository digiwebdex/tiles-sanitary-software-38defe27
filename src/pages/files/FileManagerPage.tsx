import { useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Upload, Trash2, Download, FolderOpen, FileText } from "lucide-react";
import { toast } from "sonner";
import { fileManagerService, DealerFile } from "@/services/fileManagerService";

const FOLDERS = ["general", "contracts", "invoices", "licenses", "photos", "other"];

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

export default function FileManagerPage() {
  const qc = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const [folder, setFolder] = useState<string>("all");
  const [uploadFolder, setUploadFolder] = useState<string>("general");
  const [description, setDescription] = useState("");
  const [uploading, setUploading] = useState(false);

  const { data: files = [], isLoading } = useQuery({
    queryKey: ["dealer-files", folder],
    queryFn: () => fileManagerService.list(folder === "all" ? undefined : folder),
  });

  const removeMut = useMutation({
    mutationFn: (id: string) => fileManagerService.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dealer-files"] });
      toast.success("File deleted");
    },
    onError: (e: any) => toast.error(e.message || "Delete failed"),
  });

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      await fileManagerService.upload(file, uploadFolder, description || undefined);
      toast.success("File uploaded");
      setDescription("");
      if (fileInput.current) fileInput.current.value = "";
      qc.invalidateQueries({ queryKey: ["dealer-files"] });
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  const grouped = useMemo(() => {
    const map = new Map<string, number>();
    files.forEach((f) => map.set(f.folder, (map.get(f.folder) || 0) + 1));
    return Array.from(map.entries());
  }, [files]);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-2">
        <FolderOpen className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">File Manager</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Upload New File</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-4">
          <div>
            <Label>Folder</Label>
            <Select value={uploadFolder} onValueChange={setUploadFolder}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {FOLDERS.map((f) => (
                  <SelectItem key={f} value={f}>{f}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2">
            <Label>Description (optional)</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this file?"
            />
          </div>
          <div className="flex items-end">
            <input
              ref={fileInput}
              type="file"
              hidden
              onChange={handleUpload}
            />
            <Button
              onClick={() => fileInput.current?.click()}
              disabled={uploading}
              className="w-full"
            >
              <Upload className="h-4 w-4 mr-2" />
              {uploading ? "Uploading..." : "Choose File"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground md:col-span-4">
            Max 20 MB. PDF, Word, Excel, PowerPoint, images, CSV, ZIP allowed.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Files</CardTitle>
          <Select value={folder} onValueChange={setFolder}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All folders</SelectItem>
              {FOLDERS.map((f) => (
                <SelectItem key={f} value={f}>{f}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          {grouped.length > 0 && (
            <div className="flex gap-2 flex-wrap mb-4">
              {grouped.map(([f, c]) => (
                <Badge key={f} variant="secondary">{f}: {c}</Badge>
              ))}
            </div>
          )}
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : files.length === 0 ? (
            <p className="text-sm text-muted-foreground">No files yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Folder</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Uploaded</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {files.map((f: DealerFile) => (
                  <TableRow key={f.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <div className="font-medium">{f.original_name}</div>
                          {f.description && (
                            <div className="text-xs text-muted-foreground">{f.description}</div>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell><Badge variant="outline">{f.folder}</Badge></TableCell>
                    <TableCell>{formatBytes(Number(f.size_bytes))}</TableCell>
                    <TableCell className="text-xs">
                      {new Date(f.created_at).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button
                        size="sm"
                        variant="outline"
                        asChild
                      >
                        <a
                          href={fileManagerService.resolveUrl(f.url)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <Download className="h-4 w-4" />
                        </a>
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => {
                          if (confirm(`Delete "${f.original_name}"?`)) {
                            removeMut.mutate(f.id);
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
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
