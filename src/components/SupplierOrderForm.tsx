"use client";

import { useActionState, useState } from "react";
import type { FormState } from "@/app/actions";
import FormMessage from "@/components/FormMessage";
import { OTHER_SUPPLIER, SUPPLIERS, coversWeekend } from "@/lib/pedidos";

interface Props {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  defaultDate: string; // mañana, en hora local
  tasks: { id: string; title: string }[]; // tareas pendientes de hoy que el pedido puede cumplir
  suggestion?: string | null; // RF-33
}

export default function SupplierOrderForm({ action, defaultDate, tasks, suggestion }: Props) {
  const [state, formAction, pending] = useActionState(action, {});
  const [supplier, setSupplier] = useState<string>(SUPPLIERS[0].name);
  const [forDate, setForDate] = useState(defaultDate);
  const preset = SUPPLIERS.find((s) => s.name === supplier);
  const match = tasks.find((t) => t.title.toLowerCase().includes(supplier.toLowerCase().slice(0, 6)));

  return (
    <form action={formAction} className="card space-y-4">
      <div>
        <span className="label">Proveedor</span>
        <div className="grid grid-cols-2 gap-2">
          {[...SUPPLIERS.map((s) => s.name), OTHER_SUPPLIER].map((name) => (
            <label key={name} className={`btn-secondary cursor-pointer text-sm ${supplier === name ? "border-green-700 bg-green-50 text-green-900 dark:bg-green-950/60 dark:text-green-200" : ""}`}>
              <input type="radio" name="supplier" value={name} checked={supplier === name} onChange={() => setSupplier(name)} className="sr-only" />
              {name}
            </label>
          ))}
        </div>
      </div>

      {supplier === OTHER_SUPPLIER && (
        <div>
          <label className="label" htmlFor="supplier_other">Nombre del proveedor</label>
          <input className="field" id="supplier_other" name="supplier_other" required />
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="quantity">Cantidad</label>
          <input className="field" id="quantity" name="quantity" inputMode="decimal" required placeholder="Ej. 6" />
        </div>
        <div>
          <label className="label" htmlFor="unit">Unidad</label>
          {preset ? (
            <p id="unit" className="field bg-stone-50 text-stone-600 dark:bg-stone-800 dark:text-stone-300">{preset.unit}</p>
          ) : (
            <input className="field" id="unit" name="unit" placeholder="cajas, kilos…" />
          )}
        </div>
      </div>
      {preset?.name === "Champiñón" && suggestion && <p className="text-sm text-stone-600 dark:text-stone-400">{suggestion}</p>}

      <div>
        <label className="label" htmlFor="for_date">¿Para qué día?</label>
        <input className="field" id="for_date" name="for_date" type="date" value={forDate} onChange={(e) => setForDate(e.target.value)} required />
      </div>
      {supplier === "Champiñón" && forDate && coversWeekend(forDate) && (
        <p className="rounded-xl bg-amber-50 px-4 py-3 font-semibold text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          Este pedido cubre el fin de semana y el lunes: si falta, son 3 días sin champiñón.
        </p>
      )}

      <div>
        <label className="label" htmlFor="notes">Nota (opcional)</label>
        <input className="field" id="notes" name="notes" />
      </div>

      {tasks.length > 0 && (
        <div>
          <label className="label" htmlFor="occurrence_id">¿Con este pedido cumples una tarea de hoy?</label>
          <select className="field" id="occurrence_id" name="occurrence_id" key={match?.id ?? "none"} defaultValue={match?.id ?? ""}>
            <option value="">No</option>
            {tasks.map((t) => <option key={t.id} value={t.id}>Sí: {t.title}</option>)}
          </select>
        </div>
      )}

      <FormMessage state={state} />
      <button className="btn-primary w-full" disabled={pending}>{pending ? "Guardando…" : "Guardar pedido"}</button>
    </form>
  );
}
