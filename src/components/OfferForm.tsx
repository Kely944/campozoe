"use client";

import { useActionState, useState } from "react";
import type { FormState } from "@/app/actions";
import FormMessage from "@/components/FormMessage";
import { DELIVERY_DAYS, capacityByDay, type DeliveryDay, type OfferItem, type Product } from "@/lib/favorita";

interface Props {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  products: Product[];
  items: OfferItem[];
  link: string | null;
  capacity: number;
}

/** RF-08, RF-10, RF-11: enlace de la semana y javas por producto con el total de la buseta en vivo. */
export default function OfferForm({ action, products, items, link, capacity }: Props) {
  const [state, formAction, pending] = useActionState(action, {});
  const [javas, setJavas] = useState<Record<string, string>>(() =>
    Object.fromEntries(items.map((i) => [`${i.product_id}_${i.delivery_day}`, String(i.javas)])),
  );
  const current: OfferItem[] = Object.entries(javas)
    .map(([k, v]) => {
      const [product_id, day] = k.split("_");
      return { product_id, delivery_day: Number(day) as DeliveryDay, javas: Number(v) || 0 };
    })
    .filter((i) => i.javas > 0);
  const cap = capacityByDay(current, capacity);

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label className="label" htmlFor="link">Enlace de la oferta (llega el lunes por WhatsApp)</label>
        <input className="field" id="link" name="link" type="url" inputMode="url" defaultValue={link ?? ""} placeholder="https://forms.gle/…" />
      </div>

      {products.length ? (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-sm text-stone-600 dark:text-stone-400">
                <th className="py-2 pr-2 font-semibold">Producto</th>
                {Object.values(DELIVERY_DAYS).map((d) => <th key={d} className="w-24 px-1 py-2 text-center font-semibold">{d}</th>)}
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id} className="border-t border-stone-200 dark:border-stone-800">
                  <th scope="row" className="py-2 pr-2 font-normal">
                    {p.name}
                    <span className="block text-xs text-stone-500 dark:text-stone-400">{p.units_per_java} u. por java</span>
                  </th>
                  {([3, 5] as DeliveryDay[]).map((day) => {
                    const key = `${p.id}_${day}`;
                    return (
                      <td key={day} className="px-1 py-2">
                        <input
                          className="field px-2 text-center"
                          name={`javas_${key}`}
                          inputMode="numeric"
                          aria-label={`Javas de ${p.name} para ${DELIVERY_DAYS[day]}`}
                          value={javas[key] ?? ""}
                          onChange={(e) => setJavas({ ...javas, [key]: e.target.value.replace(/\D/g, "") })}
                          placeholder="0"
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-stone-500 dark:text-stone-400">Primero agrega los productos que ofertas en “Productos”.</p>
      )}

      <ul className="grid grid-cols-2 gap-2" aria-live="polite">
        {cap.map((c) => (
          <li key={c.day} className={`rounded-xl px-3 py-2 text-sm ${c.over ? "bg-red-50 font-semibold text-red-800 dark:bg-red-950/40 dark:text-red-300" : "bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-300"}`}>
            {c.label}: {c.javas} de {capacity} javas
            {c.over && <span className="block">No entra en la buseta: sobran {-c.free}</span>}
          </li>
        ))}
      </ul>

      <FormMessage state={state} />
      <button className="btn-primary w-full" disabled={pending}>{pending ? "Guardando…" : "Guardar oferta"}</button>
    </form>
  );
}
