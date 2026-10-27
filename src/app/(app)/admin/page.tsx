import Link from "next/link";
import { redirect } from "next/navigation";
import DashboardSection, { type DetailRow } from "@/components/dashboard/DashboardSection";
import {
  COMPLIANCE_STATUSES,
  NOTICE_STATUSES,
  buildBuckets,
  classifyCompliance,
  classifyNotifications,
  fetchAll,
  findMissingPhones,
  parsePeriod,
  personKey,
  summarize,
  type Bucket,
  type ComplianceStatus,
  type FailureRow,
  type MissingPhones,
  type NoticeStatus,
  type NotificationRow,
  type OccurrenceRow,
} from "@/lib/dashboard";
import { requireProfile } from "@/lib/session";
import { formatDue } from "@/lib/time";
import type { Profile } from "@/lib/types";

export const dynamic = "force-dynamic";

type Db = Awaited<ReturnType<typeof requireProfile>>["supabase"];

const COMPLIANCE_LABELS: Record<ComplianceStatus, string> = { a_tiempo: "A tiempo", tarde: "Tarde", sin_hacer: "Sin hacer" };
const COMPLIANCE_COLORS: Record<ComplianceStatus, string> = {
  a_tiempo: "var(--st-bien)",
  tarde: "var(--st-adv)",
  sin_hacer: "var(--st-crit)",
};
const NOTICE_LABELS: Record<NoticeStatus, string> = { enviado: "Enviado", simulado: "Simulado", fallido: "Fallido" };
const NOTICE_COLORS: Record<NoticeStatus, string> = {
  enviado: "var(--st-bien)",
  simulado: "var(--st-neutro)",
  fallido: "var(--st-crit)",
};
const PERIODS = [7, 30, 90] as const;

type TitleJoin = { occurrences: { obligations: { title: string } | null } | null };
const titleOf = (r: TitleJoin) => r.occurrences?.obligations?.title;

async function loadCompliance(db: Db, names: Map<string, string>, buckets: Bucket[], now: Date) {
  const raw = await fetchAll((a, b) =>
    db
      .from("occurrences")
      .select("id, due_at, status, done_at, done_by, obligations(title, responsible_id)")
      .gte("due_at", buckets[0].start.toISOString())
      .lt("due_at", now.toISOString())
      .order("due_at")
      .order("id")
      .range(a, b),
  );
  // Sin filtrar por `active`: las tareas pausadas conservan su historial.
  const rows: OccurrenceRow[] = (raw as unknown as (Omit<OccurrenceRow, "title" | "responsible_id"> & {
    obligations: { title: string; responsible_id: string | null } | null;
  })[]).map(({ obligations, ...r }) => ({
    ...r,
    title: obligations?.title ?? "Tarea eliminada",
    responsible_id: obligations?.responsible_id ?? null,
  }));

  const items = classifyCompliance(rows, names, buckets, now);
  const detail: DetailRow[] = items.map((i) => ({
    id: i.id,
    bucketKey: i.bucketKey,
    personKey: personKey(i.personId),
    status: i.status,
    cells: [
      i.title,
      formatDue(new Date(i.dueAt)),
      i.personName,
      COMPLIANCE_LABELS[i.status],
      i.doneByName ? `${i.doneByName} · ${formatDue(new Date(i.doneAt ?? i.dueAt))}` : "",
    ],
  }));
  return { summary: summarize(items, COMPLIANCE_STATUSES, buckets), detail };
}

async function loadNotices(db: Db, names: Map<string, string>, buckets: Bucket[]) {
  const from = buckets[0].start.toISOString();
  const [sent, failures] = await Promise.all([
    fetchAll((a, b) =>
      db
        .from("notifications")
        .select("occurrence_id, recipient_id, slot, status, sent_at, occurrences(obligations(title))")
        .gte("sent_at", from)
        .order("sent_at")
        .order("id")
        .range(a, b),
    ),
    fetchAll((a, b) =>
      db
        .from("notification_failures")
        .select("occurrence_id, recipient_id, slot, error, attempts, failed_at, occurrences(obligations(title))")
        .gte("failed_at", from)
        .order("failed_at")
        .order("id")
        .range(a, b),
    ),
  ]);
  const sentRows = sent as unknown as (NotificationRow & TitleJoin)[];
  const failureRows = failures as unknown as (FailureRow & TitleJoin)[];
  const titles = new Map<string, string>();
  for (const r of [...sentRows, ...failureRows]) {
    const t = titleOf(r);
    if (t) titles.set(r.occurrence_id, t);
  }

  const items = classifyNotifications(sentRows, failureRows, titles, names, buckets);
  const detail: DetailRow[] = items.map((i) => ({
    id: i.key,
    bucketKey: i.bucketKey,
    personKey: personKey(i.personId),
    status: i.status,
    cells: [
      i.title,
      i.slotLabel,
      i.personName,
      formatDue(new Date(i.at)),
      NOTICE_LABELS[i.status],
      i.lastError ? `No se pudo enviar (${i.attempts} ${i.attempts === 1 ? "intento" : "intentos"}): ${i.lastError}` : "",
    ],
  }));
  return { summary: summarize(items, NOTICE_STATUSES, buckets), detail };
}

