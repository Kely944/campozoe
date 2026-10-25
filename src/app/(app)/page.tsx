import { markDone, undoDone } from "../actions";
import { ensureOccurrences } from "@/lib/reminders";
import { requireProfile } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { DAY, formatDue, fromLocal, relative, toLocal } from "@/lib/time";
import type { Obligation, Profile } from "@/lib/types";

export const dynamic = "force-dynamic";

interface Row {
  id: string;
  due_at: string;
  status: "pending" | "done";
  done_at: string | null;
  done_by: string | null;
  obligations: Pick<Obligation, "title" | "description" | "priority" | "responsible_id" | "backup_id"> | null;
}

export default async function TodayPage() {
  const { supabase, user } = await requireProfile();
  const now = new Date();
  const today = toLocal(now);
  const startOfToday = fromLocal(today.year, today.month, today.day);
  const endOfToday = new Date(startOfToday.getTime() + DAY);

  // Genera vencimientos aunque el cron todavía no esté configurado.
  const { data: obligations } = await supabase.from("obligations").select("*").eq("active", true);
  await ensureOccurrences(createAdminClient(), (obligations ?? []) as Obligation[], now);

  const select = "id, due_at, status, done_at, done_by, obligations(title, description, priority, responsible_id, backup_id)";
  const [{ data: pending }, { data: done }, { data: people }] = await Promise.all([
    supabase
      .from("occurrences")
      .select(select)
      .eq("status", "pending")
      .gte("due_at", new Date(now.getTime() - 7 * DAY).toISOString())
      .lte("due_at", new Date(now.getTime() + 7 * DAY).toISOString())
      .order("due_at"),
    supabase.from("occurrences").select(select).eq("status", "done").gte("done_at", startOfToday.toISOString()).order("done_at", { ascending: false }),
    supabase.from("profiles").select("id, full_name"),
  ]);

  const names = new Map(((people ?? []) as Pick<Profile, "id" | "full_name">[]).map((p) => [p.id, p.full_name]));
  const rows = (pending ?? []) as unknown as Row[];
  const overdue = rows.filter((r) => new Date(r.due_at) < now);
  const todayRows = rows.filter((r) => new Date(r.due_at) >= now && new Date(r.due_at) < endOfToday);
  const week = rows.filter((r) => new Date(r.due_at) >= endOfToday);

  const card = (r: Row) => {
    const ob = r.obligations;
    const isOverdue = r.status === "pending" && new Date(r.due_at) < now;
    const mine = ob?.responsible_id === user.id;
    return (
      <li key={r.id} className={`card ${isOverdue ? "border-red-300 bg-red-50" : ""}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-semibold leading-snug">
              {ob?.priority === "alta" && <span className="mr-2 rounded-md bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800">IMPORTANTE</span>}
              {ob?.title}
            </p>
            <p className={`text-sm ${isOverdue ? "font-semibold text-red-700" : "text-stone-600"}`}>
              {r.status === "done"
                ? `Hecha por ${names.get(r.done_by ?? "") ?? "alguien"}`
                : `${formatDue(new Date(r.due_at))} · ${relative(new Date(r.due_at), now)}`}
            </p>
            <p className="text-sm text-stone-500">
              {mine ? "Te toca a ti" : `Responsable: ${names.get(ob?.responsible_id ?? "") ?? "sin asignar"}`}
            </p>
          </div>
          {r.status === "pending" ? (
            <form action={markDone.bind(null, r.id)}>
              <button className="btn-primary shrink-0">Hecho</button>
            </form>
          ) : (
            <form action={undoDone.bind(null, r.id)}>
              <button className="btn-secondary shrink-0 text-sm">Deshacer</button>
            </form>
          )}
        </div>
      </li>
    );
  };

  const section = (title: string, list: Row[], empty?: string) =>
    list.length || empty ? (
      <section className="mb-8">
        <h2 className="mb-3 text-lg font-bold">{title}</h2>
        {list.length ? <ul className="space-y-3">{list.map(card)}</ul> : <p className="text-stone-500">{empty}</p>}
      </section>
    ) : null;

  return (
    <main>
      {section("Vencidas", overdue)}
      {section("Hoy", todayRows, "Nada pendiente para hoy.")}
      {section("Esta semana", week, "Nada más esta semana.")}
      {section("Hechas hoy", (done ?? []) as unknown as Row[])}
    </main>
  );
}
