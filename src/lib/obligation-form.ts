import type { Frequency } from "./schedule";
import { parseLocalDateTime } from "./time";

export const WEEKDAY_LABELS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

export const OFFSET_OPTIONS = [
  { value: 4320, label: "3 días antes" },
  { value: 2880, label: "2 días antes" },
  { value: 1440, label: "1 día antes" },
  { value: 960, label: "16 horas antes" },
  { value: 240, label: "4 horas antes" },
  { value: 120, label: "2 horas antes" },
  { value: 60, label: "1 hora antes" },
  { value: 30, label: "30 minutos antes" },
];

export const REPEAT_OPTIONS = [20, 30, 60, 120, 240];
export const ESCALATE_OPTIONS = [30, 45, 60, 120, 240, 1440];

export const FREQUENCY_LABELS: Record<Frequency, string> = {
  once: "Una sola vez",
  daily: "Diaria",
  weekly: "Semanal",
  monthly: "Mensual",
};

export function minutesLabel(min: number): string {
  if (min % 1440 === 0) return `${min / 1440} ${min === 1440 ? "día" : "días"}`;
  if (min % 60 === 0) return `${min / 60} h`;
  return `${min} min`;
}

export interface ObligationInput {
  title: string;
  description: string | null;
  frequency: Frequency;
  due_at: string | null;
  time_of_day: string | null;
  weekdays: number[] | null;
  day_of_month: number | null;
  reminder_offsets_min: number[];
  repeat_every_min: number | null;
  escalate_before_min: number | null;
  responsible_id: string | null;
  backup_id: string | null;
  priority: "normal" | "alta";
  active: boolean;
}

type FormLike = { get(name: string): FormDataEntryValue | null; getAll(name: string): FormDataEntryValue[] };

const str = (f: FormLike, name: string) => String(f.get(name) ?? "").trim();
const optInt = (f: FormLike, name: string) => (str(f, name) ? Number(str(f, name)) : null);

/** Convierte el formulario en una fila de `obligations`, o devuelve el error a mostrar. */
export function parseObligationForm(f: FormLike): { data: ObligationInput } | { error: string } {
  const title = str(f, "title");
  if (!title) return { error: "Escribe un nombre para la tarea." };

  const frequency = str(f, "frequency") as Frequency;
  if (!["once", "daily", "weekly", "monthly"].includes(frequency)) return { error: "Elige la frecuencia." };

  const data: ObligationInput = {
    title,
    description: str(f, "description") || null,
    frequency,
    due_at: null,
    time_of_day: null,
    weekdays: null,
    day_of_month: null,
    reminder_offsets_min: f.getAll("offsets").map(Number).filter((n) => n > 0).sort((a, b) => b - a),
    repeat_every_min: optInt(f, "repeat_every_min"),
    escalate_before_min: optInt(f, "escalate_before_min"),
    responsible_id: str(f, "responsible_id") || null,
    backup_id: str(f, "backup_id") || null,
    priority: str(f, "priority") === "alta" ? "alta" : "normal",
    active: f.get("active") === "on",
  };

  if (!data.reminder_offsets_min.length) return { error: "Elige al menos un aviso." };
  if (data.backup_id && data.backup_id === data.responsible_id) {
    return { error: "El respaldo debe ser otra persona." };
  }

  if (frequency === "once") {
    const due = str(f, "due_local");
    if (!due) return { error: "Elige la fecha y hora límite." };
    data.due_at = parseLocalDateTime(due).toISOString();
    return { data };
  }

  data.time_of_day = str(f, "time_of_day");
  if (!/^\d{2}:\d{2}$/.test(data.time_of_day)) return { error: "Elige la hora límite." };

  if (frequency === "monthly") {
    const day = optInt(f, "day_of_month");
    if (!day || day < 1 || day > 31) return { error: "Elige el día del mes (1 a 31)." };
    data.day_of_month = day;
  } else {
    const days = f.getAll("weekdays").map(Number);
    if (frequency === "weekly" && !days.length) return { error: "Elige al menos un día de la semana." };
    data.weekdays = days.length ? days : null;
  }
  return { data };
}
