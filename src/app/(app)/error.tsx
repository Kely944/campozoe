"use client";

import Icon from "@/components/Icon";

/** Si una pantalla falla (sin internet, base de datos caída…), mensaje claro y reintento. */
export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <div role="alert" className="card mt-4 text-center">
      <span className="mx-auto mb-3 grid size-12 place-items-center rounded-full bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300">
        <Icon name="alerta" />
      </span>
      <h1 className="font-display text-2xl font-semibold">No se pudo cargar</h1>
      <p className="mt-1 mb-5 text-stone-600 dark:text-stone-400">Revisa la conexión a internet e intenta otra vez. Si sigue fallando, avisa a quien administra la app.</p>
      <button className="btn-primary w-full sm:w-auto" onClick={reset}>Intentar otra vez</button>
    </div>
  );
}
