import { describe, expect, it } from "vitest";
import { matchesProduct, salesReport, suggestCorchos, trayKg, type SaleRow } from "./reportes";

const row = (sold_on: string, customer: string, product: string, units: number, amount: number): SaleRow => ({ sold_on, customer, product, units, amount });

describe("reporte de ventas de champiñón (RF-31)", () => {
  const rows = [
    row("2026-01-10", "Corporación Favorita", "CHAMPIÑÓN BANDEJA 150 G", 100, 130),
    row("2026-02-03", "corporacion favorita", "Champiñon 90 g", 50, 45),
    row("2026-02-05", "Doña Rosa", "Champiñón 1 kg", 2, 12),
    row("2026-02-06", "Doña Rosa", "Garbanzo cocido", 10, 15),
  ];

  it("filtra sin tildes ni mayúsculas", () => {
    expect(matchesProduct("CHAMPIÑÓN BANDEJA", "champi")).toBe(true);
    expect(matchesProduct("Garbanzo", "champi")).toBe(false);
    expect(matchesProduct("Garbanzo", "")).toBe(true);
  });

  it("agrupa por cliente (une mayúsculas y tildes) y por mes", () => {
    const r = salesReport(rows, "champi");
    expect(r.customers).toEqual([
      { customer: "Corporación Favorita", units: 150, amount: 175 },
      { customer: "Doña Rosa", units: 2, amount: 12 },
    ]);
    expect(r.months).toEqual([
      { month: "2026-01", units: 100, amount: 130 },
      { month: "2026-02", units: 52, amount: 57 },
    ]);
    expect([r.units, r.amount]).toEqual([152, 187]);
  });
});

describe("sugerencia de pedido (RF-33)", () => {
  it("lee el peso de la bandeja del nombre", () => {
    expect(trayKg("CHAMPIÑON BANDEJA 150 G")).toBe(0.15);
    expect(trayKg("Champiñón 90g")).toBe(0.09);
    expect(trayKg("Champiñón 1 KG")).toBe(1);
    expect(trayKg("Champiñón kilo")).toBe(1);
    expect(trayKg("Champiñón granel")).toBeNull();
  });

  it("promedia los mismos días de la semana y redondea hacia arriba en corchos", () => {
    // martes 3-nov-2026; martes anteriores: 27-oct, 20-oct
    const rows = [
      row("2026-10-27", "A", "Champiñón 150 g", 200, 0), // 30 kg
      row("2026-10-20", "A", "Champiñón 150 g", 100, 0), // 15 kg
      row("2026-10-20", "A", "Champiñón 1 kg", 3, 0), // 3 kg
      row("2026-10-21", "A", "Champiñón 1 kg", 99, 0), // miércoles: no cuenta
      row("2026-11-03", "A", "Champiñón 1 kg", 99, 0), // el mismo día: no cuenta
    ];
    // 48 kg en 2 semanas = 24 kg por martes → 2 corchos
    expect(suggestCorchos(rows, "2026-11-03", 2)).toEqual({ avgKg: 24, corchos: 2, weeks: 2 });
  });

  it("la entrega del sábado cubre sábado y domingo; sin historial no sugiere", () => {
    const rows = [row("2026-10-24", "A", "Champiñón 1 kg", 10, 0), row("2026-10-25", "A", "Champiñón 1 kg", 10, 0)];
    expect(suggestCorchos(rows, "2026-10-31", 1)).toEqual({ avgKg: 20, corchos: 2, weeks: 1 });
    expect(suggestCorchos([], "2026-10-31")).toBeNull();
  });
});
