import type { ObligationInput } from "./obligation-form";
import { addDays, fromLocal, localDate, parseLocalDateTime, toLocal, weekdayOf } from "./time";

/** Favorita solo recibe entregas miércoles y viernes (TRA audio 1, 02:00). */
export const DELIVERY_DAYS = { 3: "Miércoles", 5: "Viernes" } as const;
export type DeliveryDay = 3 | 5;

export interface FavoritaSettings {
  supplier_code: string | null;
  acopio: string;
  van_capacity: number; // javas por viaje de la buseta (RF-11)
}

export interface Product {
  id: string;
  name: string;
  barcode: string | null;
  product_code: string | null;
  units_per_java: number;
  grams_per_unit: number | null; // M6: gramos de producto cocido por unidad
  dry_yield: number | null; // M6: cuántas veces aumenta el grano al cocinarse
  active: boolean;
}

export interface OfferItem {
  product_id: string;
  delivery_day: DeliveryDay;
  javas: number;
  sent?: boolean;
}

/** Lunes de la semana de una fecha "YYYY-MM-DD". */
export function weekStart(dateStr: string): string {
  return addDays(dateStr, -((weekdayOf(dateStr) + 6) % 7));
}

/** Número de semana ISO ("orden de pedido para la semana 43"). */
export function isoWeek(dateStr: string): { year: number; week: number } {
  const thursday = addDays(weekStart(dateStr), 3);
  const year = Number(thursday.slice(0, 4));
  const jan4 = `${year}-01-04`;
  const week = 1 + Math.round((Date.parse(thursday) - Date.parse(weekStart(jan4))) / (7 * 86400000));
  return { year, week };
}

/** RF-08: el enlace se cierra el miércoles a las 19:00 de la semana. */
export function offerDeadline(week: string): Date {
  const [y, m, d] = addDays(week, 2).split("-").map(Number);
  return fromLocal(y, m, d, 19);
}

/** Semana de oferta que toca ahora: la actual, o la siguiente si ya cerró el miércoles 19:00. */
export function currentOfferWeek(now: Date): string {
  const week = weekStart(localDate(now));
  return offerDeadline(week) < now ? addDays(week, 7) : week;
}

/** RF-11: javas por día de entrega y si superan la capacidad de la buseta. */
export function capacityByDay(items: OfferItem[], capacity: number) {
  return ([3, 5] as DeliveryDay[]).map((day) => {
    const javas = items.filter((i) => i.delivery_day === day).reduce((s, i) => s + i.javas, 0);
    return { day, label: DELIVERY_DAYS[day], javas, over: javas > capacity, free: capacity - javas };
  });
}

/** RF-10: texto listo para pegar en el formulario de un producto. */
export function offerCopyText(p: Product, item: OfferItem, s: FavoritaSettings): string {
  return [
    `Código de proveedor: ${s.supplier_code ?? "(falta en Productos)"}`,
    `Centro de acopio: ${s.acopio}`,
    `Código de barras: ${p.barcode ?? "(falta)"}`,
    `Producto: ${p.name}`,
    `Javas: ${item.javas}`,
    `Día de entrega: ${DELIVERY_DAYS[item.delivery_day]}`,
  ].join("\n");
}

type FormLike = { get(name: string): FormDataEntryValue | null; getAll?(name: string): FormDataEntryValue[] };
const str = (f: FormLike, name: string) => String(f.get(name) ?? "").trim();
const posInt = (raw: string) => (/^\d+$/.test(raw) ? Number(raw) : NaN);

/** Javas de la oferta: campos `javas_<productoId>_<día>`; vacío o 0 = no se oferta. */
export function parseOfferItems(f: FormLike, productIds: string[]): { items: OfferItem[] } | { error: string } {
  const items: OfferItem[] = [];
  for (const id of productIds) {
    for (const day of [3, 5] as DeliveryDay[]) {
      const raw = str(f, `javas_${id}_${day}`);
      if (!raw) continue;
      const javas = posInt(raw);
      if (Number.isNaN(javas)) return { error: "Las javas deben ser números enteros." };
      if (javas > 0) items.push({ product_id: id, delivery_day: day, javas });
    }
  }
  return { items };
}

