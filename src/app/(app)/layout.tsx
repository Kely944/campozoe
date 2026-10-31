import Link from "next/link";
import { signOut } from "../actions";
import AppNav from "@/components/AppNav";
import Icon from "@/components/Icon";
import MushroomLogo from "@/components/MushroomLogo";
import ThemeToggle from "@/components/ThemeToggle";
import { requireProfile } from "@/lib/session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { profile, isAdmin } = await requireProfile();
  const name = profile?.full_name || "usuario";

  return (
    <div className="min-h-screen pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-12">
      <a href="#contenido" className="sr-only z-50 rounded-xl bg-green-700 px-4 py-3 font-bold text-white focus:not-sr-only focus:fixed focus:top-3 focus:left-3">
        Saltar al contenido
      </a>
      <header className="sticky top-0 z-20 border-b border-stone-200/70 bg-[color-mix(in_srgb,var(--background)_85%,transparent)] pt-[env(safe-area-inset-top)] backdrop-blur-md dark:border-stone-800/70">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4">
          <Link href="/" className="flex items-center gap-2 text-green-700 dark:text-green-400" aria-label="Pendientes, ir a Hoy">
            <MushroomLogo className="size-8" />
            <span className="font-display text-xl font-semibold text-stone-900 dark:text-stone-50">Pendientes</span>
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <details className="relative">
              <summary
                className="grid size-11 cursor-pointer list-none place-items-center rounded-full bg-green-100 font-display text-lg font-semibold text-green-800 dark:bg-green-900 dark:text-green-100 [&::-webkit-details-marker]:hidden"
                aria-label={`Cuenta de ${name}`}
              >
                {name.slice(0, 1).toUpperCase()}
              </summary>
              <div className="card absolute right-0 mt-2 w-60 space-y-3 p-3">
                <div>
                  <p className="font-bold">{name}</p>
                  <p className="text-sm text-stone-600 dark:text-stone-400">{isAdmin ? "Administradora" : "Operativo"}</p>
                </div>
                <form action={signOut}>
                  <button className="btn-secondary w-full">
                    <Icon name="salir" className="size-5" />
                    Salir
                  </button>
                </form>
              </div>
            </details>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 md:grid md:grid-cols-[13rem_minmax(0,1fr)] md:gap-10">
        <aside className="md:pt-8">
          <AppNav isAdmin={isAdmin} />
        </aside>
        <div id="contenido" className="page-enter max-w-3xl pt-6 md:pt-8">
          {children}
        </div>
      </div>
    </div>
  );
}
