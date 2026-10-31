import Link from "next/link";
import Icon from "@/components/Icon";
import PageHeader from "@/components/PageHeader";
import { BOTTOM_COUNT, NAV } from "@/lib/nav";
import { requireProfile } from "@/lib/session";

/** En el celular, las pantallas que no entran en la barra inferior. */
export default async function MorePage() {
  const { isAdmin } = await requireProfile();
  const items = NAV.filter((n) => isAdmin || !n.admin).slice(BOTTOM_COUNT);
  return (
    <main>
      <PageHeader title="Más" />
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {items.map((n) => (
          <li key={n.href}>
            <Link href={n.href} className="card flex min-h-20 items-center gap-4 transition-colors hover:border-green-300 dark:hover:border-green-800">
              <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300">
                <Icon name={n.icon} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-lg font-bold">{n.label}</span>
                {n.hint && <span className="block text-sm text-stone-600 dark:text-stone-400">{n.hint}</span>}
              </span>
              <Icon name="flecha" className="size-5 text-stone-400" />
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
