import { describe, expect, it } from "vitest";
import {
  capacityByDay,
  currentOfferWeek,
  deliveryObligation,
  invoiceObligation,
  isoWeek,
  offerCopyText,
  offerDeadline,
  parseOfferItems,
  parseProductForm,
  parsePurchaseOrderForm,
  weekStart,
  type Product,
} from "./favorita";
import { formatLocalInput, fromLocal } from "./time";

function form(entries: Record<string, string>) {
  const fd = new FormData();
  Object.entries(entries).forEach(([k, v]) => fd.append(k, v));
  return fd;
}

const garbanzo: Product = {
  id: "g",
  name: "Garbanzo cocido 300 g",
  barcode: "7861234500012",
  product_code: "GAR300",
  units_per_java: 8,
  grams_per_unit: 300,
  dry_yield: 2,
  active: true,
};

describe("semanas", () => {
  it("weekStart devuelve el lunes", () => {
    expect(weekStart("2026-10-31")).toBe("2026-10-26"); // sábado
    expect(weekStart("2026-10-26")).toBe("2026-10-26"); // lunes
    expect(weekStart("2026-11-01")).toBe("2026-10-26"); // domingo
  });

  it("isoWeek: 24-oct-2026 es la semana 43", () => {
    expect(isoWeek("2026-10-24")).toEqual({ year: 2026, week: 43 });
    expect(isoWeek("2027-01-01")).toEqual({ year: 2026, week: 53 });
  });

  it("la oferta que toca: la de esta semana hasta el miércoles 19:00, luego la siguiente", () => {
    expect(currentOfferWeek(fromLocal(2026, 10, 28, 18, 59))).toBe("2026-10-26");
    expect(currentOfferWeek(fromLocal(2026, 10, 28, 19, 1))).toBe("2026-11-02");
    expect(currentOfferWeek(fromLocal(2026, 10, 31, 9))).toBe("2026-11-02");
  });

  it("RF-08: la oferta cierra el miércoles a las 19:00", () => {
    expect(formatLocalInput(offerDeadline("2026-10-26"))).toBe("2026-10-28T19:00");
  });
});

describe("oferta de la semana", () => {
  it("RF-10/11: lee javas por producto y día; avisa si pasan de 100", () => {
    const res = parseOfferItems(form({ javas_g_3: "60", javas_g_5: "", javas_l_3: "45", javas_l_5: "0" }), ["g", "l"]);
    expect(res).toEqual({
      items: [
        { product_id: "g", delivery_day: 3, javas: 60 },
        { product_id: "l", delivery_day: 3, javas: 45 },
      ],
    });
    const cap = capacityByDay("items" in res ? res.items : [], 100);
    expect(cap).toEqual([
      { day: 3, label: "Miércoles", javas: 105, over: true, free: -5 },
      { day: 5, label: "Viernes", javas: 0, over: false, free: 100 },
    ]);
  });

  it("javas no enteras dan error", () => {
    expect(parseOfferItems(form({ javas_g_3: "1.5" }), ["g"])).toEqual({ error: "Las javas deben ser números enteros." });
  });

  it("RF-09/10: texto listo para copiar con los datos fijos", () => {
    const text = offerCopyText(garbanzo, { product_id: "g", delivery_day: 5, javas: 100 }, { supplier_code: "PRV-123", acopio: "CAF 400 (Loja)", van_capacity: 100 });
    expect(text).toBe(
      "Código de proveedor: PRV-123\nCentro de acopio: CAF 400 (Loja)\nCódigo de barras: 7861234500012\nProducto: Garbanzo cocido 300 g\nJavas: 100\nDía de entrega: Viernes",
    );
  });
});

describe("parseProductForm (RF-09)", () => {
  it("producto con datos de producción opcionales", () => {
    expect(parseProductForm(form({ name: "Mote", barcode: "786", units_per_java: "8", grams_per_unit: "300", dry_yield: "2,5", active: "on" }))).toEqual({
      data: { name: "Mote", barcode: "786", product_code: null, units_per_java: 8, grams_per_unit: 300, dry_yield: 2.5, active: true },
    });
    expect(parseProductForm(form({ name: "Mote", units_per_java: "" }))).toEqual({ error: "Escribe cuántas unidades van en una java." });
    expect(parseProductForm(form({ name: "Mote", units_per_java: "8", dry_yield: "0,5" }))).toMatchObject({ error: expect.stringContaining("rendimiento") });
  });
});

describe("órdenes de compra (RF-12, RF-13)", () => {
  it("lee semana, hora de entrega en hora de Ecuador y unidades", () => {
    const res = parsePurchaseOrderForm(form({ week: "43", delivery_local: "2026-10-28T11:30", units_g: "800", units_l: "", driver_id: "kelly" }), ["g", "l"]);
    expect(res).toEqual({
      data: { year: 2026, week: 43, delivery_at: "2026-10-28T16:30:00.000Z", driver_id: "kelly", notes: null, items: [{ product_id: "g", units: 800 }] },
    });
    expect(parsePurchaseOrderForm(form({ week: "43", delivery_local: "2026-10-28T11:30" }), ["g"])).toEqual({
      error: "Escribe las unidades de al menos un producto.",
    });
  });

  it("aviso previo a la entrega para quien maneja", () => {
    const ob = deliveryObligation({ week: 43, delivery_at: "2026-10-28T16:30:00.000Z", driver_id: "kelly" });
    expect(ob).toMatchObject({ frequency: "once", due_at: "2026-10-28T16:30:00.000Z", responsible_id: "kelly", reminder_offsets_min: [1440, 120, 60] });
  });

  it("factura pendiente vence a las 18:00 del día de entrega", () => {
    const ob = invoiceObligation({ week: 43 }, fromLocal(2026, 10, 28, 11, 45), "majo");
    expect(formatLocalInput(new Date(ob.due_at!))).toBe("2026-10-28T18:00");
    expect(ob.title).toBe("Facturar orden semana 43 de Favorita");
  });

  it("si se entregó tarde, vence 2 h después", () => {
    const ob = invoiceObligation({ week: 43 }, fromLocal(2026, 10, 28, 17), "majo");
    expect(formatLocalInput(new Date(ob.due_at!))).toBe("2026-10-28T19:00");
  });
});
