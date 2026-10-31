import { saveProduct, saveSettings } from "../actions";
import ActionForm from "@/components/ActionForm";
import type { FavoritaSettings, Product } from "@/lib/favorita";
import { requireAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";

function ProductFields({ p }: { p?: Product }) {
  const id = p?.id ?? "nuevo";
  return (
    <>
      <div>
        <label className="label" htmlFor={`name-${id}`}>Nombre</label>
        <input className="field" id={`name-${id}`} name="name" defaultValue={p?.name} required placeholder="Ej. Garbanzo cocido 300 g" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor={`barcode-${id}`}>Código de barras</label>
          <input className="field" id={`barcode-${id}`} name="barcode" inputMode="numeric" defaultValue={p?.barcode ?? ""} />
        </div>
        <div>
          <label className="label" htmlFor={`code-${id}`}>Código del producto</label>
          <input className="field" id={`code-${id}`} name="product_code" defaultValue={p?.product_code ?? ""} />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="label" htmlFor={`upj-${id}`}>Unid. por java</label>
          <input className="field" id={`upj-${id}`} name="units_per_java" inputMode="numeric" defaultValue={p?.units_per_java ?? 8} required />
        </div>
        <div>
          <label className="label" htmlFor={`gpu-${id}`}>Gramos por unid.</label>
          <input className="field" id={`gpu-${id}`} name="grams_per_unit" inputMode="numeric" defaultValue={p?.grams_per_unit ?? ""} placeholder="300" />
        </div>
        <div>
          <label className="label" htmlFor={`yield-${id}`}>Rendimiento</label>
          <input className="field" id={`yield-${id}`} name="dry_yield" inputMode="decimal" defaultValue={p?.dry_yield ?? ""} placeholder="2" />
        </div>
      </div>
      <p className="text-sm text-stone-500 dark:text-stone-400">Gramos y rendimiento solo para granos cocidos: sirven para calcular cuánto grano remojar.</p>
      <label className="flex items-center gap-2">
        <input type="checkbox" name="active" defaultChecked={p?.active ?? true} className="size-5 accent-green-700" />
        Se oferta
      </label>
    </>
  );
}

export default async function ProductsPage() {
  const { supabase } = await requireAdmin();
  const [{ data: settings }, { data: products }] = await Promise.all([
    supabase.from("app_settings").select("supplier_code, acopio, van_capacity").single(),
    supabase.from("favorita_products").select("*").order("active", { ascending: false }).order("name"),
  ]);
  const s = settings as FavoritaSettings | null;

  return (
    <main>
      <h1 className="mb-4 text-2xl font-bold">Productos de Favorita</h1>

      <section className="card mb-8">
        <h2 className="mb-3 text-lg font-bold">Datos fijos de la oferta</h2>
        <ActionForm action={saveSettings} submit="Guardar datos">
          <div>
            <label className="label" htmlFor="supplier_code">Código de proveedor</label>
            <input className="field" id="supplier_code" name="supplier_code" defaultValue={s?.supplier_code ?? ""} />
          </div>
          <div>
            <label className="label" htmlFor="acopio">Centro de acopio</label>
            <input className="field" id="acopio" name="acopio" defaultValue={s?.acopio ?? "CAF 400 (Loja)"} />
          </div>
          <div>
            <label className="label" htmlFor="van_capacity">Javas que entran en la buseta</label>
            <input className="field" id="van_capacity" name="van_capacity" inputMode="numeric" defaultValue={s?.van_capacity ?? 100} />
          </div>
        </ActionForm>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-lg font-bold">Productos</h2>
        <details className="card mb-3">
          <summary className="cursor-pointer font-semibold text-green-800 dark:text-green-400">+ Agregar producto</summary>
          <ActionForm action={saveProduct.bind(null, null)} submit="Agregar" className="mt-4 space-y-4">
            <ProductFields />
          </ActionForm>
        </details>
        <ul className="space-y-3">
          {((products ?? []) as Product[]).map((p) => (
            <li key={p.id}>
              <details className={`card ${p.active ? "" : "opacity-60"}`}>
                <summary className="cursor-pointer">
                  <span className="font-semibold">{p.name}</span>
                  <span className="block text-sm text-stone-600 dark:text-stone-400">
                    {p.barcode ? `Barras ${p.barcode}` : "Sin código de barras"} · {p.units_per_java} u. por java{!p.active && " · no se oferta"}
                  </span>
                </summary>
                <ActionForm action={saveProduct.bind(null, p.id)} submit="Guardar" className="mt-4 space-y-4">
                  <ProductFields p={p} />
                </ActionForm>
              </details>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
