import Link from "next/link";
import { signOut } from "../actions";
import { requireProfile } from "@/lib/session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { profile, isAdmin } = await requireProfile();
  return (
    <div className="mx-auto min-h-screen max-w-2xl px-4 pb-16">
      <header className="flex items-center justify-between py-4">
        <Link href="/" className="text-xl font-bold text-green-800">Pendientes</Link>
        <form action={signOut}>
          <button className="text-sm text-stone-500 underline">Salir ({profile?.full_name || "usuario"})</button>
        </form>
      </header>
      <nav className={`mb-6 grid ${isAdmin ? "grid-cols-4" : "grid-cols-3"} gap-2 text-center text-sm font-semibold`}>
        <Link href="/" className="rounded-xl bg-white py-3 shadow-sm">Hoy</Link>
        <Link href="/obligaciones" className="rounded-xl bg-white py-3 shadow-sm">Tareas</Link>
        <Link href="/equipo" className="rounded-xl bg-white py-3 shadow-sm">Equipo</Link>
        {isAdmin && <Link href="/admin" className="rounded-xl bg-white py-3 shadow-sm">Panel</Link>}
      </nav>
      {children}
    </div>
  );
}
