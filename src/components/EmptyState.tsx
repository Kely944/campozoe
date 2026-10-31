import Icon, { type IconName } from "@/components/Icon";

/** Estado vacío: qué significa y qué hacer. */
export default function EmptyState({ icon = "vacio", title, children }: { icon?: IconName; title: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-stone-300 px-5 py-8 text-center dark:border-stone-700">
      <span className="mx-auto mb-3 grid size-12 place-items-center rounded-full bg-stone-100 text-stone-500 dark:bg-stone-800 dark:text-stone-400">
        <Icon name={icon} />
      </span>
      <p className="font-bold text-stone-800 dark:text-stone-100">{title}</p>
      {children && <div className="mt-1 text-sm text-stone-600 dark:text-stone-400">{children}</div>}
    </div>
  );
}
