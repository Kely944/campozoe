import Link from "next/link";
import { createCreditNoteWatch, createCreditSale, markCreditPaid, resolveCreditNote, saveCreditDays } from "./actions";
import ActionForm from "@/components/ActionForm";
import { balancesByCustomer, creditNoteDeadline, daysSince, type CreditSale } from "@/lib/cobros";
import { requireProfile } from "@/lib/session";
import { formatDate, formatUSD, localDate } from "@/lib/time";

export const dynamic = "force-dynamic";

type Sale = CreditSale & { seller_id: string | null; profiles: { full_name: string } | null };
interface Watch {
  id: string;
  invoice_number: string;
  customer: string | null;
  issued_on: string;
  reason: string | null;
}

export default async function CollectionsPage() {
  const { supabase, user, isAdmin } = await requireProfile();
  const today = localDate(new Date());
  const [{ data: sales }, { data: settings }, { data: watches }, { data: receivables }] = await Promise.all([
    supabase
      .from("credit_sales")
      .select("id, customer, amount, sold_on, paid_on, seller_id, profiles!credit_sales_seller_id_fkey(full_name)")
      .is("paid_on", null)
      .order("sold_on"),
    supabase.from("app_settings").select("credit_days").single(),
    isAdmin ? supabase.from("credit_note_watch").select("*").is("resolved_at", null).order("issued_on") : Promise.resolve({ data: [] }),
    isAdmin ? supabase.from("receivables").select("customer, balance, issued_on") : Promise.resolve({ data: [] }),
  ]);
  // Cuentas por cobrar importadas del facturador (RF-32), por cliente.
  const billed = balancesByCustomer(
    ((receivables ?? []) as { customer: string; balance: number; issued_on: string | null }[]).map((r, i) => ({
      id: String(i),
      customer: r.customer,
      amount: Number(r.balance),
      sold_on: r.issued_on ?? today,
      paid_on: null,
    })),
  );
  const pending = (sales ?? []) as unknown as Sale[];
  const creditDays = settings?.credit_days ?? 14;
  const balances = balancesByCustomer(pending);
  const total = balances.reduce((s, b) => s + b.total, 0);

  return (
    <main>
      <div className="mb-4 flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">Cobros</h1>
        {isAdmin && <Link href="/cobros/favorita" className="btn-secondary">Pagos de Favorita</Link>}
      </div>

      <section className="card mb-8">
        <h2 className="mb-3 text-lg font-bold">Registrar venta fiada</h2>
        <ActionForm action={createCreditSale} submit="Guardar venta">
          <div>
            <label className="label" htmlFor="customer">Cliente (nombre o puesto)</label>
            <input className="field" id="customer" name="customer" required list="clientes" placeholder="Ej. Doña Rosa, puesto 12" />
            <datalist id="clientes">{balances.map((b) => <option key={b.customer} value={b.customer} />)}</datalist>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="amount">Monto (USD)</label>
              <input className="field" id="amount" name="amount" inputMode="decimal" required />
            </div>
            <div>
              <label className="label" htmlFor="sold_on">Fecha</label>
              <input className="field" id="sold_on" name="sold_on" type="date" defaultValue={today} max={today} required />
            </div>
          </div>
          <div>
            <label className="label" htmlFor="notes">Nota (opcional)</label>
            <input className="field" id="notes" name="notes" placeholder="Qué se llevó" />
          </div>
          <p className="text-sm text-stone-500 dark:text-stone-400">Si no paga en {creditDays} días, llega un aviso a quien vendió y a Majo.</p>
        </ActionForm>
      </section>

      <section className="mb-8">
        <h2 className="mb-1 text-lg font-bold">Saldos por cliente</h2>
        <p className="mb-3 text-stone-600 dark:text-stone-400">Total por cobrar: <strong className="text-stone-900 dark:text-stone-100">{formatUSD(total)}</strong></p>
        {balances.length ? (
          <ol className="card divide-y divide-stone-200 py-1 dark:divide-stone-800">
            {balances.map((b) => (
              <li key={b.customer} className="flex items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  <p className="font-semibold">{b.customer}</p>
                  <p className="text-sm text-stone-500 dark:text-stone-400">{b.count} {b.count === 1 ? "venta" : "ventas"} · desde {formatDate(b.oldest)}</p>
                </div>
                <span className="shrink-0 font-semibold tabular-nums">{formatUSD(b.total)}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-stone-500 dark:text-stone-400">Nadie debe nada. 🎉</p>
        )}
      </section>

      {pending.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-lg font-bold">Ventas por cobrar</h2>
          <ul className="space-y-3">
            {pending.map((s) => {
              const days = daysSince(s.sold_on, today);
              const late = days >= creditDays;
              return (
                <li key={s.id} className={`card ${late ? "border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/40" : ""}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold">{s.customer} · {formatUSD(Number(s.amount))}</p>
                      <p className={`text-sm ${late ? "font-semibold text-red-700 dark:text-red-400" : "text-stone-600 dark:text-stone-400"}`}>
                        {formatDate(s.sold_on)} · hace {days} {days === 1 ? "día" : "días"} · vendió {s.profiles?.full_name ?? "—"}
                      </p>
                    </div>
                    {(s.seller_id === user.id || isAdmin) && (
                      <form action={markCreditPaid.bind(null, s.id)}>
                        <button className="btn-primary shrink-0">Cobrado</button>
                      </form>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {isAdmin && (
        <>
          <section className="mb-8">
            <h2 className="mb-1 text-lg font-bold">Plazo de nota de crédito</h2>
            <p className="mb-3 text-sm text-stone-600 dark:text-stone-400">Hay 8 días laborables desde la factura para anularla con nota de crédito.</p>
            <details className="card mb-3">
              <summary className="cursor-pointer font-semibold text-green-800 dark:text-green-400">+ Vigilar una factura</summary>
              <ActionForm action={createCreditNoteWatch} submit="Vigilar" className="mt-4 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label" htmlFor="invoice_number">N.º de factura</label>
                    <input className="field" id="invoice_number" name="invoice_number" required />
                  </div>
                  <div>
                    <label className="label" htmlFor="issued_on">Fecha de la factura</label>
                    <input className="field" id="issued_on" name="issued_on" type="date" defaultValue={today} max={today} required />
                  </div>
                </div>
                <div>
                  <label className="label" htmlFor="nc_customer">Cliente (opcional)</label>
                  <input className="field" id="nc_customer" name="customer" />
                </div>
                <div>
                  <label className="label" htmlFor="reason">Motivo (opcional)</label>
                  <input className="field" id="reason" name="reason" placeholder="Ej. no pagó, producto devuelto" />
                </div>
              </ActionForm>
            </details>
            {((watches ?? []) as Watch[]).length ? (
              <ul className="space-y-3">
                {((watches ?? []) as Watch[]).map((w) => {
                  const deadline = creditNoteDeadline(w.issued_on);
                  const late = deadline < today;
                  return (
                    <li key={w.id} className={`card ${late ? "opacity-60" : ""}`}>
                      <p className="font-semibold">Factura {w.invoice_number}{w.customer && ` · ${w.customer}`}</p>
                      <p className={`text-sm ${late ? "text-stone-500" : "font-semibold text-amber-800 dark:text-amber-300"}`}>
                        {late ? "Plazo vencido el" : "Último día:"} {formatDate(deadline)}{w.reason && ` · ${w.reason}`}
                      </p>
                      <form action={resolveCreditNote.bind(null, w.id)} className="mt-3">
                        <button className="btn-secondary w-full text-sm">Listo (nota hecha o ya no hace falta)</button>
                      </form>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-stone-500 dark:text-stone-400">No hay facturas vigiladas.</p>
            )}
          </section>

          {billed.length > 0 && (
            <section className="mb-8">
              <h2 className="mb-1 text-lg font-bold">Por cobrar según el facturador</h2>
              <p className="mb-3 text-sm text-stone-600 dark:text-stone-400">Del último Excel importado en Reportes.</p>
              <ol className="card divide-y divide-stone-200 py-1 dark:divide-stone-800">
                {billed.map((b) => (
                  <li key={b.customer} className="flex items-center justify-between gap-3 py-2">
                    <div className="min-w-0">
                      <p className="font-semibold">{b.customer}</p>
                      <p className="text-sm text-stone-500 dark:text-stone-400">{b.count} {b.count === 1 ? "factura" : "facturas"} · desde {formatDate(b.oldest)}</p>
                    </div>
                    <span className="shrink-0 font-semibold tabular-nums">{formatUSD(b.total)}</span>
                  </li>
                ))}
              </ol>
            </section>
          )}

          <section className="card">
            <h2 className="mb-3 font-bold">¿A los cuántos días avisar un cobro?</h2>
            <ActionForm action={saveCreditDays} submit="Guardar" className="space-y-3">
              <label className="label" htmlFor="credit_days">Días</label>
              <input className="field" id="credit_days" name="credit_days" type="number" min={1} max={90} defaultValue={creditDays} />
            </ActionForm>
          </section>
        </>
      )}
    </main>
  );
}
