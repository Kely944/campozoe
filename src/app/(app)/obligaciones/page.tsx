import Link from "next/link";
import { FREQUENCY_LABELS, WEEKDAY_LABELS, minutesLabel } from "@/lib/obligation-form";
import { requireProfile } from "@/lib/session";
import { formatDue } from "@/lib/time";
import type { Obligation, Profile } from "@/lib/types";

export const dynamic = "force-dynamic";

function when(o: Obligation): string {
  const time = o.time_of_day?.slice(0, 5);
  switch (o.frequency) {
    case "once":
      return o.due_at ? formatDue(new Date(o.due_at)) : "";
    case "daily":
      return `${o.weekdays?.length ? o.weekdays.map((d) => WEEKDAY_LABELS[d]).join(", ") : "Todos los días"} · ${time}`;
    case "weekly":
      return `${(o.weekdays ?? []).map((d) => WEEKDAY_LABELS[d]).join(", ")} · ${time}`;
    case "monthly":
      return `Día ${o.day_of_month} de cada mes · ${time}`;
  }
}

export default async function ObligationsPage() {
  const { supabase, isAdmin } = await requireProfile();
  const [{ data: obligations }, { data: people }] = await Promise.all([
    supabase.from("obligations").select("*").order("active", { ascending: false }).order("title"),
    supabase.from("profiles").select("id, full_name"),
  ]);
  const names = new Map(((people ?? []) as Pick<Profile, "id" | "full_name">[]).map((p) => [p.id, p.full_name]));

  return (
    <main>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Tareas</h1>
        {isAdmin && <Link href="/obligaciones/nueva" className="btn-primary">+ Nueva</Link>}
      </div>
      <ul className="space-y-3">
        {((obligations ?? []) as Obligation[]).map((o) => (
          <li key={o.id}>
            <Link href={isAdmin ? `/obligaciones/${o.id}` : "#"} className={`card block ${o.active ? "" : "opacity-50"}`}>
              <p className="font-semibold">
                {o.priority === "alta" && <span className="mr-2 rounded-md bg-amber-100 dark:bg-amber-900/40 px-2 py-0.5 text-xs font-bold text-amber-800 dark:text-amber-300">IMPORTANTE</span>}
                {o.title}
                {!o.active && " (pausada)"}
              </p>
              <p className="text-sm text-stone-600 dark:text-stone-400">{FREQUENCY_LABELS[o.frequency]} · {when(o)}</p>
              <p className="text-sm text-stone-500 dark:text-stone-400">
                Avisos: {o.reminder_offsets_min.map(minutesLabel).join(", ")} antes ·{" "}
                {names.get(o.responsible_id ?? "") ?? "Administradora"}
                {o.backup_id && ` (respaldo: ${names.get(o.backup_id)})`}
              </p>
            </Link>
          </li>
        ))}
      </ul>
      {!obligations?.length && <p className="text-stone-500 dark:text-stone-400">Todavía no hay tareas.</p>}
    </main>
  );
}
