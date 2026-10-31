"use client";

import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";

/**
 * Botón para acciones que no se deshacen (eliminar): el primer toque pide confirmar,
 * el segundo envía. Sin ventanas emergentes del navegador.
 */
export default function ConfirmSubmit({ label, confirm = "¿Seguro? Toca otra vez para confirmar", className = "btn-danger w-full" }: { label: string; confirm?: string; className?: string }) {
  const [armed, setArmed] = useState(false);
  const { pending } = useFormStatus();
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 5000);
    return () => clearTimeout(t);
  }, [armed]);

  return (
    <button
      type={armed ? "submit" : "button"}
      onClick={() => !armed && setArmed(true)}
      className={`${className} ${armed ? "border-red-600 bg-red-600 text-white hover:bg-red-700 dark:bg-red-700 dark:text-white" : ""}`}
      disabled={pending}
      aria-live="polite"
    >
      {pending ? "Eliminando…" : armed ? confirm : label}
    </button>
  );
}
