import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ObligationInput } from "./obligation-form";
import { ensureOccurrences } from "./reminders";
import type { Obligation } from "./types";

/**
 * Crea o actualiza una obligación y rehace sus próximos vencimientos pendientes.
 * La usan Tareas y los módulos que generan avisos (pagos, órdenes, notas de crédito…).
 * Respeta RLS: solo una administradora puede escribir obligaciones.
 */
export async function upsertObligation(
  db: SupabaseClient,
  id: string | null,
  data: ObligationInput & { source?: string },
  now = new Date(),
): Promise<{ obligation: Obligation } | { error: string }> {
  const query = id
    ? db.from("obligations").update({ ...data, updated_at: now.toISOString() }).eq("id", id)
    : db.from("obligations").insert(data);
  const { data: row, error } = await query.select("*").single();
  if (error || !row) return { error: "No se pudo guardar la tarea. Solo la administradora puede hacerlo." };

  // Si cambió el horario, se rehacen los próximos vencimientos pendientes.
  if (id) await db.from("occurrences").delete().eq("obligation_id", id).eq("status", "pending").gt("due_at", now.toISOString());
  await ensureOccurrences(db, [row as Obligation], now);
  return { obligation: row as Obligation };
}

/** Marca hechos los vencimientos pendientes (vía RPC) y pausa la obligación: ya no hace falta avisar. */
export async function completeObligation(db: SupabaseClient, obligationId: string | null) {
  if (!obligationId) return;
  const { data } = await db.from("occurrences").select("id").eq("obligation_id", obligationId).eq("status", "pending");
  for (const o of data ?? []) await db.rpc("mark_done", { occurrence_id: o.id });
  await db.from("obligations").update({ active: false }).eq("id", obligationId);
}
