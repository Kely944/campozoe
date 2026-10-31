/** Título de cada pantalla con subtítulo opcional y acción a la derecha. */
export default function PageHeader({ title, subtitle, action }: { title: string; subtitle?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="font-display text-3xl leading-tight font-semibold text-stone-900 dark:text-stone-50">{title}</h1>
        {subtitle && <p className="mt-1 text-stone-600 dark:text-stone-400">{subtitle}</p>}
      </div>
      {action && <div className="flex shrink-0 flex-wrap gap-2">{action}</div>}
    </header>
  );
}
