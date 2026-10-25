"use client";

import { useActionState } from "react";
import { signIn } from "../actions";

export default function LoginPage() {
  const [state, action, pending] = useActionState(signIn, {});
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4">
      <h1 className="mb-1 text-3xl font-bold text-green-800">Pendientes</h1>
      <p className="mb-8 text-stone-600">Pedidos, ofertas y pagos a tiempo.</p>
      <form action={action} className="space-y-4">
        <div>
          <label className="label" htmlFor="email">Correo</label>
          <input className="field" id="email" name="email" type="email" autoComplete="email" required />
        </div>
        <div>
          <label className="label" htmlFor="password">Contraseña</label>
          <input className="field" id="password" name="password" type="password" autoComplete="current-password" required />
        </div>
        {state.error && <p className="rounded-xl bg-red-50 px-4 py-3 text-red-800">{state.error}</p>}
        <button className="btn-primary w-full" disabled={pending}>
          {pending ? "Entrando…" : "Entrar"}
        </button>
      </form>
    </main>
  );
}
