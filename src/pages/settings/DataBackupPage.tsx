import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Database, Download, FileText, ArrowLeft, CheckCircle2, Upload } from "lucide-react";
import { toast } from "sonner";
import { vpsAuthedFetch, vpsTokenStore } from "@/lib/vpsAuthClient";
import { env } from "@/lib/env";
import { usePermissions } from "@/hooks/usePermissions";

interface ManifestEntry {
  key: string;
  label: string;
  table: string;
  rows: number;
}

async function downloadCsv(key: string, filename: string) {
  const access = vpsTokenStore.access;
  const res = await fetch(`${env.VPS_API_BASE}/api/data-export/${key}.csv`, {
    headers: access ? { Authorization: `Bearer ${access}` } : {},
  });
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

const DataBackupPage = () => {
  const { isDealerAdmin } = usePermissions();
  const [downloadingAll, setDownloadingAll] = useState(false);
  const [downloadingKey, setDownloadingKey] = useState<string | null>(null);

  const manifestQuery = useQuery({
    queryKey: ["data-export-manifest"],
    queryFn: async () => {
      const res = await vpsAuthedFetch(`/api/data-export/manifest`);
      if (!res.ok) throw new Error("Failed to load backup manifest");
      return (await res.json()) as ManifestEntry[];
    },
    enabled: isDealerAdmin,
  });

  if (!isDealerAdmin) {
    return (
      <div className="container mx-auto max-w-4xl p-6">
        <p className="text-destructive">Access denied. Dealer admin only.</p>
      </div>
    );
  }

  const entries = manifestQuery.data ?? [];

  const handleExportOne = async (entry: ManifestEntry) => {
    setDownloadingKey(entry.key);
    try {
      const stamp = new Date().toISOString().slice(0, 10);
      await downloadCsv(entry.key, `${entry.key}_${stamp}.csv`);
      toast.success(`Exported ${entry.label}`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setDownloadingKey(null);
    }
  };

  const handleExportAll = async () => {
    if (entries.length === 0) return;
    setDownloadingAll(true);
    try {
      const stamp = new Date().toISOString().slice(0, 10);
      for (const e of entries) {
        try {
          await downloadCsv(e.key, `${e.key}_${stamp}.csv`);
          // small delay so browsers don't block multi-download
          await new Promise((r) => setTimeout(r, 250));
        } catch (err) {
          console.warn("export failed", e.key, err);
        }
      }
      toast.success("All exports downloaded");
    } finally {
      setDownloadingAll(false);
    }
  };

  return (
    <div className="container mx-auto max-w-6xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <Link to="/settings" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to Settings
        </Link>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5 text-primary" />
              Data Export & Backup
            </CardTitle>
            <CardDescription>Download your data as CSV files for backup or migration</CardDescription>
          </div>
          <Button
            variant="outline"
            onClick={handleExportAll}
            disabled={downloadingAll || entries.length === 0}
          >
            <Download className="h-4 w-4 mr-2" />
            {downloadingAll ? "Exporting…" : "Export All"}
          </Button>
        </CardHeader>
        <CardContent>
          {manifestQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : manifestQuery.isError ? (
            <p className="text-sm text-destructive">{(manifestQuery.error as Error).message}</p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {entries.map((e) => (
                <div
                  key={e.key}
                  className="flex items-center justify-between rounded-lg border bg-card p-3 hover:bg-accent/40 transition"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <FileText className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <div className="font-medium truncate">{e.label}</div>
                      <div className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 mt-0.5">
                        <CheckCircle2 className="h-3 w-3" />
                        {e.rows.toLocaleString()} records
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleExportOne(e)}
                    disabled={downloadingKey === e.key}
                    aria-label={`Export ${e.label}`}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-primary" />
            Restore from CSV
          </CardTitle>
          <CardDescription>
            Re-import previously exported data. Use the bulk import dialog from each
            module (Customers, Suppliers, Products) — it accepts the same CSV files
            you exported above.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <Link to="/customers">
            <Button variant="outline" className="w-full justify-start">
              <Upload className="h-4 w-4 mr-2" /> Restore Customers
            </Button>
          </Link>
          <Link to="/suppliers">
            <Button variant="outline" className="w-full justify-start">
              <Upload className="h-4 w-4 mr-2" /> Restore Suppliers
            </Button>
          </Link>
          <Link to="/products">
            <Button variant="outline" className="w-full justify-start">
              <Upload className="h-4 w-4 mr-2" /> Restore Products
            </Button>
          </Link>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        <Badge variant="secondary" className="mr-2">Tip</Badge>
        Exports include only your dealer account's data. Run regular backups and
        keep CSV files in a safe place.
      </p>
    </div>
  );
};

export default DataBackupPage;
