"use client";

import { useActionState } from "react";
import type { FormState } from "@/app/actions";
import FormMessage from "@/components/FormMessage";

interface Props {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  submit: string;
  className?: string;
  children: React.ReactNode;
}

/** Formulario con mensaje de error/confirmación y botón que muestra "Guardando…". */
export default function ActionForm({ action, submit, className = "space-y-4", children }: Props) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className={className}>
      {children}
      <FormMessage state={state} />
      <button className="btn-primary w-full" disabled={pending}>{pending ? "Guardando…" : submit}</button>
    </form>
  );
}