async function attempt<T>(fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch (err) {
    console.error("Panel: error al cargar", err);
    return null;
  }
}

function MissingPhonesNotice({ missing }: { missing: MissingPhones }) {
  if (!missing.people.length && !missing.tasks.length) return null;
  return (
    <div className="card space-y-2 border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40">
      <h3 className="font-semibold text-red-900 dark:text-red-200">Sin WhatsApp: estos avisos no pueden llegar</h3>
      {missing.people.length > 0 && (
        <p className="text-sm text-red-900 dark:text-red-200">
          Personas sin número: {missing.people.map((p) => p.name).join(", ")}. Cárgalo en{" "}
          <Link href="/equipo" className="underline">Equipo</Link>.
        </p>
      )}
      <ul className="space-y-1 text-sm text-red-900 dark:text-red-200">
        {missing.tasks.map((t) => (
          <li key={t.id} className="break-words">
            <span className="font-semibold">{t.title}</span>: {t.who.join(", ")}
          </li>
        ))}
      </ul>
    </div>
  );
}

function LoadError({ title }: { title: string }) {
  return (
    <section className="mb-10">
      <h2 className="mb-3 text-lg font-bold">{title}</h2>
      <p className="card text-red-800 dark:text-red-300">No se pudo cargar. Recarga la página.</p>
    </section>
  );
}

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  const { supabase, isAdmin } = await requireProfile();
  if (!isAdmin) redirect("/");

  const period = parsePeriod((await searchParams).p);
  const now = new Date();
  const buckets = buildBuckets(period, now);

  const [{ data: profiles }, { data: obligations }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, phone, role").order("full_name"),
    supabase.from("obligations").select("id, title, active, responsible_id, backup_id").order("title"),
  ]);
  const people = (profiles ?? []) as Profile[];
  const names = new Map(people.map((p) => [p.id, p.full_name]));

  const [compliance, notices] = await Promise.all([
    attempt(() => loadCompliance(supabase, names, buckets, now)),
    attempt(() => loadNotices(supabase, names, buckets)),
  ]);
  const missing = findMissingPhones(people, obligations ?? []);

  return (
    <main>
      <h1 className="mb-4 text-2xl font-bold">Panel</h1>
      <div className="mb-8 grid grid-cols-3 gap-2">
        {PERIODS.map((p) => (
          <Link
            key={p}
            href={`/admin?p=${p}`}
            aria-current={p === period ? "page" : undefined}
            className={`btn-secondary ${p === period ? "border-green-700 bg-green-50 dark:bg-green-950/60 text-green-900 dark:text-green-200" : ""}`}
          >
            {p} días
          </Link>
        ))}
      </div>

      {compliance ? (
        <DashboardSection
          title="Cumplimiento del equipo"
          emptyText="Sin tareas vencidas en este periodo."
          summary={compliance.summary}
          statuses={COMPLIANCE_STATUSES}
          statusLabels={COMPLIANCE_LABELS}
          colors={COMPLIANCE_COLORS}
          percentOf="a_tiempo"
          columns={["Tarea", "Vence", "Responsable", "Estado", "Marcada por"]}
          rows={compliance.detail}
        />
      ) : (
        <LoadError title="Cumplimiento del equipo" />
      )}

      {notices ? (
        <DashboardSection
          title="Avisos de WhatsApp"
          emptyText="Sin avisos en este periodo."
          summary={notices.summary}
          statuses={NOTICE_STATUSES}
          statusLabels={NOTICE_LABELS}
          colors={NOTICE_COLORS}
          tiles={[{ label: "Personas sin WhatsApp", value: missing.people.length }]}
          columns={["Tarea", "Aviso", "Para", "Fecha", "Estado", "Error"]}
          rows={notices.detail}
          extra={<MissingPhonesNotice missing={missing} />}
        />
      ) : (
        <LoadError title="Avisos de WhatsApp" />
      )}
    </main>
  );
}
