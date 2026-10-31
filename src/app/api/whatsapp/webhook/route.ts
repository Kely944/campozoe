import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { localDate } from "@/lib/time";
import { verifySignature } from "@/lib/whatsapp";

export const dynamic = "force-dynamic";

/** Verificación del webhook al configurarlo en Meta. */
export function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  if (params.get("hub.mode") === "subscribe" && params.get("hub.verify_token") === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new NextResponse(params.get("hub.challenge"), { status: 200 });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

interface IncomingMessage {
  from: string;
  type: string;
  button?: { payload?: string };
  interactive?: { button_reply?: { id?: string } };
}

const SNOOZE_MIN = 60;

/** Respuestas de WhatsApp: "Hecho" marca la tarea; "Recordar en 1 h" pausa la insistencia. */
export async function POST(request: NextRequest) {
  const raw = await request.text();
  if (!verifySignature(raw, request.headers.get("x-hub-signature-256"))) {
    return new NextResponse("Firma inválida", { status: 401 });
  }

  const body = JSON.parse(raw);
  const messages: IncomingMessage[] =
    body.entry?.flatMap((e: { changes?: { value?: { messages?: IncomingMessage[] } }[] }) =>
      e.changes?.flatMap((c) => c.value?.messages ?? []) ?? [],
    ) ?? [];

  const db = createAdminClient();
  for (const msg of messages) {
    const payload = msg.button?.payload ?? msg.interactive?.button_reply?.id;
    const [action, occurrenceId] = payload?.split(":") ?? [];
    if ((action !== "done" && action !== "snooze") || !occurrenceId) continue;

    // Solo el responsable o el respaldo (o un admin) pueden marcarla desde su número.
    const { data: person } = await db.from("profiles").select("id, role").eq("phone", msg.from).maybeSingle();
    if (!person) continue;
    const { data: occ } = await db
      .from("occurrences")
      .select("id, status, obligation_id, obligations(responsible_id, backup_id, source)")
      .eq("id", occurrenceId)
      .maybeSingle();
    if (!occ || occ.status === "done") continue;
    const ob = occ.obligations as unknown as { responsible_id: string | null; backup_id: string | null; source: string } | null;
    const allowed = person.role === "admin" || ob?.responsible_id === person.id || ob?.backup_id === person.id;
    if (!allowed) continue;

    if (action === "snooze") {
      const until = new Date(Date.now() + SNOOZE_MIN * 60_000).toISOString();
      await db.from("occurrences").update({ snoozed_until: until }).eq("id", occurrenceId);
      continue;
    }

    await db
      .from("occurrences")
      .update({ status: "done", done_by: person.id, done_at: new Date().toISOString(), done_via: "whatsapp" })
      .eq("id", occurrenceId);
    // "Hecho" en un aviso de cobro registra el cobro (si no, la venta quedaría pendiente sin avisos).
    if (ob?.source === "cobro") {
      await db
        .from("credit_sales")
        .update({ paid_on: localDate(new Date()), paid_by: person.id })
        .eq("obligation_id", occ.obligation_id)
        .is("paid_on", null);
      await db.from("obligations").update({ active: false }).eq("id", occ.obligation_id);
    }
  }

  // Meta espera 200 siempre; si no, reintenta.
  return NextResponse.json({ ok: true });
}
