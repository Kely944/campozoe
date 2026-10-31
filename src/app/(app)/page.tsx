import { markDone, undoDone } from "../actions";
import EmptyState from "@/components/EmptyState";
import Icon from "@/components/Icon";
import SubmitButton from "@/components/SubmitButton";
import { ensureOccurrences } from "@/lib/reminders";
import { requireProfile } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { DAY, formatDate, formatDue, fromLocal, localDate, relative, toLocal } from "@/lib/time";
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

type Tone = "vencida" | "hoy" | "semana" | "hecha";

const TONE: Record<Tone, string> = {
  vencida: "before:bg-red-600 dark:before:bg-red-500",
  hoy: "before:bg-amber-500",
  semana: "before:bg-stone-300 dark:before:bg-stone-700",
  hecha: "before:bg-green-600 dark:before:bg-green-500",
};

export default async function TodayPage() {
  const { supabase, user, profile } = await requireProfile();
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
  const doneRows = (done ?? []) as unknown as Row[];

  const card = (r: Row, tone: Tone) => {
    const ob = r.obligations;
    const due = new Date(r.due_at);
    const mine = ob?.responsible_id === user.id;
    const who = ob?.responsible_id ? names.get(ob.responsible_id) : "Administradora";
    return (
      <li
        key={r.id}
        className={`card relative overflow-hidden pl-5 before:absolute before:inset-y-0 before:left-0 before:w-1.5 ${TONE[tone]} ${tone === "hecha" ? "opacity-75" : ""}`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {ob?.priority === "alta" && tone !== "hecha" && (
              <span className="badge mb-1 bg-amber-100 text-amber-900 dark:bg-amber-900/50 dark:text-amber-200">Importante</span>
            )}
            <p className={`text-lg leading-snug font-bold ${tone === "hecha" ? "line-through decoration-stone-400" : ""}`}>{ob?.title}</p>
            <p className={`mt-0.5 text-sm ${tone === "vencida" ? "font-bold text-red-700 dark:text-red-400" : "text-stone-600 dark:text-stone-400"}`}>
              {tone === "hecha"
                ? `Hecha por ${names.get(r.done_by ?? "") ?? "alguien"}${r.done_at ? ` · ${formatDue(new Date(r.done_at))}` : ""}`
                : tone === "vencida"
                  ? `Venció ${relative(due, now)} · ${formatDue(due)}`
                  : `${formatDue(due)} · ${relative(due, now)}`}
            </p>
            {tone !== "hecha" && (
              <p className={`mt-1 text-sm ${mine ? "font-bold text-green-800 dark:text-green-300" : "text-stone-500 dark:text-stone-400"}`}>
                {mine ? "Te toca a ti" : `Responsable: ${who ?? "sin asignar"}`}
              </p>
            )}
          </div>
          {tone === "hecha" ? (
            <form action={undoDone.bind(null, r.id)}>
              <SubmitButton className="btn-secondary shrink-0 px-3 text-sm" pendingText="…">Deshacer</SubmitButton>
            </form>
          ) : (
            <form action={markDone.bind(null, r.id)}>
              <SubmitButton className="btn-primary shrink-0 px-4" pendingText="…">
                <Icon name="check" className="size-5" />
                Hecho
              </SubmitButton>
            </form>
          )}
        </div>
      </li>
    );
  };

  const section = (title: string, list: Row[], tone: Tone, empty?: React.ReactNode) =>
    list.length || empty ? (
      <section className="mb-8" aria-labelledby={`sec-${tone}`}>
        <h2 id={`sec-${tone}`} className="section-title flex items-baseline gap-2">
          {title}
          {list.length > 0 && <span className="font-sans text-base font-bold text-stone-500 dark:text-stone-400">{list.length}</span>}
        </h2>
        {list.length ? <ul className="space-y-3">{list.map((r) => card(r, tone))}</ul> : empty}
      </section>
    ) : null;

  const firstName = profile?.full_name?.split(" ")[0];

  return (
    <main>
      <header className="mb-6">
        <p className="text-sm font-bold tracking-wide text-green-800 uppercase dark:text-green-400">{formatDate(localDate(now))}</p>
        <h1 className="font-display text-3xl leading-tight font-semibold">{firstName ? `Hola, ${firstName}` : "Hoy y esta semana"}</h1>
        <ul className="mt-4 grid grid-cols-3 gap-2 text-center">
          <li className={`rounded-xl px-2 py-3 ${overdue.length ? "bg-red-600 text-white dark:bg-red-700" : "bg-white text-stone-600 dark:bg-stone-900 dark:text-stone-400"}`}>
            <span className="block font-display text-2xl font-semibold">{overdue.length}</span>
            <span className="text-sm font-bold">Vencidas</span>
          </li>
          <li className={`rounded-xl px-2 py-3 ${todayRows.length ? "bg-amber-100 text-amber-950 dark:bg-amber-900/50 dark:text-amber-100" : "bg-white text-stone-600 dark:bg-stone-900 dark:text-stone-400"}`}>
            <span className="block font-display text-2xl font-semibold">{todayRows.length}</span>
            <span className="text-sm font-bold">Para hoy</span>
          </li>
          <li className="rounded-xl bg-white px-2 py-3 text-stone-700 dark:bg-stone-900 dark:text-stone-300">
            <span className="block font-display text-2xl font-semibold">{doneRows.length}</span>
            <span className="text-sm font-bold">Hechas hoy</span>
          </li>
        </ul>
      </header>

      {section("Vencidas", overdue, "vencida")}
      {section(
        "Hoy",
        todayRows,
        "hoy",
        <EmptyState icon="check" title="Nada pendiente para hoy">{overdue.length ? "Revisa las vencidas de arriba." : "Buen trabajo."}</EmptyState>,
      )}
      {section("Esta semana", week, "semana", <EmptyState icon="hoy" title="Nada más esta semana" />)}
      {section("Hechas hoy", doneRows, "hecha")}
    </main>
  );
}
