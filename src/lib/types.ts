import type { Frequency } from "./schedule";

export interface Profile {
  id: string;
  full_name: string;
  phone: string | null;
  role: "admin" | "operativo";
}

export interface Obligation {
  id: string;
  title: string;
  description: string | null;
  frequency: Frequency;
  due_at: string | null;
  time_of_day: string | null;
  weekdays: number[] | null;
  day_of_month: number | null;
  starts_on: string;
  reminder_offsets_min: number[];
  repeat_every_min: number | null;
  escalate_before_min: number | null;
  responsible_id: string | null;
  backup_id: string | null;
  priority: "normal" | "alta";
  active: boolean;
}

export interface Occurrence {
  id: string;
  obligation_id: string;
  due_at: string;
  status: "pending" | "done";
  done_by: string | null;
  done_at: string | null;
  done_via: "app" | "whatsapp" | null;
}
