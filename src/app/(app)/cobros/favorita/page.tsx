import { saveFavoritaPayment } from "../actions";
import ReconcileForm from "@/components/ReconcileForm";
import { requireAdmin } from "@/lib/session";
import { formatDate, formatUSD, localDate } from "@/lib/time";

export const dynamic = "force-dynamic";

interface Payment {
  id: string;
  received_on: string;
  amount: number;
  reference: string | null;
  purchase_orders: { invoice_number: string; invoice_amount: number }[];
}

export default async function FavoritaPaymentsPage() {
  const { supabase } = await requireAdmin();
  const [{ data: open }, { data: payments }] = await Promise.all([
    supabase
      .from("purchase_orders")
      .select("id, week, invoice_number, invoice_amount, delivery_at")
      .not("invoice_number", "is", null)
      .is("payment_id", null)
      .order("delivery_at"),
    supabase.from("favorita_payments").select("id, received_on, amount, reference, purchase_orders(invoice_number, invoice_amount)").order("received_on", { ascending: false }).limit(20),
  ]);
  const invoices = (open ?? []).map((o) => ({
    id: o.id,
    label: `Factura ${o.invoice_number} · semana ${o.week}`,
    amount: Number(o.invoice_amount),
    date: o.delivery_at,
  }));
  const owed = invoices.reduce((s, i) => s + i.amount, 0);

  return (
    <main>
      <h1 className="mb-1 text-2xl font-bold">Pagos de Favorita</h1>
      <p className="mb-4 text-stone-600 dark:text-stone-400">Facturas por cobrar: <strong className="text-stone-900 dark:text-stone-100">{formatUSD(owed)}</strong></p>

      <section className="card mb-8">
        <h2 className="mb-3 text-lg font-bold">Registrar pago recibido</h2>
        {invoices.length ? (
          <ReconcileForm action={saveFavoritaPayment} invoices={invoices} today={localDate(new Date())} />
        ) : (
          <p className="text-stone-500 dark:text-stone-400">No hay facturas pendientes de pago. Las facturas se registran en cada orden de compra.</p>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-bold">Pagos registrados</h2>
        {(payments ?? []).length ? (
          <ul className="space-y-3">
            {((payments ?? []) as Payment[]).map((p) => {
              const sum = p.purchase_orders.reduce((s, o) => s + Number(o.invoice_amount), 0);
              const diff = Math.round((Number(p.amount) - sum) * 100) / 100;
              return (
                <li key={p.id} className="card">
                  <div className="flex justify-between gap-3">
                    <p className="font-semibold">{formatDate(p.received_on)}{p.reference && ` · ${p.reference}`}</p>
                    <span className="font-semibold tabular-nums">{formatUSD(Number(p.amount))}</span>
                  </div>
                  <p className="text-sm text-stone-600 dark:text-stone-400">{p.purchase_orders.map((o) => o.invoice_number).join(", ") || "Sin facturas"}</p>
                  <p className={`text-sm font-semibold ${diff === 0 ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"}`}>
                    {diff === 0 ? "Cuadra exacto" : `Diferencia: ${formatUSD(diff)}`}
                  </p>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-stone-500 dark:text-stone-400">Todavía no hay pagos registrados.</p>
        )}
      </section>
    </main>
  );
}
