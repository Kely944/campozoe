"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { FormState } from "@/app/actions";
import {
  capacityByDay,
  deliveryObligation,
  invoiceObligation,
  parseOfferItems,
  parseProductForm,
  parsePurchaseOrderForm,
  weekStart,
  type DeliveryDay,
} from "@/lib/favorita";
import { completeObligation, upsertObligation } from "@/lib/obligations";
import { requireAdmin } from "@/lib/session";

const DENIED = "No se pudo guardar. Solo la administradora puede usar Favorita.";

export async function saveSettings(_: FormState, formData: FormData): Promise<FormState> {
  const { supabase } = await requireAdmin();
  const capacity = Number(formData.get("van_capacity"));
  if (!Number.isInteger(capacity) || capacity <= 0) return { error: "La capacidad de la buseta debe ser un número de javas." };
  const { error } = await supabase
    .from("app_settings")
    .update({
      supplier_code: String(formData.get("supplier_code") ?? "").trim() || null,
      acopio: String(formData.get("acopio") ?? "").trim() || "CAF 400 (Loja)",
      van_capacity: capacity,
    })
    .eq("id", 1);
  if (error) return { error: DENIED };
  revalidatePath("/favorita", "layout");
  return { ok: "Datos guardados." };
}

export async function saveProduct(id: string | null, _: FormState, formData: FormData): Promise<FormState> {
  const parsed = parseProductForm(formData);
  if ("error" in parsed) return { error: parsed.error };
  const { supabase } = await requireAdmin();
  const { error } = id
    ? await supabase.from("favorita_products").update(parsed.data).eq("id", id)
    : await supabase.from("favorita_products").insert(parsed.data);
  if (error) return { error: DENIED };
  revalidatePath("/favorita", "layout");
  return { ok: `${parsed.data.name} guardado.` };
}

/** RF-08/10/11: enlace y javas de la semana. Conserva lo ya marcado como enviado. */
export async function saveOffer(week: string, _: FormState, formData: FormData): Promise<FormState> {
  if (weekStart(week) !== week) return { error: "Semana inválida." };
  const { supabase } = await requireAdmin();
  const { data: products } = await supabase.from("favorita_products").select("id");
  const parsed = parseOfferItems(formData, (products ?? []).map((p) => p.id));
  if ("error" in parsed) return { error: parsed.error };

  const link = String(formData.get("link") ?? "").trim() || null;
  if (link && !/^https?:\/\//.test(link)) return { error: "El enlace debe empezar con https://" };
  const { data: offer, error } = await supabase
    .from("favorita_offers")
    .upsert({ week_start: week, link }, { onConflict: "week_start" })
    .select("id")
    .single();
  if (error || !offer) return { error: DENIED };

  const { data: existing } = await supabase.from("favorita_offer_items").select("product_id, delivery_day").eq("offer_id", offer.id);
  const keep = new Set(parsed.items.map((i) => `${i.product_id}_${i.delivery_day}`));
  for (const e of existing ?? []) {
    if (!keep.has(`${e.product_id}_${e.delivery_day}`)) {
      await supabase.from("favorita_offer_items").delete().eq("offer_id", offer.id).eq("product_id", e.product_id).eq("delivery_day", e.delivery_day);
    }
  }
  if (parsed.items.length) {
    const { error: e2 } = await supabase
      .from("favorita_offer_items")
      .upsert(parsed.items.map((i) => ({ ...i, offer_id: offer.id })), { onConflict: "offer_id,product_id,delivery_day" });
    if (e2) return { error: DENIED };
  }

  const { data: settings } = await supabase.from("app_settings").select("van_capacity").single();
  const over = capacityByDay(parsed.items, settings?.van_capacity ?? 100).filter((c) => c.over);
  revalidatePath("/favorita");
  return over.length
    ? { error: `Oferta guardada, pero el ${over.map((c) => `${c.label.toLowerCase()} (${c.javas} javas)`).join(" y el ")} no entra en la buseta.` }
    : { ok: "Oferta guardada." };
}

export async function setOfferItemSent(offerId: string, productId: string, day: DeliveryDay, sent: boolean) {
  const { supabase } = await requireAdmin();
  await supabase.from("favorita_offer_items").update({ sent }).eq("offer_id", offerId).eq("product_id", productId).eq("delivery_day", day);
  revalidatePath("/favorita");
}

/** RF-12: orden de compra con su aviso previo a la entrega. */
export async function createPurchaseOrder(_: FormState, formData: FormData): Promise<FormState> {
  const { supabase } = await requireAdmin();
  const { data: products } = await supabase.from("favorita_products").select("id");
  const parsed = parsePurchaseOrderForm(formData, (products ?? []).map((p) => p.id));
  if ("error" in parsed) return { error: parsed.error };
  const { items, ...order } = parsed.data;

  const { data: po, error } = await supabase.from("purchase_orders").insert(order).select("id").single();
  if (error || !po) return { error: DENIED };
  const { error: e2 } = await supabase.from("purchase_order_items").insert(items.map((i) => ({ ...i, order_id: po.id })));
  if (e2) {
    await supabase.from("purchase_orders").delete().eq("id", po.id);
    return { error: DENIED };
  }
  const res = await upsertObligation(supabase, null, { ...deliveryObligation(order), source: "orden" });
  if (!("error" in res)) await supabase.from("purchase_orders").update({ delivery_obligation_id: res.obligation.id }).eq("id", po.id);

  revalidatePath("/", "layout");
  redirect("/favorita");
}

/** RF-13: entregada → si no tiene factura, se crea el aviso para facturar hoy. */
export async function markDelivered(id: string) {
  const { supabase, user } = await requireAdmin();
  const { data: po } = await supabase.from("purchase_orders").select("*").eq("id", id).single();
  if (!po || po.delivered_at) return;
  const now = new Date();
  await supabase.from("purchase_orders").update({ delivered_at: now.toISOString() }).eq("id", id);
  await completeObligation(supabase, po.delivery_obligation_id);
  if (!po.invoice_number) {
    const res = await upsertObligation(supabase, null, { ...invoiceObligation(po, now, user.id), source: "factura" }, now);
    if (!("error" in res)) await supabase.from("purchase_orders").update({ invoice_obligation_id: res.obligation.id }).eq("id", id);
  }
  revalidatePath("/", "layout");
}

export async function registerInvoice(id: string, _: FormState, formData: FormData): Promise<FormState> {
  const number = String(formData.get("invoice_number") ?? "").trim();
  const amount = Number(String(formData.get("invoice_amount") ?? "").replace(/\s|\$/g, "").replace(",", "."));
  if (!number) return { error: "Escribe el número de factura." };
  if (!Number.isFinite(amount) || amount <= 0) return { error: "Escribe el total de la factura." };
  const { supabase } = await requireAdmin();
  const { data: po, error } = await supabase
    .from("purchase_orders")
    .update({ invoice_number: number, invoice_amount: Math.round(amount * 100) / 100, invoiced_at: new Date().toISOString() })
    .eq("id", id)
    .select("invoice_obligation_id")
    .single();
  if (error || !po) return { error: DENIED };
  await completeObligation(supabase, po.invoice_obligation_id);
  revalidatePath("/", "layout");
  return { ok: `Factura ${number} registrada.` };
}
