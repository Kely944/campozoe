"use server";

import { revalidatePath } from "next/cache";
import type { FormState } from "@/app/actions";
import { creditNoteObligation, parseCreditNoteForm, parseCreditSaleForm, reconcile, type InvoiceToReconcile } from "@/lib/cobros";
import { completeObligation, upsertObligation } from "@/lib/obligations";
import { requireAdmin, requireProfile } from "@/lib/session";
import { localDate } from "@/lib/time";

/** RF-23/24: la BD crea el aviso de cobro (trigger credit_sale_reminder). */
export async function createCreditSale(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = parseCreditSaleForm(formData, localDate(new Date()));
  if ("error" in parsed) return { error: parsed.error };
  const { supabase } = await requireProfile();
  const { error } = await supabase.from("credit_sales").insert(parsed.data);
  if (error) return { error: "No se pudo guardar la venta. Intenta de nuevo." };
  revalidatePath("/", "layout");
  return { ok: `Venta a ${parsed.data.customer} guardada. Se avisará si no paga a tiempo.` };
}

export async function markCreditPaid(id: string) {
  const { supabase } = await requireProfile();
  await supabase.rpc("mark_credit_paid", { sale_id: id });
  revalidatePath("/", "layout");
}

export async function saveCreditDays(_: FormState, formData: FormData): Promise<FormState> {
  const days = Number(formData.get("credit_days"));
  if (!Number.isInteger(days) || days < 1 || days > 90) return { error: "Elige entre 1 y 90 días." };
  const { supabase } = await requireAdmin();
  const { error } = await supabase.from("app_settings").update({ credit_days: days }).eq("id", 1);
  if (error) return { error: "No se pudo guardar." };
  revalidatePath("/cobros");
  return { ok: `Se avisará a los ${days} días. Aplica a las ventas nuevas.` };
}

/** RF-26 */
export async function createCreditNoteWatch(_: FormState, formData: FormData): Promise<FormState> {
  const now = new Date();
  const parsed = parseCreditNoteForm(formData, localDate(now));
  if ("error" in parsed) return { error: parsed.error };
  const { supabase, user } = await requireAdmin();
  const res = await upsertObligation(supabase, null, { ...creditNoteObligation(parsed.data, user.id, now), source: "nota_credito" }, now);
  if ("error" in res) return { error: res.error };
  const { error } = await supabase.from("credit_note_watch").insert({ ...parsed.data, obligation_id: res.obligation.id });
  if (error) return { error: "No se pudo guardar." };
  revalidatePath("/", "layout");
  return { ok: `Factura ${parsed.data.invoice_number} vigilada.` };
}

export async function resolveCreditNote(id: string) {
  const { supabase } = await requireAdmin();
  const { data } = await supabase
    .from("credit_note_watch")
    .update({ resolved_at: new Date().toISOString() })
    .eq("id", id)
    .select("obligation_id")
    .single();
  await completeObligation(supabase, data?.obligation_id ?? null);
  revalidatePath("/", "layout");
}

/** RF-27: registra el pago y lo concilia con las facturas elegidas. */
export async function saveFavoritaPayment(_: FormState, formData: FormData): Promise<FormState> {
  const amount = Number(String(formData.get("amount") ?? "").replace(/\s|\$/g, "").replace(",", "."));
  const received_on = String(formData.get("received_on") ?? "");
  const ids = formData.getAll("order_id").map(String);
  if (!Number.isFinite(amount) || amount <= 0) return { error: "Escribe el monto recibido." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(received_on)) return { error: "Elige la fecha del pago." };
  if (!ids.length) return { error: "Elige las facturas que cubre este pago." };

  const { supabase } = await requireAdmin();
  const { data: orders } = await supabase.from("purchase_orders").select("id, invoice_number, invoice_amount, delivery_at").in("id", ids).is("payment_id", null);
  const selected: InvoiceToReconcile[] = (orders ?? []).map((o) => ({ id: o.id, label: o.invoice_number, amount: Number(o.invoice_amount), date: o.delivery_at }));
  if (selected.length !== ids.length) return { error: "Alguna factura ya estaba conciliada. Recarga la página." };
  const r = reconcile(amount, selected);

  const { data: payment, error } = await supabase
    .from("favorita_payments")
    .insert({ received_on, amount, reference: String(formData.get("reference") ?? "").trim() || null })
    .select("id")
    .single();
  if (error || !payment) return { error: "No se pudo guardar el pago." };
  await supabase.from("purchase_orders").update({ payment_id: payment.id }).in("id", ids);
  revalidatePath("/cobros/favorita");
  return r.exact
    ? { ok: `Pago conciliado con ${ids.length} facturas: cuadra exacto.` }
    : { error: `Pago guardado, pero no cuadra: diferencia de $${r.diff.toFixed(2)}. Revisa el reporte de Favorita.` };
}
