/** Mientras carga una pantalla: esqueleto con la forma del contenido. */
export default function Loading() {
  return (
    <div role="status" aria-label="Cargando" className="animate-pulse space-y-4 motion-reduce:animate-none">
      <div className="h-9 w-40 rounded-lg bg-stone-200 dark:bg-stone-800" />
      <div className="h-24 rounded-2xl bg-stone-200/80 dark:bg-stone-800/80" />
      <div className="h-24 rounded-2xl bg-stone-200/60 dark:bg-stone-800/60" />
      <div className="h-24 rounded-2xl bg-stone-200/40 dark:bg-stone-800/40" />
      <span className="sr-only">Cargando…</span>
    </div>
  );
}
