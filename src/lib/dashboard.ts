// Cálculos del panel de administración: funciones puras, sin acceso a la base de datos.
import { WEEKDAY_LABELS } from "./obligation-form";
import { DAY, fromLocal, toLocal } from "./time";

export type Period = 7 | 30 | 90;

export function parsePeriod(raw: string | string[] | undefined): Period {
  const n = Number(Array.isArray(raw) ? raw[0] : raw);
  return n === 7 || n === 90 ? n : 30;
}

const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const pad = (n: number) => String(n).padStart(2, "0");

export interface Bucket {
  key: string; // fecha local "YYYY-MM-DD" del inicio
  label: string;
  start: Date;
  end: Date; // exclusivo
}

/** Grupos del periodo: por día (7 y 30) o por semana lunes–domingo (90), en hora de Ecuador. */
export function buildBuckets(period: Period, now: Date): Bucket[] {
  const today = toLocal(now);
  let start = fromLocal(today.year, today.month, today.day - (period - 1));
  const step = period === 90 ? 7 * DAY : DAY;
  if (period === 90) {
    const weekday = toLocal(start).weekday;
    start = new Date(start.getTime() - ((weekday + 6) % 7) * DAY);
  }
  const end = fromLocal(today.year, today.month, today.day + 1);

  const buckets: Bucket[] = [];
  for (let t = start.getTime(); t < end.getTime(); t += step) {
    const p = toLocal(new Date(t));
    buckets.push({
      key: `${p.year}-${pad(p.month)}-${pad(p.day)}`,
      label: period === 90 ? `${p.day} ${MONTHS[p.month - 1]}` : `${WEEKDAY_LABELS[p.weekday]} ${p.day}`,
      start: new Date(t),
      end: new Date(t + step),
    });
  }
  return buckets;
}

/** Clave del grupo que contiene la fecha, o null si está fuera del periodo. */
export function bucketKeyFor(date: Date, buckets: Bucket[]): string | null {
  const t = date.getTime();
  return buckets.find((b) => t >= b.start.getTime() && t < b.end.getTime())?.key ?? null;
}

/** Lee todas las filas por páginas (Supabase devuelve como máximo 1000 por consulta). */
export async function fetchAll<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
  size = 1000,
): Promise<T[]> {
  const all: T[] = [];
  for (let from = 0; ; from += size) {
    const { data, error } = await page(from, from + size - 1);
    if (error) throw error;
    all.push(...(data ?? []));
    if (!data || data.length < size) return all;
  }
}
