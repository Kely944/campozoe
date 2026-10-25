import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

const API_VERSION = process.env.WHATSAPP_API_VERSION ?? "v21.0";

export interface ReminderMessage {
  to: string; // 593991234567
  title: string;
  dueText: string;
  headline: string; // "Recordatorio", "Vencida", ...
  occurrenceId: string;
}

export interface SendResult {
  status: "sent" | "simulated";
  messageId: string | null;
}

/** true si hay credenciales de WhatsApp; si no, los avisos se simulan en consola. */
export function whatsappEnabled(): boolean {
  return Boolean(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);
}

/**
 * Envía la plantilla aprobada en Meta (por defecto "recordatorio_tarea"):
 *   Cuerpo: "{{1}}: {{2}}. Vence: {{3}}."
 *   Botón de respuesta rápida: "Hecho"
 */
export async function sendReminder(msg: ReminderMessage): Promise<SendResult> {
  if (!whatsappEnabled()) {
    console.log(`[WhatsApp simulado] a ${msg.to}: ${msg.headline}: ${msg.title}. Vence: ${msg.dueText}.`);
    return { status: "simulated", messageId: null };
  }

  const res = await fetch(`https://graph.facebook.com/${API_VERSION}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: msg.to,
      type: "template",
      template: {
        name: process.env.WHATSAPP_TEMPLATE ?? "recordatorio_tarea",
        language: { code: process.env.WHATSAPP_TEMPLATE_LANG ?? "es" },
        components: [
          {
            type: "body",
            parameters: [msg.headline, msg.title, msg.dueText].map((text) => ({ type: "text", text })),
          },
          {
            type: "button",
            sub_type: "quick_reply",
            index: "0",
            parameters: [{ type: "payload", payload: `done:${msg.occurrenceId}` }],
          },
        ],
      },
    }),
  });

  const body = await res.json();
  if (!res.ok) throw new Error(`WhatsApp ${res.status}: ${JSON.stringify(body.error ?? body)}`);
  return { status: "sent", messageId: body.messages?.[0]?.id ?? null };
}

/** Verifica la firma X-Hub-Signature-256 que Meta agrega a cada webhook. */
export function verifySignature(rawBody: string, header: string | null): boolean {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret || !header?.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const given = header.slice("sha256=".length);
  return given.length === expected.length && timingSafeEqual(Buffer.from(given), Buffer.from(expected));
}
