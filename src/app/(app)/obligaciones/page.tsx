import Link from "next/link";
import Icon from "@/components/Icon";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
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
      return `${o.extra_day_of_month ? `Días ${o.day_of_month} y ${o.extra_day_of_month}` : `Día ${o.day_of_month}`} de cada mes · ${time}`;
  }
}

export default async function ObligationsPage() {
  const { supabase, isAdmin } = await requireProfile();
  const [{ data: obligations }, { data: people }] = await Promise.all([
    supabase.from("obligations").select("*").order("active", { ascending: false }).order("title"),
    supabase.from("profiles").select("id, full_name"),
  ]);
  const names = new Map(((people ?? []) as Pick<Profile, "id" | "full_name">[]).map((p) => [p.id, p.full_name]));

  const all = (obligations ?? []) as Obligation[];
  // Las tareas generadas por módulos (cobros, órdenes, facturas…) se ocultan cuando ya se cerraron.
  const manual = all.filter((o) => o.source === "manual");
  const auto = all.filter((o) => o.source !== "manual" && o.active);

  const item = (o: Obligation) => {
    const body = (
      <>
        <div className="flex items-start justify-between gap-3">
          <p className="text-lg leading-snug font-bold">{o.title}</p>
          {isAdmin && <Icon name="flecha" className="mt-1 size-5 shrink-0 text-stone-400" />}
        </div>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {o.priority === "alta" && <span className="badge bg-amber-100 text-amber-900 dark:bg-amber-900/50 dark:text-amber-200">Importante</span>}
          {!o.active && <span className="badge bg-stone-200 text-stone-700 dark:bg-stone-800 dark:text-stone-300">Pausada</span>}
        </div>
        <p className="mt-1 text-sm text-stone-600 dark:text-stone-400">{FREQUENCY_LABELS[o.frequency]} · {when(o)}</p>
        <p className="text-sm text-stone-500 dark:text-stone-400">
          Avisos {o.reminder_offsets_min.map(minutesLabel).join(", ")} antes · {names.get(o.responsible_id ?? "") ?? "Administradora"}
          {o.backup_id && ` (respaldo: ${names.get(o.backup_id)})`}
        </p>
      </>
    );
    return (
      <li key={o.id}>
        {isAdmin ? (
          <Link href={`/obligaciones/${o.id}`} className={`card block transition-colors hover:border-green-300 dark:hover:border-green-800 ${o.active ? "" : "opacity-60"}`}>{body}</Link>
        ) : (
          <div className={`card ${o.active ? "" : "opacity-60"}`}>{body}</div>
        )}
      </li>
    );
  };

  return (
    <main>
      <PageHeader
        title="Tareas"
        subtitle="Qué hay que hacer, cuándo vence y a quién se avisa."
        action={isAdmin && <Link href="/obligaciones/nueva" className="btn-primary">+ Nueva</Link>}
      />
      {manual.length ? <ul className="space-y-3">{manual.map(item)}</ul> : <EmptyState icon="tareas" title="Todavía no hay tareas." />}
      {auto.length > 0 && (
        <section className="mt-10">
          <h2 className="section-title">Automáticas</h2>
          <p className="-mt-2 mb-3 text-sm text-stone-600 dark:text-stone-400">Las crean Cobros, Favorita y Pagos; se cierran solas.</p>
          <ul className="space-y-3">{auto.map(item)}</ul>
        </section>
      )}
    </main>
  );
}
