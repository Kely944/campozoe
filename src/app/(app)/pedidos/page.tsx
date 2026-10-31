import { createSupplierOrder, deleteSupplierOrder } from "./actions";
import EmptyState from "@/components/EmptyState";
import SubmitButton from "@/components/SubmitButton";
import SupplierOrderForm from "@/components/SupplierOrderForm";
import { coversWeekend, historyBySupplier, type SupplierOrderRow } from "@/lib/pedidos";
import { suggestCorchos, type SaleRow } from "@/lib/reportes";
import { requireProfile } from "@/lib/session";
import { DAY, addDays, formatDate, fromLocal, localDate, toLocal } from "@/lib/time";

export const dynamic = "force-dynamic";

const fmtQty = (n: number) => Number(n).toLocaleString("es-EC");

export default async function OrdersPage() {
  const { supabase, user, isAdmin } = await requireProfile();
  const now = new Date();
  const today = localDate(now);
  const t = toLocal(now);
  const startOfToday = fromLocal(t.year, t.month, t.day);

  const [{ data: orders }, { data: tasks }] = await Promise.all([
    supabase
      .from("supplier_orders")
      .select("id, supplier, for_date, quantity, unit, notes, created_by, profiles(full_name)")
      .gte("for_date", addDays(today, -90))
      .order("for_date", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("occurrences")
      .select("id, obligations(title)")
      .eq("status", "pending")
      .gte("due_at", startOfToday.toISOString())
      .lt("due_at", new Date(startOfToday.getTime() + DAY).toISOString())
      .order("due_at"),
  ]);

  // RF-33: sugerencia para mañana según lo vendido (ventas importadas; solo la administradora las ve).
  const tomorrow = addDays(today, 1);
  const { data: sales } = isAdmin
    ? await supabase.from("sales").select("sold_on, customer, product, units, amount").gte("sold_on", addDays(today, -63)).ilike("product", "%champi%")
    : { data: [] };
  const sug = suggestCorchos((sales ?? []) as SaleRow[], tomorrow);
  const suggestion = sug
    ? `Sugerido para mañana: ${sug.corchos} ${sug.corchos === 1 ? "corcho" : "corchos"} (se vendieron ${sug.avgKg.toLocaleString("es-EC")} kg en promedio ese día, últimas ${sug.weeks} semanas).`
    : null;

  type Row = SupplierOrderRow & { notes: string | null; created_by: string | null; profiles: { full_name: string } | null };
  const rows = (orders ?? []) as unknown as Row[];
  const upcoming = rows.filter((r) => r.for_date >= today);
  const history = historyBySupplier(rows);
  const todayTasks = ((tasks ?? []) as unknown as { id: string; obligations: { title: string } | null }[])
    .filter((x) => x.obligations)
    .map((x) => ({ id: x.id, title: x.obligations!.title }));

  const orderItem = (r: Row) => (
    <li key={r.id} className="flex items-center justify-between gap-3 py-2">
      <div className="min-w-0">
        <p className="font-semibold">
          {fmtQty(r.quantity)} {r.unit}
          {r.supplier === "Champiñón" && coversWeekend(r.for_date) && (
            <span className="ml-2 rounded-md bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">FIN DE SEMANA</span>
          )}
        </p>
        <p className="text-sm text-stone-600 dark:text-stone-400">
          Para el {formatDate(r.for_date)} · {r.profiles?.full_name ?? "—"}
          {r.notes && ` · ${r.notes}`}
        </p>
      </div>
      {(r.created_by === user.id || isAdmin) && (
        <form action={deleteSupplierOrder.bind(null, r.id)}>
          <SubmitButton className="btn-danger min-h-11 px-3 text-sm" aria-label={`Borrar pedido de ${r.supplier} del ${formatDate(r.for_date)}`} pendingText="…">Borrar</SubmitButton>
        </form>
      )}
    </li>
  );

  return (
    <main>
      <h1 className="mb-6 font-display text-3xl leading-tight font-semibold">Pedidos</h1>
      <SupplierOrderForm action={createSupplierOrder} defaultDate={tomorrow} tasks={todayTasks} suggestion={suggestion} />

      <section className="mt-8">
        <h2 className="mb-3 text-xl font-semibold">Próximos</h2>
        {upcoming.length ? (
          <ul className="card divide-y divide-stone-200 py-1 dark:divide-stone-800">
            {upcoming.map((r) => (
              <li key={r.id} className="py-2">
                <p className="text-sm font-semibold text-stone-500 dark:text-stone-400">{r.supplier}</p>
                <ul>{orderItem(r)}</ul>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="No hay pedidos registrados para hoy ni los próximos días." />
        )}
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-xl font-semibold">Historial por proveedor (últimos 90 días)</h2>
        {history.length ? (
          <div className="space-y-3">
            {history.map((h) => (
              <details key={h.supplier} className="card">
                <summary className="cursor-pointer list-none">
                  <p className="font-semibold">{h.supplier}</p>
                  <p className="text-sm text-stone-600 dark:text-stone-400">
                    {h.count} {h.count === 1 ? "pedido" : "pedidos"} · {fmtQty(h.total)} {h.unit} · último: {formatDate(h.lastDate)}
                  </p>
                </summary>
                <ul className="mt-2 divide-y divide-stone-200 dark:divide-stone-800">{h.orders.map((o) => orderItem(o as Row))}</ul>
              </details>
            ))}
          </div>
        ) : (
          <EmptyState title="Todavía no hay pedidos." />
        )}
      </section>
    </main>
  );
}
