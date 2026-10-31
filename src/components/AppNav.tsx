"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Icon from "@/components/Icon";
import { BOTTOM_COUNT, NAV, isActive } from "@/lib/nav";

/** Celular: barra inferior con 4 pantallas + "Más". Computadora: menú lateral. */
export default function AppNav({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const items = NAV.filter((n) => isAdmin || !n.admin);
  const bottom = items.slice(0, BOTTOM_COUNT);
  const moreActive = pathname === "/mas" || items.slice(BOTTOM_COUNT).some((n) => isActive(pathname, n.href));

  return (
    <>
      <nav aria-label="Principal" className="sticky top-24 hidden md:block">
        <ul className="space-y-1">
          {items.map((n) => {
            const active = isActive(pathname, n.href);
            return (
              <li key={n.href}>
                <Link
                  href={n.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex min-h-11 items-center gap-3 rounded-xl px-3 font-bold transition-colors ${
                    active ? "bg-green-700 text-white dark:bg-green-600" : "text-stone-600 hover:bg-stone-200/60 hover:text-stone-900 dark:text-stone-300 dark:hover:bg-stone-800 dark:hover:text-white"
                  }`}
                >
                  <Icon name={n.icon} className="size-5" />
                  {n.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <nav
        aria-label="Principal"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-stone-200 bg-white/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden dark:border-stone-800 dark:bg-stone-950/90"
      >
        <ul className="grid grid-cols-5">
          {[...bottom.map((n) => ({ ...n, active: isActive(pathname, n.href) })), { href: "/mas", label: "Más", icon: "mas" as const, active: moreActive }].map((n) => (
            <li key={n.href}>
              <Link
                href={n.href}
                aria-current={n.active ? "page" : undefined}
                className={`flex min-h-16 flex-col items-center justify-center gap-0.5 text-xs font-bold transition-colors ${
                  n.active ? "text-green-700 dark:text-green-300" : "text-stone-500 dark:text-stone-400"
                }`}
              >
                <span className={`grid h-8 w-14 place-items-center rounded-full transition-colors ${n.active ? "bg-green-100 dark:bg-green-900/60" : ""}`}>
                  <Icon name={n.icon} className="size-[22px]" />
                </span>
                {n.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}
