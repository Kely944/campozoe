import Link from "next/link";
import { createCheque, setChequeStatus } from "./actions";
import ChequeForm from "@/components/ChequeForm";
import { CHEQUE_STATUS, PAYMENT_KINDS, maskAccount, monthCalendar, type Cheque, type Payment } from "@/lib/pagos";
import { requireAdmin } from "@/lib/session";
import { formatDate, formatUSD, localDate } from "@/lib/time";

export const dynamic = "force-dynamic";

const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

function shiftMonth(year: number, month: number, delta: number) {
  const d = new Date(Date.UTC(year, month - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export default async function PaymentsPage({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const { supabase } = await requireAdmin();
  const today = localDate(new Date());
  const { mes } = await searchParams;
  const [year, month] = (/^\d{4}-\d{2}$/.test(mes ?? "") ? mes! : today.slice(0, 7)).split("-").map(Number);

  const [{ data: payments }, { data: cheques }] = await Promise.all([
    supabase.from("payments").select("*").order("day_of_month"),
    supabase.from("cheques").select("*").order("cash_on", { ascending: false }).limit(100),
  ]);
  const pays = (payments ?? []) as Payment[];
  const chqs = (cheques ?? []) as Cheque[];
  const cal = monthCalendar(pays, chqs, year, month);

  return (
    <main>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Pagos</h1>
        <Link href="/pagos/nuevo" className="btn-primary">+ Nuevo</Link>
      </div>

      <section className="card mb-8">
        <div className="mb-3 flex items-center justify-between gap-2">
          <Link href={`/pagos?mes=${shiftMonth(year, month, -1)}`} className="btn-secondary min-w-12 px-3" aria-label="Mes anterior">‹</Link>
          <h2 className="text-center text-lg font-bold capitalize">{MONTHS[month - 1]} {year}</h2>
          <Link href={`/pagos?mes=${shiftMonth(year, month, 1)}`} className="btn-secondary min-w-12 px-3" aria-label="Mes siguiente">›</Link>
        </div>
        <p className="mb-4 text-center text-stone-600 dark:text-stone-400">
          Total del mes: <strong className="text-stone-900 dark:text-stone-100">{formatUSD(cal.total)}</strong>
        </p>
        <ol className="space-y-4">
          {cal.weeks.map((w) => (
            <li key={w.start}>
              <div className="flex items-baseline justify-between border-b border-stone-200 pb-1 text-sm font-semibold text-stone-600 dark:border-stone-800 dark:text-stone-400">
                <span>{w.start === w.end ? `Día ${+w.start.slice(8)}` : `Días ${+w.start.slice(8)} al ${+w.end.slice(8)}`}</span>
                <span>Semana: {formatUSD(w.total)}</span>
              </div>
              {w.items.length ? (
                <ul>
                  {w.items.map((i, n) => (
                    <li key={n} className={`flex justify-between gap-3 py-2 ${i.date < today ? "opacity-60" : ""}`}>
                      <div className="min-w-0">
                        <p className="font-semibold">{i.label}</p>
                        <p className="text-sm text-stone-500 dark:text-stone-400">{formatDate(i.date)}{i.detail && ` · ${i.detail}`}</p>
                      </div>
                      <span className="shrink-0 font-semibold tabular-nums">{formatUSD(i.amount)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="py-2 text-sm text-stone-400 dark:text-stone-500">Sin pagos</p>
              )}
            </li>
          ))}
        </ol>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-lg font-bold">Préstamos y pagos fijos</h2>
        {pays.length ? (
          <ul className="space-y-3">
            {pays.map((p) => (
              <li key={p.id}>
                <Link href={`/pagos/${p.id}`} className={`card block ${p.active ? "" : "opacity-50"}`}>
                  <div className="flex justify-between gap-3">
                    <p className="font-semibold">{p.name}{!p.active && " (pausado)"}</p>
                    <span className="font-semibold tabular-nums">{formatUSD(Number(p.amount))}</span>
                  </div>
                  <p className="text-sm text-stone-600 dark:text-stone-400">
                    {PAYMENT_KINDS[p.kind]} · día {p.day_of_month}
                    {p.bank && ` · ${p.bank}`}
                    {p.debit_account && ` cta. ${maskAccount(p.debit_account)}`} · aviso {p.notice_days} {p.notice_days === 1 ? "día" : "días"} antes
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-stone-500 dark:text-stone-400">Registra cada préstamo y pago fijo para recibir el aviso de transferencia.</p>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-bold">Cheques</h2>
        <details className="card mb-4">
          <summary className="cursor-pointer font-semibold text-green-800 dark:text-green-400">+ Registrar cheque</summary>
          <ChequeForm action={createCheque} today={today} />
        </details>
        {chqs.length ? (
          <ul className="space-y-3">
            {chqs.map((c) => (
              <li key={c.id} className={`card ${c.status === "emitido" ? "" : "opacity-60"}`}>
                <div className="flex justify-between gap-3">
                  <p className="font-semibold">N.º {c.number} · {c.beneficiary}</p>
                  <span className="font-semibold tabular-nums">{formatUSD(Number(c.amount))}</span>
                </div>
                <p className="text-sm text-stone-600 dark:text-stone-400">
                  Fecha del cheque: {formatDate(c.cash_on)}{c.bank && ` · ${c.bank}`} · {CHEQUE_STATUS[c.status]}
                </p>
                {c.status === "emitido" && (
                  <div className="mt-3 flex gap-2">
                    <form action={setChequeStatus.bind(null, c.id, "cobrado")}><button className="btn-secondary text-sm">Ya lo cobraron</button></form>
                    <form action={setChequeStatus.bind(null, c.id, "anulado")}><button className="btn-secondary text-sm">Anular</button></form>
                  </div>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-stone-500 dark:text-stone-400">No hay cheques registrados.</p>
        )}
      </section>
    </main>
  );
}
