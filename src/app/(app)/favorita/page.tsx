import Link from "next/link";
import { markDelivered, registerInvoice, saveOffer, setOfferItemSent } from "./actions";
import ActionForm from "@/components/ActionForm";
import CopyButton from "@/components/CopyButton";
import OfferForm from "@/components/OfferForm";
import { DELIVERY_DAYS, currentOfferWeek, isoWeek, offerCopyText, offerDeadline, weekStart, type FavoritaSettings, type OfferItem, type Product } from "@/lib/favorita";
import { requireAdmin } from "@/lib/session";
import { addDays, formatDate, formatDue, formatUSD, localDate, relative } from "@/lib/time";

export const dynamic = "force-dynamic";

interface PurchaseOrder {
  id: string;
  week: number;
  delivery_at: string;
  delivered_at: string | null;
  invoice_number: string | null;
  invoice_amount: number | null;
  profiles: { full_name: string } | null;
  purchase_order_items: { units: number; favorita_products: { name: string } | null }[];
}

export default async function FavoritaPage({ searchParams }: { searchParams: Promise<{ semana?: string }> }) {
  const { supabase } = await requireAdmin();
  const now = new Date();
  const { semana } = await searchParams;
  const week = /^\d{4}-\d{2}-\d{2}$/.test(semana ?? "") ? weekStart(semana!) : currentOfferWeek(now);
  const { week: weekNumber } = isoWeek(week);

  const [{ data: settings }, { data: products }, { data: offer }, { data: orders }] = await Promise.all([
    supabase.from("app_settings").select("supplier_code, acopio, van_capacity").single(),
    supabase.from("favorita_products").select("*").eq("active", true).order("name"),
    supabase.from("favorita_offers").select("id, link, favorita_offer_items(product_id, delivery_day, javas, sent)").eq("week_start", week).maybeSingle(),
    supabase
      .from("purchase_orders")
      .select("id, week, delivery_at, delivered_at, invoice_number, invoice_amount, profiles(full_name), purchase_order_items(units, favorita_products(name))")
      .order("delivery_at", { ascending: false })
      .limit(12),
  ]);
  const s = (settings ?? { supplier_code: null, acopio: "CAF 400 (Loja)", van_capacity: 100 }) as FavoritaSettings;
  const prods = (products ?? []) as Product[];
  const byId = new Map(prods.map((p) => [p.id, p]));
  const items = ((offer?.favorita_offer_items ?? []) as OfferItem[]).sort((a, b) => a.delivery_day - b.delivery_day);
  const pos = (orders ?? []) as unknown as PurchaseOrder[];
  const noInvoice = pos.filter((o) => o.delivered_at && !o.invoice_number);
  const deadline = offerDeadline(week);

  return (
    <main>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">Favorita</h1>
        <div className="flex gap-2">
          <Link href="/favorita/productos" className="btn-secondary">Productos</Link>
          <Link href="/favorita/ordenes/nueva" className="btn-primary">+ Orden</Link>
        </div>
      </div>

      {noInvoice.length > 0 && (
        <div role="alert" className="mb-6 rounded-2xl border border-red-300 bg-red-50 p-4 text-red-900 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">
          <p className="font-bold">Órdenes entregadas sin factura</p>
          <p className="text-sm">Sin factura no se cobra: {noInvoice.map((o) => `semana ${o.week}`).join(", ")}.</p>
        </div>
      )}

      <section className="card mb-8">
        <div className="mb-3 flex items-center justify-between gap-2">
          <Link href={`/favorita?semana=${addDays(week, -7)}`} className="btn-secondary min-w-12 px-3" aria-label="Semana anterior">‹</Link>
          <div className="text-center">
            <h2 className="text-lg font-bold">Oferta semana {weekNumber}</h2>
            <p className={`text-sm ${deadline < now ? "text-stone-500 dark:text-stone-400" : "font-semibold text-amber-800 dark:text-amber-300"}`}>
              Cierra {formatDue(deadline)} · {relative(deadline, now)}
            </p>
          </div>
          <Link href={`/favorita?semana=${addDays(week, 7)}`} className="btn-secondary min-w-12 px-3" aria-label="Semana siguiente">›</Link>
        </div>
        <OfferForm key={week} action={saveOffer.bind(null, week)} products={prods} items={items} link={offer?.link ?? null} capacity={s.van_capacity} />
      </section>

      {items.length > 0 && (
        <section className="mb-8">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-lg font-bold">Lista para copiar ({items.filter((i) => i.sent).length}/{items.length} enviados)</h2>
            {offer?.link && <a href={offer.link} target="_blank" rel="noopener noreferrer" className="btn-primary text-sm">Abrir enlace</a>}
          </div>
          <p className="mb-3 text-sm text-stone-600 dark:text-stone-400">Un formulario por producto: abre el enlace, copia los datos y marca “Enviado”.</p>
          <ul className="space-y-3">
            {items.map((i) => {
              const p = byId.get(i.product_id);
              if (!p) return null;
              const text = offerCopyText(p, i, s);
              return (
                <li key={`${i.product_id}_${i.delivery_day}`} className={`card ${i.sent ? "opacity-60" : ""}`}>
                  <p className="font-semibold">{p.name} · {DELIVERY_DAYS[i.delivery_day]} · {i.javas} javas</p>
                  <pre className="my-2 whitespace-pre-wrap rounded-xl bg-stone-100 p-3 font-sans text-sm dark:bg-stone-800">{text}</pre>
                  <div className="flex gap-2">
                    <CopyButton text={text} />
                    <form action={setOfferItemSent.bind(null, offer!.id, i.product_id, i.delivery_day, !i.sent)}>
                      <button className={i.sent ? "btn-secondary text-sm" : "btn-primary text-sm"}>{i.sent ? "Deshacer" : "Enviado"}</button>
                    </form>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-lg font-bold">Órdenes de compra</h2>
        {pos.length ? (
          <ul className="space-y-3">
            {pos.map((o) => (
              <li key={o.id} className={`card ${o.delivered_at && !o.invoice_number ? "border-red-300 dark:border-red-800" : ""}`}>
                <p className="font-semibold">Semana {o.week} · entrega {formatDue(new Date(o.delivery_at))}</p>
                <p className="text-sm text-stone-600 dark:text-stone-400">
                  {o.purchase_order_items.map((i) => `${i.favorita_products?.name ?? "?"}: ${i.units} u.`).join(" · ")}
                  {o.profiles && ` · lleva ${o.profiles.full_name}`}
                </p>
                <p className="mt-1 text-sm font-semibold">
                  {o.invoice_number
                    ? `Factura ${o.invoice_number} · ${formatUSD(Number(o.invoice_amount))}`
                    : o.delivered_at
                      ? <span className="text-red-700 dark:text-red-400">Entregada el {formatDate(localDate(new Date(o.delivered_at)))} · falta la factura</span>
                      : "Por entregar"}
                </p>
                {!o.delivered_at && (
                  <form action={markDelivered.bind(null, o.id)} className="mt-3">
                    <button className="btn-primary w-full">Ya se entregó</button>
                  </form>
                )}
                {!o.invoice_number && (
                  <details className="mt-3">
                    <summary className="cursor-pointer text-sm font-semibold text-green-800 dark:text-green-400">Registrar factura</summary>
                    <ActionForm action={registerInvoice.bind(null, o.id)} submit="Guardar factura" className="mt-3 space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="label" htmlFor={`inv-${o.id}`}>N.º de factura</label>
                          <input className="field" id={`inv-${o.id}`} name="invoice_number" required />
                        </div>
                        <div>
                          <label className="label" htmlFor={`amt-${o.id}`}>Total (USD)</label>
                          <input className="field" id={`amt-${o.id}`} name="invoice_amount" inputMode="decimal" required />
                        </div>
                      </div>
                    </ActionForm>
                  </details>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-stone-500 dark:text-stone-400">Cuando llegue una orden de compra, regístrala con “+ Orden” para recibir el aviso de entrega.</p>
        )}
      </section>
    </main>
  );
}