export function parseProductForm(f: FormLike): { data: Omit<Product, "id"> } | { error: string } {
  const name = str(f, "name");
  if (!name) return { error: "Escribe el nombre del producto." };
  const units = posInt(str(f, "units_per_java") || "0");
  if (!units) return { error: "Escribe cuántas unidades van en una java." };
  const grams = str(f, "grams_per_unit") ? posInt(str(f, "grams_per_unit")) : null;
  if (Number.isNaN(grams)) return { error: "Los gramos por unidad deben ser un número entero." };
  const yieldRaw = str(f, "dry_yield").replace(",", ".");
  const dry_yield = yieldRaw ? Number(yieldRaw) : null;
  if (dry_yield !== null && !(dry_yield >= 1)) return { error: "El rendimiento debe ser 1 o más (ej. 2 si el grano duplica su peso)." };
  return {
    data: {
      name,
      barcode: str(f, "barcode") || null,
      product_code: str(f, "product_code") || null,
      units_per_java: units,
      grams_per_unit: grams,
      dry_yield,
      active: f.get("active") === "on",
    },
  };
}

export interface PurchaseOrderInput {
  year: number;
  week: number;
  delivery_at: string; // ISO
  driver_id: string | null;
  notes: string | null;
  items: { product_id: string; units: number }[];
}

/** RF-12: orden de compra recibida (semana, productos, unidades) y hora de entrega asignada. */
export function parsePurchaseOrderForm(f: FormLike, productIds: string[]): { data: PurchaseOrderInput } | { error: string } {
  const week = posInt(str(f, "week"));
  if (!(week >= 1 && week <= 53)) return { error: "Escribe el número de semana de la orden (1 a 53)." };
  const deliveryLocal = str(f, "delivery_local");
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(deliveryLocal)) return { error: "Elige el día y la hora de entrega asignados." };
  const delivery = parseLocalDateTime(deliveryLocal);
  const items: { product_id: string; units: number }[] = [];
  for (const id of productIds) {
    const raw = str(f, `units_${id}`);
    if (!raw) continue;
    const units = posInt(raw);
    if (Number.isNaN(units)) return { error: "Las unidades deben ser números enteros." };
    if (units > 0) items.push({ product_id: id, units });
  }
  if (!items.length) return { error: "Escribe las unidades de al menos un producto." };
  return {
    data: {
      year: toLocal(delivery).year,
      week,
      delivery_at: delivery.toISOString(),
      driver_id: str(f, "driver_id") || null,
      notes: str(f, "notes") || null,
      items,
    },
  };
}

const baseObligation = {
  description: null,
  frequency: "once" as const,
  time_of_day: null,
  weekdays: null,
  day_of_month: null,
  extra_day_of_month: null,
  escalate_before_min: null,
  backup_id: null,
  priority: "alta" as const,
  active: true,
};

/** RF-12: aviso previo a la entrega (Favorita no espera: si se llega tarde, no reciben). */
export function deliveryObligation(po: { week: number; delivery_at: string; driver_id: string | null }): ObligationInput {
  return {
    ...baseObligation,
    title: `Entregar orden semana ${po.week} en Favorita`,
    description: "Llegar antes de la hora asignada; si se llega tarde hay que justificar por correo o no reciben.",
    due_at: po.delivery_at,
    reminder_offsets_min: [1440, 120, 60],
    repeat_every_min: null,
    responsible_id: po.driver_id,
  };
}

/**
 * RF-13: si una orden entregada no tiene factura, avisar ese mismo día
 * (el facturador y el SRI solo autorizan facturas con fecha de hoy).
 * Vence a las 18:00 del día de entrega, o 2 h después si se entregó más tarde.
 */
export function invoiceObligation(po: { week: number }, deliveredAt: Date, responsibleId: string | null): ObligationInput {
  const p = toLocal(deliveredAt);
  const sixPm = fromLocal(p.year, p.month, p.day, 18);
  const due = deliveredAt < new Date(sixPm.getTime() - 2 * 3600_000) ? sixPm : new Date(deliveredAt.getTime() + 2 * 3600_000);
  return {
    ...baseObligation,
    title: `Facturar orden semana ${po.week} de Favorita`,
    description: "Orden entregada sin factura: sin factura no se cobra.",
    due_at: due.toISOString(),
    reminder_offsets_min: [120],
    repeat_every_min: 60,
    responsible_id: responsibleId,
  };
}
