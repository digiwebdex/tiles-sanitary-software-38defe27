import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Mail, Send } from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { vpsAuthedFetch } from "@/lib/vpsAuthClient";

interface SmtpSettings {
  host: string;
  port: number;
  secure: boolean;
  username: string;
  password: string;
  from_name: string | null;
  from_email: string;
  enabled: boolean;
}

const EMPTY: SmtpSettings = {
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  username: "",
  password: "",
  from_name: "",
  from_email: "",
  enabled: true,
};

async function fetchJson(path: string, init?: RequestInit) {
  const res = await vpsAuthedFetch(path, init);
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
  return data;
}

export function SmtpSettingsCard() {
  const qc = useQueryClient();
  const [form, setForm] = useState<SmtpSettings>(EMPTY);
  const [testEmail, setTestEmail] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["smtp-settings"],
    queryFn: () => fetchJson("/api/smtp-settings"),
  });

  useEffect(() => {
    if (data) {
      setForm({
        host: data.host ?? "",
        port: data.port ?? 587,
        secure: !!data.secure,
        username: data.username ?? "",
        password: data.password ?? "",
        from_name: data.from_name ?? "",
        from_email: data.from_email ?? "",
        enabled: data.enabled ?? true,
      });
    }
  }, [data]);

  const save = useMutation({
    mutationFn: () =>
      fetchJson("/api/smtp-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["smtp-settings"] });
      toast.success("SMTP configuration saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const test = useMutation({
    mutationFn: () =>
      fetchJson("/api/smtp-settings/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: testEmail }),
      }),
    onSuccess: () => toast.success(`Test email sent to ${testEmail}`),
    onError: (e: Error) => toast.error(e.message),
  });

  const update = <K extends keyof SmtpSettings>(k: K, v: SmtpSettings[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5 text-primary" />
          SMTP Email Configuration
        </CardTitle>
        <CardDescription>
          Configure your SMTP server to send invoices, receipts and payment reminders from your own email.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>SMTP Host</Label>
            <Input
              placeholder="smtp.gmail.com"
              value={form.host}
              onChange={(e) => update("host", e.target.value)}
              disabled={isLoading}
            />
          </div>
          <div className="space-y-2">
            <Label>Port</Label>
            <Input
              type="number"
              placeholder="587"
              value={form.port}
              onChange={(e) => update("port", Number(e.target.value) || 587)}
              disabled={isLoading}
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Switch
            checked={form.secure}
            onCheckedChange={(v) => update("secure", v)}
            id="smtp-secure"
          />
          <Label htmlFor="smtp-secure">Use SSL/TLS (port 465)</Label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Username</Label>
            <Input
              placeholder="user@yourdomain.com"
              value={form.username}
              onChange={(e) => update("username", e.target.value)}
              disabled={isLoading}
            />
          </div>
          <div className="space-y-2">
            <Label>Password</Label>
            <Input
              type="password"
              placeholder="App password or SMTP password"
              value={form.password}
              onChange={(e) => update("password", e.target.value)}
              disabled={isLoading}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>From Name</Label>
            <Input
              placeholder="Your Business Name"
              value={form.from_name ?? ""}
              onChange={(e) => update("from_name", e.target.value)}
              disabled={isLoading}
            />
          </div>
          <div className="space-y-2">
            <Label>From Email</Label>
            <Input
              type="email"
              placeholder="noreply@yourdomain.com"
              value={form.from_email}
              onChange={(e) => update("from_email", e.target.value)}
              disabled={isLoading}
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Switch
            checked={form.enabled}
            onCheckedChange={(v) => update("enabled", v)}
            id="smtp-enabled"
          />
          <Label htmlFor="smtp-enabled">Enable this SMTP for sending</Label>
        </div>

        <div className="flex gap-2">
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? "Saving..." : "Save Configuration"}
          </Button>
        </div>

        <Separator />

        <div className="space-y-2">
          <Label>Send Test Email</Label>
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              type="email"
              placeholder="test@example.com"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
            />
            <Button
              variant="outline"
              onClick={() => test.mutate()}
              disabled={test.isPending || !testEmail}
            >
              <Send className="h-4 w-4 mr-2" />
              {test.isPending ? "Sending..." : "Send Test"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Save your configuration first, then send a test email to verify it works.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export default SmtpSettingsCard;
