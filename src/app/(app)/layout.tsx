import Link from "next/link";
import { signOut } from "../actions";
import { requireProfile } from "@/lib/session";
import ThemeToggle from "@/components/ThemeToggle";

const NAV = [
  { href: "/", label: "Hoy" },
  { href: "/pedidos", label: "Pedidos" },
  { href: "/cobros", label: "Cobros" },
  { href: "/obligaciones", label: "Tareas" },
  { href: "/produccion", label: "Producción" },
  { href: "/equipo", label: "Equipo" },
  { href: "/favorita", label: "Favorita", admin: true },
  { href: "/pagos", label: "Pagos", admin: true },
  { href: "/reportes", label: "Reportes", admin: true },
  { href: "/admin", label: "Panel", admin: true },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { profile, isAdmin } = await requireProfile();
  return (
    <div className="mx-auto min-h-screen max-w-2xl px-4 pb-16">
      <header className="flex items-center justify-between py-4">
        <Link href="/" className="text-xl font-bold text-green-800 dark:text-green-400">Pendientes</Link>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <form action={signOut}>
            <button className="text-sm text-stone-500 dark:text-stone-400 underline">Salir ({profile?.full_name || "usuario"})</button>
          </form>
        </div>
      </header>
      <nav className="mb-6 flex gap-2 overflow-x-auto text-center text-sm font-semibold">
        {NAV.filter((n) => isAdmin || !n.admin).map((n) => (
          <Link key={n.href} href={n.href} className="shrink-0 rounded-xl bg-white px-4 py-3 shadow-sm dark:bg-stone-900">{n.label}</Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
