import { DAY, MINUTE, daysInMonth, fromLocal, parseTime, toLocal } from "./time";

export type Frequency = "once" | "daily" | "weekly" | "monthly";

export interface ObligationRule {
  frequency: Frequency;
  due_at: string | null; // solo "once" (ISO)
  time_of_day: string | null; // "HH:MM", hora local
  weekdays: number[] | null; // 0 = domingo; "daily" y "weekly"
  day_of_month: number | null; // "monthly"; si el mes es más corto se usa el último día
  starts_on: string; // "YYYY-MM-DD"
}

/** Fechas de vencimiento de una obligación dentro de [from, to]. */
export function generateOccurrences(rule: ObligationRule, from: Date, to: Date): Date[] {
  if (rule.frequency === "once") {
    if (!rule.due_at) return [];
    const due = new Date(rule.due_at);
    return due >= from && due <= to ? [due] : [];
  }
  if (!rule.time_of_day) return [];
  const { hour, minute } = parseTime(rule.time_of_day);
  const [sy, sm, sd] = rule.starts_on.split("-").map(Number);
  const start = fromLocal(sy, sm, sd);
  const weekdays = rule.weekdays?.length ? rule.weekdays : [0, 1, 2, 3, 4, 5, 6];

  const result: Date[] = [];
  const first = toLocal(from);
  // Recorre día por día en hora local, desde el día de `from` hasta pasar `to`.
  for (let t = fromLocal(first.year, first.month, first.day).getTime(); t <= to.getTime(); t += DAY) {
    const day = toLocal(new Date(t));
    const due = fromLocal(day.year, day.month, day.day, hour, minute);
    if (due < from || due > to || due < start) continue;

    if (rule.frequency === "monthly") {
      if (!rule.day_of_month) return [];
      const target = Math.min(rule.day_of_month, daysInMonth(day.year, day.month));
      if (day.day === target) result.push(due);
    } else if (weekdays.includes(day.weekday)) {
      result.push(due);
    }
  }
  return result;
}

export type NotificationKind = "reminder" | "repeat" | "escalation" | "overdue";

export interface SentNotification {
  slot: string;
  recipientId: string;
  sentAt: Date;
}

export interface PlanInput {
  now: Date;
  dueAt: Date;
  status: "pending" | "done";
  offsetsMin: number[]; // minutos antes del vencimiento
  repeatEveryMin: number | null;
  escalateBeforeMin: number | null;
  responsibleId: string | null;
  backupId: string | null;
  sent: SentNotification[];
  quietHours?: { start: number; end: number } | null; // horas locales sin avisos
}

export interface PlannedNotification {
  slot: string;
  recipientId: string;
  kind: NotificationKind;
}

export const DEFAULT_QUIET_HOURS = { start: 21, end: 7 };

function inQuietHours(now: Date, quiet: { start: number; end: number }): boolean {
  const h = toLocal(now).hour;
  return quiet.start > quiet.end ? h >= quiet.start || h < quiet.end : h >= quiet.start && h < quiet.end;
}

/**
 * Decide qué avisos enviar ahora para una ocurrencia. Cada aviso tiene un `slot`
 * único por destinatario: si ya se envió, no se repite.
 */
export function planNotifications(input: PlanInput): PlannedNotification[] {
  const { now, dueAt, responsibleId, backupId, sent } = input;
  if (input.status === "done" || !responsibleId) return [];
  const quiet = input.quietHours === undefined ? DEFAULT_QUIET_HOURS : input.quietHours;
  if (quiet && inQuietHours(now, quiet)) return [];

  const wasSent = (slot: string, recipientId: string) =>
    sent.some((s) => s.slot === slot && s.recipientId === recipientId);
  const plan: PlannedNotification[] = [];
  const minutesLeft = (dueAt.getTime() - now.getTime()) / MINUTE;

  if (minutesLeft <= 0) {
    for (const id of [responsibleId, backupId]) {
      if (id && !wasSent("overdue", id)) plan.push({ slot: "overdue", recipientId: id, kind: "overdue" });
    }
    return plan;
  }

  // Recordatorio: solo el más cercano ya alcanzado (si la tarea se creó tarde no llegan todos juntos).
  const reached = input.offsetsMin.filter((o) => minutesLeft <= o);
  if (reached.length) {
    const slot = `reminder:${Math.min(...reached)}`;
    if (!wasSent(slot, responsibleId)) plan.push({ slot, recipientId: responsibleId, kind: "reminder" });
  }

  // Repetición: cada N minutos desde el primer recordatorio, hasta que se marque hecha.
  const mine = sent.filter((s) => s.recipientId === responsibleId);
  const firstReminder = mine
    .filter((s) => s.slot.startsWith("reminder:"))
    .reduce<Date | null>((min, s) => (!min || s.sentAt < min ? s.sentAt : min), null);
  if (input.repeatEveryMin && firstReminder && plan.length === 0) {
    const last = Math.max(...mine.map((s) => s.sentAt.getTime()));
    const every = input.repeatEveryMin * MINUTE;
    if (now.getTime() - last >= every) {
      const n = Math.floor((now.getTime() - firstReminder.getTime()) / every);
      const slot = `repeat:${n}`;
      if (!wasSent(slot, responsibleId)) plan.push({ slot, recipientId: responsibleId, kind: "repeat" });
    }
  }

  // Escalamiento al respaldo si sigue pendiente cerca del plazo.
  if (input.escalateBeforeMin && backupId && minutesLeft <= input.escalateBeforeMin && !wasSent("escalation", backupId)) {
    plan.push({ slot: "escalation", recipientId: backupId, kind: "escalation" });
  }
  return plan;
}
