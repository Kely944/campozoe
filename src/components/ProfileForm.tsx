"use client";

import { useActionState } from "react";
import type { FormState } from "@/app/actions";
import type { Profile } from "@/lib/types";

interface Props {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  profile: Profile;
  editable: boolean;
}

export default function ProfileForm({ action, profile: p, editable }: Props) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className="card space-y-3">
      <div>
        <label className="label" htmlFor={`name-${p.id}`}>Nombre</label>
        <input className="field" id={`name-${p.id}`} name="full_name" defaultValue={p.full_name} disabled={!editable} />
      </div>
      <div>
        <label className="label" htmlFor={`phone-${p.id}`}>WhatsApp</label>
        <input className="field" id={`phone-${p.id}`} name="phone" inputMode="numeric" placeholder="593991234567" defaultValue={p.phone ?? ""} disabled={!editable} />
      </div>
      <div>
        <label className="label" htmlFor={`role-${p.id}`}>Rol</label>
        <select className="field" id={`role-${p.id}`} name="role" defaultValue={p.role} disabled={!editable}>
          <option value="admin">Administradora</option>
          <option value="operativo">Operativo</option>
        </select>
      </div>
      {state.error && <p className="rounded-xl bg-red-50 px-4 py-3 text-red-800">{state.error}</p>}
      {editable && <button className="btn-primary w-full" disabled={pending}>{pending ? "Guardando…" : "Guardar"}</button>}
    </form>
  );
}
