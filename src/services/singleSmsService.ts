/**
 * singleSmsService — manual one-off SMS sender.
 * Reuses the existing idempotent /api/notifications/sms backend.
 */
import { vpsAuthedFetch } from "@/lib/vpsAuthClient";

export interface SmsSendResult {
  id?: string;
  status: string;
  sent_at?: string | null;
  deduped?: boolean;
}

function genKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return (crypto as any).randomUUID();
  }
  return `manual-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export const singleSmsService = {
  async send(to: string, message: string): Promise<SmsSendResult> {
    const cleaned = to.replace(/\s+/g, "");
    if (cleaned.length < 8) throw new Error("Phone number is too short");
    if (!message.trim()) throw new Error("Message is required");

    const res = await vpsAuthedFetch(`/api/notifications/sms`, {
      method: "POST",
      body: JSON.stringify({
        to: cleaned,
        message: message.trim(),
        idempotency_key: genKey(),
        source_type: "manual",
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body?.error || `SMS failed (${res.status})`);
    return body as SmsSendResult;
  },
};
