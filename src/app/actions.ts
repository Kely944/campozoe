"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { parseObligationForm } from "@/lib/obligation-form";
import { upsertObligation } from "@/lib/obligations";
import { createClient } from "@/lib/supabase/server";

export interface FormState {
  error?: string;
  ok?: string; // mensaje de confirmación
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
  // done_by lo fija la base de datos con el usuario de la sesión (migración 0002).
  await supabase.rpc("mark_done", { occurrence_id: occurrenceId });
  revalidatePath("/");
}

export async function undoDone(occurrenceId: string) {
  const supabase = await createClient();
  // Solo quien la marcó o una administradora (lo valida la base de datos).
  await supabase.rpc("undo_done", { occurrence_id: occurrenceId });
  revalidatePath("/");
}

export async function saveObligation(id: string | null, _: FormState, formData: FormData): Promise<FormState> {
  const parsed = parseObligationForm(formData);
  if ("error" in parsed) return { error: parsed.error };

  const supabase = await createClient();
  const res = await upsertObligation(supabase, id, parsed.data);
  if ("error" in res) return { error: res.error };

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
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Correo inválido." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: String(formData.get("full_name") ?? "").trim(),
      phone: phone || null,
      email: email || null,
      role: formData.get("role") === "admin" ? "admin" : "operativo",
    })
    .eq("id", id);
  if (error) return { error: "No se pudo guardar. Solo la administradora puede editar el equipo." };
  revalidatePath("/equipo");
  return { ok: "Guardado." };
}
