import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
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

/** Respuestas de WhatsApp: el botón "Hecho" marca la tarea como realizada. */
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
    const occurrenceId = payload?.startsWith("done:") ? payload.slice(5) : null;
    if (!occurrenceId) continue;

    // Solo el responsable o el respaldo (o un admin) pueden marcarla desde su número.
    const { data: person } = await db.from("profiles").select("id, role").eq("phone", msg.from).maybeSingle();
    if (!person) continue;
    const { data: occ } = await db
      .from("occurrences")
      .select("id, status, obligations(responsible_id, backup_id)")
      .eq("id", occurrenceId)
      .maybeSingle();
    if (!occ || occ.status === "done") continue;
    const ob = occ.obligations as unknown as { responsible_id: string | null; backup_id: string | null } | null;
    const allowed = person.role === "admin" || ob?.responsible_id === person.id || ob?.backup_id === person.id;
    if (!allowed) continue;

    await db
      .from("occurrences")
      .update({ status: "done", done_by: person.id, done_at: new Date().toISOString(), done_via: "whatsapp" })
      .eq("id", occurrenceId);
  }

  // Meta espera 200 siempre; si no, reintenta.
  return NextResponse.json({ ok: true });
}
