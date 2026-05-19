/**
 * fileManagerService — dealer document/file registry on VPS.
 * Routes: /api/files
 */
import { env } from "@/lib/env";
import { vpsTokenStore, vpsAuthedFetch } from "@/lib/vpsAuthClient";

export interface DealerFile {
  id: string;
  dealer_id: string;
  folder: string;
  name: string;
  original_name: string;
  mime_type: string | null;
  size_bytes: number;
  url: string;
  description: string | null;
  uploaded_by: string | null;
  created_at: string;
}

async function jsonOrThrow(res: Response) {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error || `Request failed (${res.status})`);
  return body;
}

export const fileManagerService = {
  async list(folder?: string): Promise<DealerFile[]> {
    const qs = folder ? `?folder=${encodeURIComponent(folder)}` : "";
    const res = await vpsAuthedFetch(`/api/files${qs}`);
    const body = await jsonOrThrow(res);
    return body.files as DealerFile[];
  },

  async upload(file: File, folder: string, description?: string): Promise<DealerFile> {
    if (!file) throw new Error("No file provided");
    if (file.size > 20 * 1024 * 1024) throw new Error("File must be ≤ 20 MB");
    const fd = new FormData();
    fd.append("file", file);
    fd.append("folder", folder || "general");
    if (description) fd.append("description", description);

    const headers: Record<string, string> = {};
    const access = vpsTokenStore.access;
    if (access) headers.Authorization = `Bearer ${access}`;

    const res = await fetch(`${env.VPS_API_BASE}/api/files`, {
      method: "POST",
      headers,
      body: fd,
    });
    const body = await jsonOrThrow(res);
    return body.file as DealerFile;
  },

  async update(id: string, patch: { folder?: string; description?: string }): Promise<DealerFile> {
    const res = await vpsAuthedFetch(`/api/files/${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
    const body = await jsonOrThrow(res);
    return body.file as DealerFile;
  },

  async remove(id: string): Promise<void> {
    const res = await vpsAuthedFetch(`/api/files/${id}`, { method: "DELETE" });
    await jsonOrThrow(res);
  },

  resolveUrl(url: string): string {
    if (/^https?:\/\//i.test(url)) return url;
    return `${env.VPS_API_BASE}${url.startsWith("/") ? "" : "/"}${url}`;
  },
};
