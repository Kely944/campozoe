import { createPurchaseOrder } from "../../actions";
import EmptyState from "@/components/EmptyState";
import ActionForm from "@/components/ActionForm";
import { isoWeek, type Product } from "@/lib/favorita";
import { requireAdmin } from "@/lib/session";
import { localDate } from "@/lib/time";

export default async function NewPurchaseOrderPage() {
  const { supabase } = await requireAdmin();
  const [{ data: products }, { data: people }] = await Promise.all([
    supabase.from("favorita_products").select("*").eq("active", true).order("name"),
    supabase.from("profiles").select("id, full_name").order("full_name"),
  ]);
  const prods = (products ?? []) as Product[];

  return (
    <main>
      <h1 className="mb-6 font-display text-3xl leading-tight font-semibold">Nueva orden de compra</h1>
      <ActionForm action={createPurchaseOrder} submit="Guardar orden" className="space-y-5">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="week">Semana</label>
            <input className="field" id="week" name="week" inputMode="numeric" defaultValue={isoWeek(localDate(new Date())).week} required />
          </div>
          <div>
            <label className="label" htmlFor="driver_id">¿Quién entrega?</label>
            <select className="field" id="driver_id" name="driver_id" defaultValue="">
              <option value="">Administradora</option>
              {(people ?? []).map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="label" htmlFor="delivery_local">Día y hora de entrega asignados</label>
          <input className="field" id="delivery_local" name="delivery_local" type="datetime-local" required />
        </div>
        <fieldset className="card space-y-3">
          <legend className="px-1 font-bold">Unidades pedidas</legend>
          {prods.length ? (
            prods.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-3">
                <label htmlFor={`units-${p.id}`} className="min-w-0">{p.name}</label>
                <input className="field w-28 text-center" id={`units-${p.id}`} name={`units_${p.id}`} inputMode="numeric" placeholder="0" />
              </div>
            ))
          ) : (
            <EmptyState title="Primero agrega productos en Favorita › Productos." />
          )}
        </fieldset>
        <div>
          <label className="label" htmlFor="notes">Nota (opcional)</label>
          <input className="field" id="notes" name="notes" />
        </div>
      </ActionForm>
    </main>
  );
}
