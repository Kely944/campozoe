import { describe, expect, it } from "vitest";
import type { Product } from "./favorita";
import { dryGrainKg, grainPlan, mushroomTrays } from "./produccion";

const p = (id: string, extra: Partial<Product> = {}): Product => ({
  id,
  name: id,
  barcode: null,
  product_code: null,
  units_per_java: 8,
  grams_per_unit: 300,
  dry_yield: 2,
  active: true,
  ...extra,
});

describe("grano a remojar (RF-28)", () => {
  it("800 × 300 g = 240 kg cocido → 120 kg seco con rendimiento 2", () => {
    // El requerimiento dice "24 kg": es un error de cuenta (800 × 300 g = 240 000 g). Ver BLOQUEOS.md.
    expect(dryGrainKg(800, 300, 2)).toEqual({ cookedKg: 240, dryKg: 120 });
    expect(dryGrainKg(800, 30, 2)).toEqual({ cookedKg: 24, dryKg: 12 });
  });

  it("plan por día de entrega desde la oferta; ignora productos sin datos de cocción", () => {
    const plan = grainPlan(
      [p("Garbanzo"), p("Mote", { dry_yield: 2.5 }), p("Champiñón", { grams_per_unit: null, dry_yield: null })],
      [
        { product_id: "Garbanzo", delivery_day: 5, javas: 100 },
        { product_id: "Mote", delivery_day: 5, javas: 10 },
        { product_id: "Champiñón", delivery_day: 5, javas: 20 },
        { product_id: "Garbanzo", delivery_day: 3, javas: 50 },
      ],
    );
    expect(plan[0]).toMatchObject({ label: "Miércoles", dryKg: 60, rows: [{ product: "Garbanzo", units: 400, cookedKg: 120, dryKg: 60 }] });
    expect(plan[1].rows.map((r) => [r.product, r.units, r.dryKg])).toEqual([
      ["Garbanzo", 800, 120],
      ["Mote", 80, 9.6],
    ]);
    expect(plan[1].dryKg).toBe(129.6);
  });
});

describe("rendimiento de champiñón (RF-30)", () => {
  it("un corcho de 14 kg: solo bandejas de 150 g", () => {
    const r = mushroomTrays(14);
    expect(r).toMatchObject({ g150: 93, leftoverG: 50, only: { g150: 93, g90: 155, kg1: 14 } });
  });

  it("reserva primero 1 kg y 90 g; el resto en 150 g; con merma", () => {
    expect(mushroomTrays(14, { kg1: 2, g90: 20 })).toMatchObject({ kg1: 2, g90: 20, g150: 68, leftoverG: 0 });
    expect(mushroomTrays(14, { merma: 10 })).toMatchObject({ usableKg: 12.6, g150: 84 });
  });

  it("avisa si no alcanza", () => {
    expect(mushroomTrays(14, { kg1: 15 })).toEqual({ error: "No alcanza: esas bandejas necesitan 15 kg y hay 14 kg." });
  });
});
