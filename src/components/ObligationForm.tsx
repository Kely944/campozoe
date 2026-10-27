"use client";

import { useActionState, useState } from "react";
import type { FormState } from "@/app/actions";
import {
  ESCALATE_OPTIONS,
  FREQUENCY_LABELS,
  OFFSET_OPTIONS,
  REPEAT_OPTIONS,
  WEEKDAY_LABELS,
  minutesLabel,
} from "@/lib/obligation-form";
import type { Frequency } from "@/lib/schedule";
import type { Obligation, Profile } from "@/lib/types";

interface Props {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  obligation?: Obligation;
  dueLocal?: string; // valor inicial del datetime-local para "once"
  people: Pick<Profile, "id" | "full_name">[];
}

/** Agrega el valor actual a las opciones si no está en la lista. */
const withValue = (options: number[], value: number | null | undefined) =>
  value && !options.includes(value) ? [...options, value].sort((a, b) => a - b) : options;

export default function ObligationForm({ action, obligation: o, dueLocal, people }: Props) {
  const [state, formAction, pending] = useActionState(action, {});
  const [frequency, setFrequency] = useState<Frequency>(o?.frequency ?? "weekly");
  const offsets = o?.reminder_offsets_min ?? [1440, 120];

  return (
    <form action={formAction} className="space-y-6">
      <div>
        <label className="label" htmlFor="title">¿Qué hay que hacer?</label>
        <input className="field" id="title" name="title" defaultValue={o?.title} required placeholder="Ej. Pedido de champiñón" />
      </div>

      <div>
        <label className="label" htmlFor="description">Detalle (opcional)</label>
        <textarea className="field" id="description" name="description" rows={3} defaultValue={o?.description ?? ""} />
      </div>

      <fieldset className="card space-y-4">
        <legend className="px-1 font-bold">¿Cuándo vence?</legend>
        <div className="grid grid-cols-2 gap-2">
          {(Object.keys(FREQUENCY_LABELS) as Frequency[]).map((f) => (
            <label key={f} className={`btn-secondary cursor-pointer ${frequency === f ? "border-green-700 bg-green-50 dark:bg-green-950/60 text-green-900 dark:text-green-200" : ""}`}>
              <input type="radio" name="frequency" value={f} checked={frequency === f} onChange={() => setFrequency(f)} className="sr-only" />
              {FREQUENCY_LABELS[f]}
            </label>
          ))}
        </div>

        {frequency === "once" ? (
          <div>
            <label className="label" htmlFor="due_local">Fecha y hora límite</label>
            <input className="field" id="due_local" name="due_local" type="datetime-local" defaultValue={dueLocal} required />
          </div>
        ) : (
          <div>
            <label className="label" htmlFor="time_of_day">Hora límite</label>
            <input className="field" id="time_of_day" name="time_of_day" type="time" defaultValue={o?.time_of_day?.slice(0, 5) ?? "09:00"} required />
          </div>
        )}

        {(frequency === "daily" || frequency === "weekly") && (
          <div>
            <span className="label">{frequency === "daily" ? "Días (vacío = todos)" : "Días de la semana"}</span>
            <div className="grid grid-cols-7 gap-1">
              {WEEKDAY_LABELS.map((label, i) => (
                <label key={i} className="flex cursor-pointer flex-col items-center gap-1 rounded-lg border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 py-2 text-xs has-[:checked]:border-green-700 has-[:checked]:bg-green-50 dark:has-[:checked]:bg-green-950/60">
                  <input type="checkbox" name="weekdays" value={i} defaultChecked={o?.weekdays?.includes(i)} className="size-5 accent-green-700" />
                  {label}
                </label>
              ))}
            </div>
          </div>
        )}

        {frequency === "monthly" && (
          <div>
            <label className="label" htmlFor="day_of_month">Día del mes</label>
            <input className="field" id="day_of_month" name="day_of_month" type="number" min={1} max={31} defaultValue={o?.day_of_month ?? 1} required />
          </div>
        )}
      </fieldset>

      <fieldset className="card space-y-4">
        <legend className="px-1 font-bold">Avisos por WhatsApp</legend>
        <div className="grid grid-cols-2 gap-2">
          {OFFSET_OPTIONS.map((opt) => (
            <label key={opt.value} className="flex cursor-pointer items-center gap-2 rounded-lg border border-stone-200 dark:border-stone-800 px-3 py-2 has-[:checked]:border-green-700 has-[:checked]:bg-green-50 dark:has-[:checked]:bg-green-950/60">
              <input type="checkbox" name="offsets" value={opt.value} defaultChecked={offsets.includes(opt.value)} className="size-5 accent-green-700" />
              {opt.label}
            </label>
          ))}
        </div>
        <div>
          <label className="label" htmlFor="repeat_every_min">Repetir el aviso hasta que se marque hecho</label>
          <select className="field" id="repeat_every_min" name="repeat_every_min" defaultValue={o?.repeat_every_min ?? 60}>
            <option value="">No repetir</option>
            {withValue(REPEAT_OPTIONS, o?.repeat_every_min).map((m) => (
              <option key={m} value={m}>Cada {minutesLabel(m)}</option>
            ))}
          </select>
        </div>
      </fieldset>

      <fieldset className="card space-y-4">
        <legend className="px-1 font-bold">Responsables</legend>
        <div>
          <label className="label" htmlFor="responsible_id">Responsable</label>
          <select className="field" id="responsible_id" name="responsible_id" defaultValue={o?.responsible_id ?? ""}>
            <option value="">Administradora</option>
            {people.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="backup_id">Respaldo (recibe aviso si sigue pendiente)</label>
          <select className="field" id="backup_id" name="backup_id" defaultValue={o?.backup_id ?? ""}>
            <option value="">Nadie</option>
            {people.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="escalate_before_min">Avisar al respaldo</label>
          <select className="field" id="escalate_before_min" name="escalate_before_min" defaultValue={o?.escalate_before_min ?? ""}>
            <option value="">No avisar</option>
            {withValue(ESCALATE_OPTIONS, o?.escalate_before_min).map((m) => (
              <option key={m} value={m}>{minutesLabel(m)} antes si sigue pendiente</option>
            ))}
          </select>
        </div>
      </fieldset>

      <div className="flex flex-wrap gap-6">
        <label className="flex items-center gap-2">
          <input type="checkbox" name="priority" value="alta" defaultChecked={o?.priority === "alta"} className="size-5 accent-amber-600" />
          Importante
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="active" defaultChecked={o?.active ?? true} className="size-5 accent-green-700" />
          Activa
        </label>
      </div>

      {state.error && <p className="rounded-xl bg-red-50 dark:bg-red-950/40 px-4 py-3 text-red-800 dark:text-red-300">{state.error}</p>}
      <button className="btn-primary w-full" disabled={pending}>{pending ? "Guardando…" : "Guardar"}</button>
    </form>
  );
}
