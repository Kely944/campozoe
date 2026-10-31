import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseCsv, readTable } from "./hoja";
import { mapProducts, mapReceivables, mapSales, parseDate, parseNumber } from "./importacion";

describe("lectura de archivos (RF-32)", () => {
  it("lee la primera hoja de un .xlsx real (fechas como número de serie, texto compartido y escapes)", () => {
    const rows = readTable(new Uint8Array(readFileSync(join(__dirname, "fixtures", "ventas.xlsx"))), "ventas.xlsx");
    expect(rows[0][0]).toBe("Reporte de ventas");
    expect(rows[1]).toEqual(["Fecha", "Cliente", "Descripción", "Cantidad", "Total", "Factura"]);
    expect(rows[3][1]).toBe("Mercado & Cía <Loja>");
    expect(parseDate(rows[2][0])).toBe("2026-10-20");
  });

  it("CSV con punto y coma y comillas", () => {
    expect(parseCsv('﻿Fecha;Cliente;Total\r\n24/10/2026;"Rosa; puesto 3";"1.234,50"\r\n')).toEqual([
      ["Fecha", "Cliente", "Total"],
      ["24/10/2026", "Rosa; puesto 3", "1.234,50"],
    ]);
  });

  it("rechaza formatos que no son xlsx/csv", () => {
    expect(() => readTable(new Uint8Array(), "ventas.xls")).toThrow(/xlsx o .csv/);
  });
});

describe("números y fechas", () => {
  it("parseNumber entiende formato ecuatoriano y estadounidense", () => {
    expect(parseNumber("1.234,56")).toBe(1234.56);
    expect(parseNumber("1,234.56")).toBe(1234.56);
    expect(parseNumber("$ 12,50")).toBe(12.5);
    expect(parseNumber("156.5")).toBe(156.5);
    expect(parseNumber("")).toBeNull();
  });

  it("parseDate", () => {
    expect(parseDate("24/10/2026")).toBe("2026-10-24");
    expect(parseDate("2019-03-05 00:00:00")).toBe("2019-03-05");
    expect(parseDate("5-3-19")).toBe("2019-03-05");
    expect(parseDate("46315")).toBe("2026-10-20");
    expect(parseDate("Total")).toBeNull();
  });
});

describe("mapeo de columnas", () => {
  it("ventas: encuentra el encabezado aunque no esté en la primera fila y salta totales", () => {
    const rows = readTable(new Uint8Array(readFileSync(join(__dirname, "fixtures", "ventas.xlsx"))), "ventas.xlsx");
    const res = mapSales(rows);
    expect(res).toMatchObject({
      skipped: 0,
      records: [
        { sold_on: "2026-10-20", customer: "CORPORACION FAVORITA C.A.", product: "CHAMPIÑON BANDEJA 150 G", units: 120, amount: 156.5, document: "001-001-000100" },
        { sold_on: "2026-10-21", customer: "Mercado & Cía <Loja>", product: "Champiñón 1 kg", units: 3, amount: 18 },
      ],
    });
  });

  it("ventas del historial sin cantidad (una por fila) y líneas iguales no se pierden", () => {
    const res = mapSales([
      ["FECHA", "NOMBRE", "DETALLE", "VALOR", "RECIBO"],
      ["05/03/2019", "Doña Rosa", "Champiñón 150 g", "2,50", "R-1"],
      ["05/03/2019", "Doña Rosa", "Champiñón 150 g", "2,50", "R-1"],
      ["", "", "", "", ""],
    ]);
    expect("records" in res && res.records.map((r) => [r.units, r.import_key.endsWith("|2")])).toEqual([
      [1, false],
      [1, true],
    ]);
    expect(res).toMatchObject({ skipped: 1 });
  });

  it("columnas que faltan dan un error claro", () => {
    expect(mapSales([["Cliente", "Total"]])).toEqual({ error: expect.stringContaining("fecha, cliente, producto, total") });
  });

  it("productos y cuentas por cobrar", () => {
    expect(mapProducts([["Código", "Descripción", "PVP"], ["CH150", "Champiñón 150 g", "1,30"]])).toEqual({
      records: [{ code: "CH150", name: "Champiñón 150 g", price: 1.3 }],
      skipped: 0,
    });
    expect(
      mapReceivables([
        ["Cliente", "Factura", "Fecha emisión", "Vencimiento", "Saldo"],
        ["Corporación Favorita", "001-001-000100", "20/10/2026", "19/11/2026", "1.200,00"],
        ["Pagado", "001-001-000090", "01/10/2026", "31/10/2026", "0"],
      ]),
    ).toEqual({
      records: [{ customer: "Corporación Favorita", document: "001-001-000100", issued_on: "2026-10-20", due_on: "2026-11-19", balance: 1200 }],
      skipped: 1,
    });
  });
});
