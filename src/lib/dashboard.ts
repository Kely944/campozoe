// Cálculos del panel de administración: funciones puras, sin acceso a la base de datos.
import { WEEKDAY_LABELS, minutesLabel } from "./obligation-form";
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

export const ADMIN_LABEL = "Administradora";

export type ComplianceStatus = "a_tiempo" | "tarde" | "sin_hacer";
export const COMPLIANCE_STATUSES: readonly ComplianceStatus[] = ["a_tiempo", "tarde", "sin_hacer"];

export interface OccurrenceRow {
  id: string;
  due_at: string;
  status: "pending" | "done";
  done_at: string | null;
  done_by: string | null;
  title: string;
  responsible_id: string | null;
}

export interface ComplianceItem {
  id: string;
  title: string;
  dueAt: string;
  personId: string | null;
  personName: string;
  status: ComplianceStatus;
  doneByName: string | null;
  doneAt: string | null;
  bucketKey: string;
}

/** Ocurrencias con plazo ya pasado dentro del periodo: a tiempo, tarde o sin hacer. */
export function classifyCompliance(
  rows: OccurrenceRow[],
  names: Map<string, string>,
  buckets: Bucket[],
  now: Date,
): ComplianceItem[] {
  const items: ComplianceItem[] = [];
  for (const r of rows) {
    const due = new Date(r.due_at);
    if (due >= now) continue;
    const bucketKey = bucketKeyFor(due, buckets);
    if (!bucketKey) continue;
    const done = r.status === "done";
    items.push({
      id: r.id,
      title: r.title,
      dueAt: r.due_at,
      personId: r.responsible_id,
      personName: r.responsible_id ? (names.get(r.responsible_id) ?? ADMIN_LABEL) : ADMIN_LABEL,
      status: !done ? "sin_hacer" : new Date(r.done_at ?? r.due_at) <= due ? "a_tiempo" : "tarde",
      doneByName: done ? (names.get(r.done_by ?? "") ?? "Alguien") : null,
      doneAt: done ? r.done_at : null,
      bucketKey,
    });
  }
  return items.sort((a, b) => b.dueAt.localeCompare(a.dueAt));
}

export type NoticeStatus = "enviado" | "simulado" | "fallido";
export const NOTICE_STATUSES: readonly NoticeStatus[] = ["enviado", "simulado", "fallido"];

export interface NotificationRow {
  occurrence_id: string;
  recipient_id: string;
  slot: string;
  status: "sending" | "sent" | "simulated";
  sent_at: string;
}

export interface FailureRow {
  occurrence_id: string;
  recipient_id: string;
  slot: string;
  error: string;
  failed_at: string;
}

export interface NoticeItem {
  key: string;
  occurrenceId: string;
  title: string;
  slotLabel: string;
  personId: string;
  personName: string;
  status: NoticeStatus;
  at: string;
  lastError: string | null;
  attempts: number;
  bucketKey: string;
}

/** "reminder:1440" -> "Aviso 1 día antes" */
export function slotLabel(slot: string): string {
  if (slot.startsWith("reminder:")) return `Aviso ${minutesLabel(Number(slot.slice(9)))} antes`;
  if (slot.startsWith("repeat:")) return "Repetición";
  if (slot === "escalation") return "Aviso al respaldo";
  if (slot === "overdue") return "Vencida";
  return slot;
}

/**
 * Un aviso es (ocurrencia, slot, destinatario) y cuenta una sola vez: enviado o simulado
 * si salió (aunque antes fallara), fallido si solo tiene fallos.
 */
export function classifyNotifications(
  sent: NotificationRow[],
  failures: FailureRow[],
  titles: Map<string, string>,
  names: Map<string, string>,
  buckets: Bucket[],
): NoticeItem[] {
  const keyOf = (r: { occurrence_id: string; slot: string; recipient_id: string }) =>
    `${r.occurrence_id}|${r.slot}|${r.recipient_id}`;
  const delivered = new Map(sent.filter((s) => s.status !== "sending").map((s) => [keyOf(s), s]));
  const failed = new Map<string, FailureRow[]>();
  for (const f of failures) failed.set(keyOf(f), [...(failed.get(keyOf(f)) ?? []), f]);

  const items: NoticeItem[] = [];
  for (const key of new Set([...delivered.keys(), ...failed.keys()])) {
    const ok = delivered.get(key);
    const fails = failed.get(key) ?? [];
    const last = fails.reduce<FailureRow | null>((a, f) => (!a || f.failed_at > a.failed_at ? f : a), null);
    const base = ok ?? last!;
    const at = ok ? ok.sent_at : last!.failed_at;
    const bucketKey = bucketKeyFor(new Date(at), buckets);
    if (!bucketKey) continue;
    items.push({
      key,
      occurrenceId: base.occurrence_id,
      title: titles.get(base.occurrence_id) ?? "Tarea eliminada",
      slotLabel: slotLabel(base.slot),
      personId: base.recipient_id,
      personName: names.get(base.recipient_id) ?? "Alguien",
      status: ok ? (ok.status === "sent" ? "enviado" : "simulado") : "fallido",
      at,
      lastError: ok ? null : last!.error,
      attempts: ok ? 0 : fails.length,
      bucketKey,
    });
  }
  return items.sort((a, b) => b.at.localeCompare(a.at));
}
