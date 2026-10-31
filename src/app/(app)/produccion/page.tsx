import Link from "next/link";
import ProductionCalculators from "@/components/ProductionCalculators";
import { currentOfferWeek, isoWeek, type OfferItem, type Product } from "@/lib/favorita";
import { grainPlan } from "@/lib/produccion";
import { requireProfile } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function ProductionPage() {
  const { supabase, isAdmin } = await requireProfile();
  const week = currentOfferWeek(new Date());

  // La oferta es de la administradora (RLS): los demás solo ven las calculadoras.
  const [{ data: products }, { data: offer }] = isAdmin
    ? await Promise.all([
        supabase.from("favorita_products").select("*"),
        supabase.from("favorita_offers").select("favorita_offer_items(product_id, delivery_day, javas)").eq("week_start", week).maybeSingle(),
      ])
    : [{ data: [] }, { data: null }];
  const plan = grainPlan((products ?? []) as Product[], (offer?.favorita_offer_items ?? []) as OfferItem[]);
  const hasPlan = plan.some((d) => d.rows.length);

  return (
    <main>
      <h1 className="mb-4 text-2xl font-bold">Producción</h1>

      {isAdmin && (
        <section className="card mb-8">
          <h2 className="mb-1 text-lg font-bold">Grano para la oferta de la semana {isoWeek(week).week}</h2>
          <p className="mb-3 text-sm text-stone-600 dark:text-stone-400">Cocción: lunes para el martes y jueves para el viernes (llega un aviso el día anterior para remojar).</p>
          {hasPlan ? (
            <div className="space-y-4">
              {plan.filter((d) => d.rows.length).map((d) => (
                <div key={d.day}>
                  <p className="font-semibold">Entrega del {d.label.toLowerCase()}: remojar {d.dryKg.toLocaleString("es-EC")} kg</p>
                  <ul className="text-sm text-stone-600 dark:text-stone-400">
                    {d.rows.map((r) => (
                      <li key={r.product}>{r.product}: {r.units} u. → {r.cookedKg.toLocaleString("es-EC")} kg cocido · {r.dryKg.toLocaleString("es-EC")} kg seco</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-stone-500 dark:text-stone-400">
              Sin datos: carga la oferta en <Link href="/favorita" className="underline">Favorita</Link> y los gramos y rendimiento de cada grano en <Link href="/favorita/productos" className="underline">Productos</Link>.
            </p>
          )}
        </section>
      )}

      <ProductionCalculators />
    </main>
  );
}
