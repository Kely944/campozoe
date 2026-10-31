"use client";

import { useActionState } from "react";
import type { FormState } from "@/app/actions";
import FormMessage from "@/components/FormMessage";
import { BANKS } from "@/lib/pagos";

interface Props {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  today: string;
}

export default function ChequeForm({ action, today }: Props) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className="mt-4 space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="number">N.º de cheque</label>
          <input className="field" id="number" name="number" inputMode="numeric" required />
        </div>
        <div>
          <label className="label" htmlFor="ch_amount">Monto (USD)</label>
          <input className="field" id="ch_amount" name="amount" inputMode="decimal" required />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="beneficiary">A nombre de</label>
        <input className="field" id="beneficiary" name="beneficiary" required />
      </div>
      <div>
        <label className="label" htmlFor="ch_bank">Banco</label>
        <input className="field" id="ch_bank" name="bank" list="bancos-ch" />
        <datalist id="bancos-ch">{BANKS.map((b) => <option key={b} value={b} />)}</datalist>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="issued_on">Emitido el</label>
          <input className="field" id="issued_on" name="issued_on" type="date" defaultValue={today} required />
        </div>
        <div>
          <label className="label" htmlFor="cash_on">Fecha del cheque</label>
          <input className="field" id="cash_on" name="cash_on" type="date" required />
        </div>
      </div>
      <FormMessage state={state} />
      <button className="btn-primary w-full" disabled={pending}>{pending ? "Guardando…" : "Registrar cheque"}</button>
    </form>
  );
}
