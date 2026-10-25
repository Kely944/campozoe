import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { generateOccurrences, planNotifications, type NotificationKind } from "./schedule";
import { DAY, formatDue } from "./time";
import type { Obligation, Occurrence, Profile } from "./types";
import { sendReminder } from "./whatsapp";

const HORIZON_DAYS = 14;

const HEADLINES: Record<NotificationKind, string> = {
  reminder: "Recordatorio",
  repeat: "Sigue pendiente",
  escalation: "Ayuda: sigue sin hacerse",
  overdue: "VENCIDA",
};

/** Crea las ocurrencias de los próximos días que falten. */
export async function ensureOccurrences(db: SupabaseClient, obligations: Obligation[], now: Date) {
  const to = new Date(now.getTime() + HORIZON_DAYS * DAY);
  const rows = obligations
    .filter((o) => o.active)
    .flatMap((o) => generateOccurrences(o, now, to).map((due) => ({ obligation_id: o.id, due_at: due.toISOString() })));
  if (!rows.length) return;
  const { error } = await db.from("occurrences").upsert(rows, { onConflict: "obligation_id,due_at", ignoreDuplicates: true });
  if (error) throw error;
}

export interface RunSummary {
  occurrencesChecked: number;
  sent: number;
  simulated: number;
  failed: { occurrenceId: string; error: string }[];
}

/** Paso del cron: genera ocurrencias y envía los avisos que tocan. */
export async function runReminders(db: SupabaseClient, now = new Date()): Promise<RunSummary> {
  const [{ data: obligations, error: e1 }, { data: profiles, error: e2 }] = await Promise.all([
    db.from("obligations").select("*").eq("active", true),
    db.from("profiles").select("id, full_name, phone, role"),
  ]);
  if (e1) throw e1;
  if (e2) throw e2;

  await ensureOccurrences(db, obligations as Obligation[], now);

  const byId = new Map((obligations as Obligation[]).map((o) => [o.id, o]));
  const people = new Map((profiles as Profile[]).map((p) => [p.id, p]));
  const fallbackAdmin = (profiles as Profile[]).find((p) => p.role === "admin")?.id ?? null;

  const maxOffset = Math.max(0, ...(obligations as Obligation[]).flatMap((o) => o.reminder_offsets_min));
  const { data: occurrences, error: e3 } = await db
    .from("occurrences")
    .select("*")
    .eq("status", "pending")
    .gte("due_at", new Date(now.getTime() - DAY).toISOString())
    .lte("due_at", new Date(now.getTime() + maxOffset * 60_000).toISOString());
  if (e3) throw e3;

  const ids = (occurrences as Occurrence[]).map((o) => o.id);
  const { data: sentRows, error: e4 } = ids.length
    ? await db.from("notifications").select("occurrence_id, recipient_id, slot, sent_at").in("occurrence_id", ids)
    : { data: [], error: null };
  if (e4) throw e4;

  const summary: RunSummary = { occurrencesChecked: ids.length, sent: 0, simulated: 0, failed: [] };

  for (const occ of occurrences as Occurrence[]) {
    const ob = byId.get(occ.obligation_id);
    if (!ob) continue;
    const plan = planNotifications({
      now,
      dueAt: new Date(occ.due_at),
      status: occ.status,
      offsetsMin: ob.reminder_offsets_min,
      repeatEveryMin: ob.repeat_every_min,
      escalateBeforeMin: ob.escalate_before_min,
      responsibleId: ob.responsible_id ?? fallbackAdmin,
      backupId: ob.backup_id,
      sent: (sentRows ?? [])
        .filter((s) => s.occurrence_id === occ.id)
        .map((s) => ({ slot: s.slot, recipientId: s.recipient_id, sentAt: new Date(s.sent_at) })),
    });

    for (const item of plan) {
      const person = people.get(item.recipientId);
      if (!person?.phone) continue;

      // Reserva el slot antes de enviar: si otro proceso ya lo tomó, no se duplica.
      const { data: claimed, error: claimError } = await db
        .from("notifications")
        .insert({ occurrence_id: occ.id, recipient_id: item.recipientId, slot: item.slot })
        .select("id")
        .single();
      if (claimError || !claimed) continue;

      try {
        const result = await sendReminder({
          to: person.phone,
          title: ob.title,
          dueText: formatDue(new Date(occ.due_at)),
          headline: HEADLINES[item.kind],
          occurrenceId: occ.id,
        });
        await db
          .from("notifications")
          .update({ status: result.status, provider_message_id: result.messageId })
          .eq("id", claimed.id);
        summary[result.status === "sent" ? "sent" : "simulated"]++;
      } catch (err) {
        // Guarda el fallo para el panel; si no se puede, no bloquea el reintento.
        try {
          const { error: logError } = await db.from("notification_failures").insert({
            occurrence_id: occ.id,
            recipient_id: item.recipientId,
            slot: item.slot,
            error: String(err),
          });
          if (logError) console.error("No se pudo guardar el fallo", logError);
        } catch (logErr) {
          console.error("No se pudo guardar el fallo", logErr);
        }
        // Libera el slot para reintentar en la próxima ejecución.
        await db.from("notifications").delete().eq("id", claimed.id);
        summary.failed.push({ occurrenceId: occ.id, error: String(err) });
      }
    }
  }
  return summary;
}
