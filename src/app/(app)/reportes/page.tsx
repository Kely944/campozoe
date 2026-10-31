import { importFile } from "./actions";
import EmptyState from "@/components/EmptyState";
import ActionForm from "@/components/ActionForm";
import { fetchAll } from "@/lib/dashboard";
import { IMPORT_KINDS } from "@/lib/importacion";
import { salesReport, type SaleRow } from "@/lib/reportes";
import { requireAdmin } from "@/lib/session";
import { formatUSD, localDate } from "@/lib/time";

export const dynamic = "force-dynamic";

const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const isDate = (s?: string) => /^\d{4}-\d{2}-\d{2}$/.test(s ?? "");

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ desde?: string; hasta?: string; producto?: string }> }) {
  const { supabase } = await requireAdmin();
  const today = localDate(new Date());
  const sp = await searchParams;
  const from = isDate(sp.desde) ? sp.desde! : `${today.slice(0, 4)}-01-01`;
  const to = isDate(sp.hasta) ? sp.hasta! : today;
  const product = sp.producto ?? "champi";

  const [rows, { count }] = await Promise.all([
    fetchAll<SaleRow>((a, b) =>
      supabase.from("sales").select("sold_on, customer, product, units, amount").gte("sold_on", from).lte("sold_on", to).order("sold_on").order("id").range(a, b),
    ),
    supabase.from("sales").select("id", { count: "exact", head: true }),
  ]);
  const r = salesReport(rows, product);
  const maxMonth = Math.max(1, ...r.months.map((m) => m.units));

  return (
    <main>
      <h1 className="mb-6 font-display text-3xl leading-tight font-semibold">Reportes</h1>

      <form className="card mb-6 grid grid-cols-2 gap-3" method="get">
        <div>
          <label className="label" htmlFor="desde">Desde</label>
          <input className="field" id="desde" name="desde" type="date" defaultValue={from} />
        </div>
        <div>
          <label className="label" htmlFor="hasta">Hasta</label>
          <input className="field" id="hasta" name="hasta" type="date" defaultValue={to} />
        </div>
        <div className="col-span-2">
          <label className="label" htmlFor="producto">Producto (vacío = todos)</label>
          <input className="field" id="producto" name="producto" defaultValue={product} />
        </div>
        <button className="btn-primary col-span-2">Ver reporte</button>
      </form>

      {count ? (
        <>
          <section className="mb-6 grid grid-cols-2 gap-3">
            <div className="card">
              <p className="text-sm text-stone-600 dark:text-stone-400">Unidades vendidas</p>
              <p className="text-2xl font-bold tabular-nums">{r.units.toLocaleString("es-EC")}</p>
            </div>
            <div className="card">
              <p className="text-sm text-stone-600 dark:text-stone-400">Total vendido</p>
              <p className="text-2xl font-bold tabular-nums">{formatUSD(r.amount)}</p>
            </div>
          </section>

          {r.months.length > 0 && (
            <section className="card mb-6">
              <h2 className="mb-3 text-xl font-semibold">Por mes (unidades)</h2>
              <ul className="space-y-2">
                {r.months.map((m) => (
                  <li key={m.month} className="grid grid-cols-[4.5rem_1fr_auto] items-center gap-2 text-sm">
                    <span>{MONTHS[Number(m.month.slice(5)) - 1]} {m.month.slice(2, 4)}</span>
                    <span className="h-3 rounded-full bg-green-700 dark:bg-green-500" style={{ width: `${(m.units / maxMonth) * 100}%` }} aria-hidden />
                    <span className="tabular-nums">{m.units.toLocaleString("es-EC")}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="mb-8">
            <h2 className="mb-3 text-xl font-semibold">Por cliente</h2>
            {r.customers.length ? (
              <ol className="card divide-y divide-stone-200 py-1 dark:divide-stone-800">
                {r.customers.map((c) => (
                  <li key={c.customer} className="flex items-center justify-between gap-3 py-2">
                    <span className="min-w-0 font-semibold">{c.customer}</span>
                    <span className="shrink-0 text-right text-sm tabular-nums">
                      {c.units.toLocaleString("es-EC")} u.<br />
                      <span className="text-stone-500 dark:text-stone-400">{formatUSD(c.amount)}</span>
                    </span>
                  </li>
                ))}
              </ol>
            ) : (
              <EmptyState title="No hay ventas de ese producto en el periodo." />
            )}
          </section>
        </>
      ) : (
        <p className="mb-8 rounded-2xl bg-amber-50 p-4 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          Todavía no hay ventas importadas. Exporta el reporte de ventas del facturador a Excel y súbelo abajo.
        </p>
      )}

      <section className="card">
        <h2 className="mb-1 text-xl font-semibold">Importar del facturador</h2>
        <p className="mb-3 text-sm text-stone-600 dark:text-stone-400">
          Archivo .xlsx o .csv con una fila de títulos (Fecha, Cliente, Producto, Cantidad, Total…). Importar dos veces el mismo archivo no duplica ventas.
          Las cuentas por cobrar reemplazan a las anteriores.
        </p>
        <ActionForm action={importFile} submit="Importar">
          <div>
            <label className="label" htmlFor="kind">¿Qué vas a importar?</label>
            <select className="field" id="kind" name="kind" defaultValue="ventas">
              {Object.entries(IMPORT_KINDS).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="file">Archivo</label>
            <input className="field" id="file" name="file" type="file" accept=".xlsx,.csv" required />
          </div>
        </ActionForm>
      </section>
    </main>
  );
}
