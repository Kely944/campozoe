import "server-only";
import type { SendResult } from "./whatsapp";

/** true si hay credenciales de correo (API de Resend); si no, el correo se simula en consola. */
export function emailEnabled(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

export interface ReminderEmail {
  to: string;
  headline: string;
  title: string;
  dueText: string;
}

/** RNF-03: correo como alternativa a WhatsApp (sin teléfono o si WhatsApp falla). */
export async function sendReminderEmail(msg: ReminderEmail): Promise<SendResult> {
  const subject = `${msg.headline}: ${msg.title}`;
  const text = `${msg.headline}: ${msg.title}.\nVence: ${msg.dueText}.\n\nMárcala como hecha en la app Pendientes.`;
  if (!emailEnabled()) {
    console.log(`[Correo simulado] a ${msg.to}: ${subject}`);
    return { status: "simulated", messageId: null };
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [msg.to], subject, text }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Correo ${res.status}: ${JSON.stringify(body)}`);
  return { status: "sent", messageId: body.id ?? null };
}
