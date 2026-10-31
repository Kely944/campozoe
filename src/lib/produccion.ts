import { DELIVERY_DAYS, type DeliveryDay, type OfferItem, type Product } from "./favorita";

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * RF-28: grano seco a remojar. Ejemplo del audio: 800 unidades × 300 g = 24 kg cocido;
 * el grano aumenta 2 veces al cocinarse → 12 kg de grano seco.
 */
export function dryGrainKg(units: number, gramsPerUnit: number, dryYield: number) {
  const cookedKg = (units * gramsPerUnit) / 1000;
  return { cookedKg: round1(cookedKg), dryKg: round1(cookedKg / dryYield) };
}

export interface GrainPlanRow {
  product: string;
  units: number;
  cookedKg: number;
  dryKg: number;
}

/** RF-28: grano a remojar por día de entrega según la oferta de la semana (solo productos con gramos y rendimiento). */
export function grainPlan(products: Product[], items: OfferItem[]) {
  const byId = new Map(products.map((p) => [p.id, p]));
  return ([3, 5] as DeliveryDay[]).map((day) => {
    const rows: GrainPlanRow[] = [];
    for (const i of items.filter((x) => x.delivery_day === day)) {
      const p = byId.get(i.product_id);
      if (!p?.grams_per_unit || !p.dry_yield) continue;
      const units = i.javas * p.units_per_java;
      rows.push({ product: p.name, units, ...dryGrainKg(units, p.grams_per_unit, Number(p.dry_yield)) });
    }
    return { day, label: DELIVERY_DAYS[day], rows, dryKg: round1(rows.reduce((s, r) => s + r.dryKg, 0)) };
  });
}

/** Bandejas de champiñón (TRA audio 3, 10:00): 150 g, 90 g y 1 kg. */
export const TRAY_GRAMS = { g150: 150, g90: 90, kg1: 1000 } as const;
export const CORCHO_KG = 14;

/**
 * RF-30: con X kg, cuántas bandejas salen. Primero las de 1 kg y 90 g que se pidan;
 * con lo que queda, bandejas de 150 g. `merma` = % que se pierde al limpiar.
 */
export function mushroomTrays(kg: number, opts: { kg1?: number; g90?: number; merma?: number } = {}) {
  const usable = Math.round(kg * 1000 * (1 - (opts.merma ?? 0) / 100));
  const kg1 = opts.kg1 ?? 0;
  const g90 = opts.g90 ?? 0;
  const reserved = kg1 * TRAY_GRAMS.kg1 + g90 * TRAY_GRAMS.g90;
  if (reserved > usable) return { error: `No alcanza: esas bandejas necesitan ${round1(reserved / 1000)} kg y hay ${round1(usable / 1000)} kg.` } as const;
  const rest = usable - reserved;
  return {
    usableKg: round1(usable / 1000),
    kg1,
    g90,
    g150: Math.floor(rest / TRAY_GRAMS.g150),
    leftoverG: rest % TRAY_GRAMS.g150,
    // Referencia: si todo fuera de un solo tamaño
    only: {
      g150: Math.floor(usable / TRAY_GRAMS.g150),
      g90: Math.floor(usable / TRAY_GRAMS.g90),
      kg1: Math.floor(usable / TRAY_GRAMS.kg1),
    },
  } as const;
}
