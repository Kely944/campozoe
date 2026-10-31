"use client";

import { useActionState } from "react";
import type { FormState } from "@/app/actions";
import FormMessage from "@/components/FormMessage";
import { BANKS, PAYMENT_KINDS, type Payment } from "@/lib/pagos";

interface Props {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  payment?: Payment;
}

export default function PaymentForm({ action, payment: p }: Props) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className="space-y-5">
      <div>
        <label className="label" htmlFor="kind">Tipo</label>
        <select className="field" id="kind" name="kind" defaultValue={p?.kind ?? "prestamo"}>
          {Object.entries(PAYMENT_KINDS).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
        </select>
      </div>
      <div>
        <label className="label" htmlFor="name">¿A quién o qué se paga?</label>
        <input className="field" id="name" name="name" defaultValue={p?.name} required placeholder="Ej. Préstamo de equipos" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="amount">Cuota (USD)</label>
          <input className="field" id="amount" name="amount" inputMode="decimal" defaultValue={p?.amount} required placeholder="850,00" />
        </div>
        <div>
          <label className="label" htmlFor="day_of_month">Día de pago</label>
          <input className="field" id="day_of_month" name="day_of_month" type="number" min={1} max={31} defaultValue={p?.day_of_month ?? 5} required />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="bank">Banco</label>
        <input className="field" id="bank" name="bank" list="bancos" defaultValue={p?.bank ?? ""} placeholder="Banco Pichincha" />
        <datalist id="bancos">{BANKS.map((b) => <option key={b} value={b} />)}</datalist>
      </div>
      <div>
        <label className="label" htmlFor="debit_account">Cuenta de débito</label>
        <input className="field" id="debit_account" name="debit_account" inputMode="numeric" defaultValue={p?.debit_account ?? ""} placeholder="Número de cuenta" aria-describedby="debit_help" />
        <p id="debit_help" className="mt-1 text-sm text-stone-500 dark:text-stone-400">En el aviso solo se ven los últimos 4 números.</p>
      </div>
      <div>
        <label className="label" htmlFor="notice_days">Avisar con anticipación</label>
        <select className="field" id="notice_days" name="notice_days" defaultValue={p?.notice_days ?? 3}>
          {[1, 2, 3, 5, 7].map((d) => <option key={d} value={d}>{d} {d === 1 ? "día" : "días"} antes</option>)}
        </select>
      </div>
      <div>
        <label className="label" htmlFor="notes">Nota (opcional)</label>
        <input className="field" id="notes" name="notes" defaultValue={p?.notes ?? ""} />
      </div>
      <label className="flex items-center gap-2">
        <input type="checkbox" name="active" defaultChecked={p?.active ?? true} className="size-5 accent-green-700" />
        Activo
      </label>
      <FormMessage state={state} />
      <button className="btn-primary w-full" disabled={pending}>{pending ? "Guardando…" : "Guardar"}</button>
    </form>
  );
}
