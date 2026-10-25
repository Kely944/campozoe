// Ecuador (America/Guayaquil) es UTC-5 todo el año, sin horario de verano.
export const TZ = "America/Guayaquil";
const OFFSET_MS = 5 * 60 * 60 * 1000;
export const MINUTE = 60 * 1000;
export const DAY = 24 * 60 * MINUTE;

export interface LocalParts {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
  weekday: number; // 0 = domingo
}

export function toLocal(date: Date): LocalParts {
  const d = new Date(date.getTime() - OFFSET_MS);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    hour: d.getUTCHours(),
    minute: d.getUTCMinutes(),
    weekday: d.getUTCDay(),
  };
}

export function fromLocal(year: number, month: number, day: number, hour = 0, minute = 0): Date {
  return new Date(Date.UTC(year, month - 1, day, hour, minute) + OFFSET_MS);
}

/** "2026-10-24T19:00" (hora local) -> Date */
export function parseLocalDateTime(value: string): Date {
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) throw new Error(`Fecha inválida: ${value}`);
  return fromLocal(+m[1], +m[2], +m[3], +m[4], +m[5]);
}

/** Date -> "2026-10-24T19:00" en hora local, para inputs datetime-local */
export function formatLocalInput(date: Date): string {
  const p = toLocal(date);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

/** "19:00" o "19:00:00" -> { hour, minute } */
export function parseTime(value: string): { hour: number; minute: number } {
  const [h, m] = value.split(":").map(Number);
  return { hour: h, minute: m };
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

const fmt = new Intl.DateTimeFormat("es-EC", {
  timeZone: TZ,
  weekday: "long",
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** "miércoles, 29 de octubre, 19:00" */
export function formatDue(date: Date): string {
  return fmt.format(date);
}

/** "en 3 h", "en 2 días", "hace 40 min" */
export function relative(due: Date, now: Date): string {
  const diff = due.getTime() - now.getTime();
  const abs = Math.abs(diff);
  let text: string;
  if (abs < 60 * MINUTE) text = `${Math.max(1, Math.round(abs / MINUTE))} min`;
  else if (abs < DAY) text = `${Math.round(abs / (60 * MINUTE))} h`;
  else {
    const days = Math.round(abs / DAY);
    text = `${days} ${days === 1 ? "día" : "días"}`;
  }
  return diff >= 0 ? `en ${text}` : `hace ${text}`;
}
