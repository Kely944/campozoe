import { describe, expect, it } from "vitest";
import { coversWeekend, historyBySupplier, parseSupplierOrderForm } from "./pedidos";

function form(entries: Record<string, string>) {
  const fd = new FormData();
  Object.entries(entries).forEach(([k, v]) => fd.append(k, v));
  return fd;
}

describe("coversWeekend (RF-20)", () => {
  it("destaca entregas de sábado, domingo y lunes", () => {
    expect(coversWeekend("2026-10-31")).toBe(true); // sábado
    expect(coversWeekend("2026-11-01")).toBe(true); // domingo
    expect(coversWeekend("2026-11-02")).toBe(true); // lunes
    expect(coversWeekend("2026-11-03")).toBe(false); // martes
    expect(coversWeekend("2026-11-06")).toBe(false); // viernes
  });
});

describe("parseSupplierOrderForm (RF-19, RF-21)", () => {
  it("champiñón usa corchos de 14 kg", () => {
    const res = parseSupplierOrderForm(form({ supplier: "Champiñón", quantity: "6", for_date: "2026-11-03", unit: "kilos" }));
    expect(res).toEqual({
      data: { supplier: "Champiñón", quantity: 6, for_date: "2026-11-03", unit: "corchos de 14 kg", notes: null, occurrence_id: null },
    });
  });

  it("otro proveedor con su unidad y la tarea que cumple", () => {
    const res = parseSupplierOrderForm(
      form({ supplier: "Otro", supplier_other: "Cartones", quantity: "2,5", unit: "cajas", for_date: "2026-11-03", occurrence_id: "occ-1" }),
    );
    expect(res).toMatchObject({ data: { supplier: "Cartones", quantity: 2.5, unit: "cajas", occurrence_id: "occ-1" } });
  });

  it("errores claros", () => {
    expect(parseSupplierOrderForm(form({ supplier: "Otro", quantity: "1", for_date: "2026-11-03" }))).toEqual({ error: "Elige el proveedor." });
    expect(parseSupplierOrderForm(form({ supplier: "Champiñón", quantity: "0", for_date: "2026-11-03" }))).toEqual({
      error: "Escribe la cantidad pedida.",
    });
    expect(parseSupplierOrderForm(form({ supplier: "Champiñón", quantity: "4", for_date: "" }))).toEqual({
      error: "Elige para qué día es el pedido.",
    });
  });
});

describe("historyBySupplier (RF-22)", () => {
  it("agrupa, suma y ordena por el pedido más reciente", () => {
    const res = historyBySupplier([
      { id: "1", supplier: "Champiñón", for_date: "2026-10-27", quantity: 4, unit: "corchos de 14 kg" },
      { id: "2", supplier: "Etiquetas", for_date: "2026-10-15", quantity: 1, unit: "pedidos" },
      { id: "3", supplier: "Champiñón", for_date: "2026-10-28", quantity: 6, unit: "corchos de 14 kg" },
    ]);
    expect(res.map((h) => [h.supplier, h.count, h.total, h.lastDate])).toEqual([
      ["Champiñón", 2, 10, "2026-10-28"],
      ["Etiquetas", 1, 1, "2026-10-15"],
    ]);
    expect(res[0].orders.map((o) => o.id)).toEqual(["3", "1"]);
  });
});
