"use client";

import { useFormStatus } from "react-dom";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & { pendingText?: string };

/** Botón de formularios simples (sin mensaje): se desactiva y avisa mientras se guarda. */
export default function SubmitButton({ children, pendingText = "Guardando…", className = "btn-primary", ...rest }: Props) {
  const { pending } = useFormStatus();
  return (
    <button {...rest} className={className} disabled={pending || rest.disabled} aria-busy={pending}>
      {pending ? pendingText : children}
    </button>
  );
}
