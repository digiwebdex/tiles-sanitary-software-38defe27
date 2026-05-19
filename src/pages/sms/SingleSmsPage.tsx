import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Send, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { singleSmsService } from "@/services/singleSmsService";

const TEMPLATES: { label: string; text: string }[] = [
  { label: "Greeting", text: "ধন্যবাদ আমাদের সাথে যোগাযোগ করার জন্য।" },
  { label: "Order Ready", text: "আপনার অর্ডার প্রস্তুত। দয়া করে ডেলিভারি নিন।" },
  { label: "Due Reminder", text: "আপনার বকেয়া পরিশোধের জন্য অনুরোধ করা হচ্ছে।" },
];

export default function SingleSmsPage() {
  const [to, setTo] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [history, setHistory] = useState<{ to: string; message: string; status: string; at: string }[]>([]);

  const charCount = message.length;
  const segments = Math.ceil(charCount / 160) || 1;

  async function handleSend() {
    if (!to.trim() || !message.trim()) {
      toast.error("Phone and message are required");
      return;
    }
    setSending(true);
    try {
      const res = await singleSmsService.send(to, message);
      toast.success(res.deduped ? "Already sent (deduped)" : "SMS dispatched");
      setHistory((h) => [
        { to, message, status: res.status, at: new Date().toLocaleString() },
        ...h,
      ].slice(0, 20));
      setMessage("");
    } catch (e: any) {
      toast.error(e.message || "Failed to send");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-2">
        <MessageSquare className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">Single SMS Sender</h1>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Compose Message</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Phone Number</Label>
              <Input
                placeholder="01XXXXXXXXX"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </div>
            <div>
              <Label>Message</Label>
              <Textarea
                rows={6}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Write your message..."
              />
              <p className="text-xs text-muted-foreground mt-1">
                {charCount} chars • {segments} segment{segments > 1 ? "s" : ""}
              </p>
            </div>
            <div className="flex gap-2 flex-wrap">
              {TEMPLATES.map((t) => (
                <Button
                  key={t.label}
                  variant="outline"
                  size="sm"
                  onClick={() => setMessage(t.text)}
                >
                  {t.label}
                </Button>
              ))}
            </div>
            <Button onClick={handleSend} disabled={sending} className="w-full">
              <Send className="h-4 w-4 mr-2" />
              {sending ? "Sending..." : "Send SMS"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent (this session)</CardTitle>
          </CardHeader>
          <CardContent>
            {history.length === 0 ? (
              <p className="text-sm text-muted-foreground">No messages yet.</p>
            ) : (
              <ul className="space-y-3">
                {history.map((h, i) => (
                  <li key={i} className="text-sm border-l-2 border-primary pl-2">
                    <div className="font-medium">{h.to}</div>
                    <div className="text-muted-foreground truncate">{h.message}</div>
                    <div className="text-xs text-muted-foreground">
                      {h.at} • {h.status}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
