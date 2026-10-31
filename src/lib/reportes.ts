import { CORCHO_KG } from "./produccion";
import { addDays, weekdayOf } from "./time";

export interface SaleRow {
  sold_on: string;
  customer: string;
  product: string;
  units: number;
  amount: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Coincide sin importar tildes ni mayúsculas: "champi" encuentra "CHAMPIÑÓN". */
export function matchesProduct(product: string, filter: string): boolean {
  return !filter.trim() || fold(product).includes(fold(filter.trim()));
}

/** RF-31: ventas por cliente (de mayor a menor) y por mes en un periodo. */
export function salesReport(rows: SaleRow[], filter: string) {
  const sel = rows.filter((r) => matchesProduct(r.product, filter));
  const byCustomer = new Map<string, { customer: string; units: number; amount: number }>();
  const byMonth = new Map<string, { month: string; units: number; amount: number }>();
  for (const r of sel) {
    const key = fold(r.customer).replace(/\s+/g, " ").trim();
    const c = byCustomer.get(key) ?? { customer: r.customer, units: 0, amount: 0 };
    c.units += Number(r.units);
    c.amount = round2(c.amount + Number(r.amount));
    byCustomer.set(key, c);
    const month = r.sold_on.slice(0, 7);
    const m = byMonth.get(month) ?? { month, units: 0, amount: 0 };
    m.units += Number(r.units);
    m.amount = round2(m.amount + Number(r.amount));
    byMonth.set(month, m);
  }
  return {
    customers: [...byCustomer.values()].sort((a, b) => b.units - a.units || b.amount - a.amount),
    months: [...byMonth.values()].sort((a, b) => a.month.localeCompare(b.month)),
    units: sel.reduce((s, r) => s + Number(r.units), 0),
    amount: round2(sel.reduce((s, r) => s + Number(r.amount), 0)),
  };
}

/** Peso de una bandeja según el nombre del producto: "150 G", "90g", "1 KG", "kilo". null si no se reconoce. */
export function trayKg(product: string): number | null {
  const s = fold(product);
  const g = s.match(/(\d+(?:[.,]\d+)?)\s*(g|gr|grs|gramos)\b/);
  if (g) return Number(g[1].replace(",", ".")) / 1000;
  const kg = s.match(/(\d+(?:[.,]\d+)?)\s*(kg|kilo|kilos)\b/);
  if (kg) return Number(kg[1].replace(",", "."));
  if (/\bkilo\b/.test(s)) return 1;
  return null;
}

/**
 * RF-33: corchos de champiñón sugeridos para un día de entrega, según lo vendido
 * los mismos días de la semana en las últimas `weeks` semanas.
 * Una entrega del sábado cubre sábado y domingo (no hay entrega el domingo).
 * ponytail: promedio simple sin tendencia ni feriados; mejorar cuando haya más historial.
 */
export function suggestCorchos(rows: SaleRow[], forDate: string, weeks = 8) {
  const wd = weekdayOf(forDate);
  const covered = wd === 6 ? [6, 0] : [wd];
  const from = addDays(forDate, -7 * weeks);
  let kg = 0;
  for (const r of rows) {
    if (r.sold_on < from || r.sold_on >= forDate || !covered.includes(weekdayOf(r.sold_on))) continue;
    if (!matchesProduct(r.product, "champi")) continue;
    const size = trayKg(r.product);
    if (size) kg += size * Number(r.units);
  }
  if (kg === 0) return null;
  const avgKg = Math.round((kg / weeks) * 10) / 10;
  return { avgKg, corchos: Math.max(1, Math.ceil(avgKg / CORCHO_KG)), weeks };
}
