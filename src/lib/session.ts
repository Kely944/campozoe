import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "./supabase/server";
import type { Profile } from "./types";

/** Usuario actual con su perfil; redirige al login si no hay sesión. */
export async function requireProfile() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("id, full_name, phone, role").eq("id", user.id).single();
  return { supabase, user, profile: profile as Profile | null, isAdmin: profile?.role === "admin" };
}
