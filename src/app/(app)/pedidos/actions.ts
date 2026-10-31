"use server";

import { revalidatePath } from "next/cache";
import type { FormState } from "@/app/actions";
import { parseSupplierOrderForm } from "@/lib/pedidos";
import { createClient } from "@/lib/supabase/server";

export async function createSupplierOrder(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = parseSupplierOrderForm(formData);
  if ("error" in parsed) return { error: parsed.error };
  const { occurrence_id, ...order } = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.from("supplier_orders").insert(order);
  if (error) return { error: "No se pudo guardar el pedido. Intenta de nuevo." };
  // El pedido cumple la tarea de hoy: se marca hecha (la BD guarda quién y cuándo).
  if (occurrence_id) await supabase.rpc("mark_done", { occurrence_id });

  revalidatePath("/pedidos");
  revalidatePath("/");
  return { ok: `Pedido de ${order.supplier} guardado.` };
}

export async function deleteSupplierOrder(id: string) {
  const supabase = await createClient();
  await supabase.from("supplier_orders").delete().eq("id", id);
  revalidatePath("/pedidos");
}
