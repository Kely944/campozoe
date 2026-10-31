import { weekdayOf } from "./time";

/** Proveedores habituales (TRA audio 1): unidad de pedido y kilos por unidad. */
export const SUPPLIERS = [
  { name: "Champiñón", unit: "corchos de 14 kg", kgPerUnit: 14 },
  { name: "Etiquetas", unit: "pedidos", kgPerUnit: null },
  { name: "Harinas y molinería", unit: "quintales", kgPerUnit: null },
] as const;

export const OTHER_SUPPLIER = "Otro";

/**
 * RF-20: el pedido de champiñón que llega sábado, domingo o lunes cubre el fin de semana:
 * si se olvida, quedan hasta 3 días sin producto.
 */
export function coversWeekend(forDate: string): boolean {
  return [6, 0, 1].includes(weekdayOf(forDate));
}

export interface SupplierOrderInput {
  supplier: string;
  for_date: string;
  quantity: number;
  unit: string;
  notes: string | null;
  occurrence_id: string | null; // tarea de hoy que se cumple con este pedido
}

type FormLike = { get(name: string): FormDataEntryValue | null };
const str = (f: FormLike, name: string) => String(f.get(name) ?? "").trim();

export function parseSupplierOrderForm(f: FormLike): { data: SupplierOrderInput } | { error: string } {
  const choice = str(f, "supplier");
  const supplier = choice === OTHER_SUPPLIER ? str(f, "supplier_other") : choice;
  if (!supplier) return { error: "Elige el proveedor." };
  const quantity = Number(str(f, "quantity").replace(",", "."));
  if (!Number.isFinite(quantity) || quantity <= 0) return { error: "Escribe la cantidad pedida." };
  const for_date = str(f, "for_date");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(for_date)) return { error: "Elige para qué día es el pedido." };
  const preset = SUPPLIERS.find((s) => s.name === supplier);
  return {
    data: {
      supplier,
      for_date,
      quantity,
      unit: preset?.unit ?? (str(f, "unit") || "unidades"),
      notes: str(f, "notes") || null,
      occurrence_id: str(f, "occurrence_id") || null,
    },
  };
}

export interface SupplierOrderRow {
  id: string;
  supplier: string;
  for_date: string;
  quantity: number;
  unit: string;
}

export interface SupplierHistory {
  supplier: string;
  count: number;
  total: number;
  unit: string;
  lastDate: string;
  orders: SupplierOrderRow[]; // más reciente primero
}

/** RF-22: historial agrupado por proveedor, proveedores con pedido más reciente primero. */
export function historyBySupplier(rows: SupplierOrderRow[]): SupplierHistory[] {
  const groups = new Map<string, SupplierOrderRow[]>();
  for (const r of rows) groups.set(r.supplier, [...(groups.get(r.supplier) ?? []), r]);
  return [...groups.entries()]
    .map(([supplier, list]) => {
      const orders = [...list].sort((a, b) => b.for_date.localeCompare(a.for_date));
      return {
        supplier,
        count: orders.length,
        total: orders.reduce((s, o) => s + Number(o.quantity), 0),
        unit: orders[0].unit,
        lastDate: orders[0].for_date,
        orders,
      };
    })
    .sort((a, b) => b.lastDate.localeCompare(a.lastDate));
}
