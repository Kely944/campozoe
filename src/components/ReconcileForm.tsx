"use client";

import { useActionState, useState } from "react";
import type { FormState } from "@/app/actions";
import FormMessage from "@/components/FormMessage";
import { reconcile, suggestInvoices, type InvoiceToReconcile } from "@/lib/cobros";

interface Props {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  invoices: InvoiceToReconcile[];
  today: string;
}

const usd = (n: number) => n.toLocaleString("es-EC", { style: "currency", currency: "USD" });

/** RF-27: elige las facturas que cubre el pago y muestra la diferencia en vivo. */
export default function ReconcileForm({ action, invoices, today }: Props) {
  const [state, formAction, pending] = useActionState(action, {});
  const [amount, setAmount] = useState("");
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const value = Number(amount.replace(/\s|\$/g, "").replace(",", ".")) || 0;
  const r = reconcile(value, invoices.filter((i) => checked.has(i.id)));
  const suggestion = value ? suggestInvoices(value, invoices) : null;

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="amount">Monto recibido</label>
          <input className="field" id="amount" name="amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} required />
        </div>
        <div>
          <label className="label" htmlFor="received_on">Fecha</label>
          <input className="field" id="received_on" name="received_on" type="date" defaultValue={today} required />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="reference">Cheque o transferencia (opcional)</label>
        <input className="field" id="reference" name="reference" />
      </div>
      {suggestion && (
        <button type="button" className="btn-secondary w-full text-sm" onClick={() => setChecked(new Set(suggestion))}>
          Marcar las {suggestion.length} facturas más antiguas que suman exacto
        </button>
      )}
      <fieldset>
        <legend className="label">Facturas que cubre</legend>
        <ul className="space-y-2">
          {invoices.map((i) => (
            <li key={i.id}>
              <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-stone-200 px-3 py-2 has-[:checked]:border-green-700 has-[:checked]:bg-green-50 dark:border-stone-800 dark:has-[:checked]:bg-green-950/60">
                <span className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="order_id"
                    value={i.id}
                    checked={checked.has(i.id)}
                    onChange={(e) => {
                      const next = new Set(checked);
                      if (e.target.checked) next.add(i.id);
                      else next.delete(i.id);
                      setChecked(next);
                    }}
                    className="size-5 accent-green-700"
                  />
                  {i.label}
                </span>
                <span className="tabular-nums">{usd(i.amount)}</span>
              </label>
            </li>
          ))}
        </ul>
      </fieldset>
      <p aria-live="polite" className={`rounded-xl px-4 py-3 font-semibold ${r.exact && value ? "bg-green-50 text-green-800 dark:bg-green-950/40 dark:text-green-300" : "bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-300"}`}>
        Facturas: {usd(r.sum)} · Diferencia: {usd(r.diff)}{r.exact && value ? " · cuadra ✓" : ""}
      </p>
      <FormMessage state={state} />
      <button className="btn-primary w-full" disabled={pending}>{pending ? "Guardando…" : "Guardar pago"}</button>
    </form>
  );
}
