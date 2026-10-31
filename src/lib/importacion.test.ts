import { readFileSync } from "node:fs";
import { join } from "node:path";
import { deflateRawSync } from "node:zlib";
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

/** Zip mínimo (sin CRC: el lector no lo usa) para probar archivos hostiles. */
function makeZip(files: Record<string, string | Uint8Array>): Uint8Array {

  const parts: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const [name, content] of Object.entries(files)) {
    const data = deflateRawSync(typeof content === "string" ? Buffer.from(content) : content);
    const n = Buffer.from(name);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(8, 8);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt16LE(n.length, 26);
    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(0x02014b50, 0);
    cd.writeUInt16LE(8, 10);
    cd.writeUInt32LE(data.length, 20);
    cd.writeUInt16LE(n.length, 28);
    cd.writeUInt32LE(offset, 42);
    parts.push(local, n, data);
    central.push(cd, n);
    offset += 30 + n.length + data.length;
  }
  const cdBuf = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(Object.keys(files).length, 10);
  end.writeUInt32LE(cdBuf.length, 12);
  end.writeUInt32LE(offset, 16);
  return new Uint8Array(Buffer.concat([...parts, cdBuf, end]));
}

describe("archivos hostiles (seguridad)", () => {
  const sheet = (cells: string) => `<worksheet><sheetData><row r="1">${cells}</row></sheetData></worksheet>`;

  it("ignora celdas con columnas imposibles en vez de agotar la memoria", () => {
    const zip = makeZip({
      "xl/worksheets/sheet1.xml": sheet('<c r="A1" t="inlineStr"><is><t>ok</t></is></c><c r="ZZZZZZZZZ1" t="inlineStr"><is><t>x</t></is></c>'),
    });
    expect(readTable(zip, "a.xlsx")).toEqual([["ok"]]);
  });

  it("rechaza una parte que se descomprime a más de 50 MB (zip bomb)", () => {
    const zip = makeZip({ "xl/worksheets/sheet1.xml": new Uint8Array(60 * 1024 * 1024) });
    expect(() => readTable(zip, "a.xlsx")).toThrow(/demasiado grande/);
  });

  it("un id de relación con caracteres de regex no rompe la lectura", () => {
    const zip = makeZip({
      "xl/workbook.xml": '<workbook><sheets><sheet name="H" r:id="(a+)+$"/></sheets></workbook>',
      "xl/_rels/workbook.xml.rels": '<Relationships><Relationship Id="(a+)+$" Target="worksheets/hoja.xml"/></Relationships>',
      "xl/worksheets/hoja.xml": sheet('<c r="B1" t="inlineStr"><is><t>dato</t></is></c>'),
    });
    expect(readTable(zip, "a.xlsx")).toEqual([["", "dato"]]);
  });
});
