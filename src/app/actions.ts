"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { parseObligationForm } from "@/lib/obligation-form";
import { ensureOccurrences } from "@/lib/reminders";
import { createClient } from "@/lib/supabase/server";
import type { Obligation } from "@/lib/types";

export interface FormState {
  error?: string;
}

export async function signIn(_: FormState, formData: FormData): Promise<FormState> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
  });
  if (error) return { error: "Correo o contraseña incorrectos." };
  redirect("/");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function markDone(occurrenceId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  await supabase
    .from("occurrences")
    .update({ status: "done", done_by: user?.id, done_at: new Date().toISOString(), done_via: "app" })
    .eq("id", occurrenceId);
  revalidatePath("/");
}

export async function undoDone(occurrenceId: string) {
  const supabase = await createClient();
  await supabase.from("occurrences").update({ status: "pending", done_by: null, done_at: null, done_via: null }).eq("id", occurrenceId);
  revalidatePath("/");
}

export async function saveObligation(id: string | null, _: FormState, formData: FormData): Promise<FormState> {
  const parsed = parseObligationForm(formData);
  if ("error" in parsed) return { error: parsed.error };

  const supabase = await createClient();
  const now = new Date();
  const query = id
    ? supabase.from("obligations").update({ ...parsed.data, updated_at: now.toISOString() }).eq("id", id)
    : supabase.from("obligations").insert(parsed.data);
  const { data, error } = await query.select("*").single();
  if (error) return { error: "No se pudo guardar. Solo la administradora puede editar tareas." };

  // Si cambió el horario, se rehacen los próximos vencimientos pendientes.
  if (id) await supabase.from("occurrences").delete().eq("obligation_id", id).eq("status", "pending").gt("due_at", now.toISOString());
  await ensureOccurrences(supabase, [data as Obligation], now);

  revalidatePath("/", "layout");
  redirect("/obligaciones");
}

export async function deleteObligation(id: string) {
  const supabase = await createClient();
  await supabase.from("obligations").delete().eq("id", id);
  revalidatePath("/", "layout");
  redirect("/obligaciones");
}

export async function updateProfile(id: string, _: FormState, formData: FormData): Promise<FormState> {
  const phone = String(formData.get("phone") ?? "").replace(/\D/g, "");
  if (phone && !/^593\d{9}$/.test(phone)) return { error: "Número inválido. Usa el formato 593991234567." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: String(formData.get("full_name") ?? "").trim(),
      phone: phone || null,
      role: formData.get("role") === "admin" ? "admin" : "operativo",
    })
    .eq("id", id);
  if (error) return { error: "No se pudo guardar. Solo la administradora puede editar el equipo." };
  revalidatePath("/equipo");
  return {};
}
