"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { FormState } from "@/app/actions";
import { upsertObligation } from "@/lib/obligations";
import { CHEQUE_STATUS, parseChequeForm, parsePaymentForm, paymentObligation, type ChequeStatus } from "@/lib/pagos";
import { requireProfile } from "@/lib/session";

/** RF-15/16: guarda el pago y su tarea mensual de aviso. Solo administradora (RLS). */
export async function savePayment(id: string | null, _: FormState, formData: FormData): Promise<FormState> {
  const parsed = parsePaymentForm(formData);
  if ("error" in parsed) return { error: parsed.error };
  const { supabase, user } = await requireProfile();

  const query = id ? supabase.from("payments").update(parsed.data).eq("id", id) : supabase.from("payments").insert(parsed.data);
  const { data: payment, error } = await query.select("id, obligation_id").single();
  if (error || !payment) return { error: "No se pudo guardar. Solo la administradora puede registrar pagos." };

  const res = await upsertObligation(supabase, payment.obligation_id, { ...paymentObligation(parsed.data, user.id), source: "pago" });
  if ("error" in res) return { error: res.error };
  if (!payment.obligation_id) await supabase.from("payments").update({ obligation_id: res.obligation.id }).eq("id", payment.id);

  revalidatePath("/", "layout");
  redirect("/pagos");
}

export async function deletePayment(id: string) {
  const { supabase } = await requireProfile();
  const { data } = await supabase.from("payments").select("obligation_id").eq("id", id).maybeSingle();
  await supabase.from("payments").delete().eq("id", id);
  if (data?.obligation_id) await supabase.from("obligations").delete().eq("id", data.obligation_id);
  revalidatePath("/", "layout");
  redirect("/pagos");
}

/** RF-18 */
export async function createCheque(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = parseChequeForm(formData);
  if ("error" in parsed) return { error: parsed.error };
  const { supabase } = await requireProfile();
  const { error } = await supabase.from("cheques").insert(parsed.data);
  if (error) return { error: "No se pudo guardar. Solo la administradora puede registrar cheques." };
  revalidatePath("/pagos");
  return { ok: `Cheque ${parsed.data.number} registrado.` };
}

export async function setChequeStatus(id: string, status: ChequeStatus) {
  if (!(status in CHEQUE_STATUS)) return;
  const { supabase } = await requireProfile();
  await supabase.from("cheques").update({ status }).eq("id", id);
  revalidatePath("/pagos");
}
