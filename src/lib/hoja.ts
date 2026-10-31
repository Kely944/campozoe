import { inflateRawSync } from "node:zlib";

/**
 * Lectura mínima de hojas de cálculo para importar los reportes del facturador (RF-32).
 * Soporta .xlsx (primera hoja) y .csv (separador ; o ,). Devuelve filas de texto.
 * ponytail: sin fórmulas, estilos ni varias hojas; si el facturador exporta .xls antiguo,
 * hay que guardarlo como .xlsx o .csv desde Excel.
 */
export function readTable(bytes: Uint8Array, filename: string): string[][] {
  if (/\.csv$|\.txt$/i.test(filename)) return parseCsv(new TextDecoder("utf-8").decode(bytes));
  if (/\.xlsx$/i.test(filename)) return readXlsx(bytes);
  throw new Error("Formato no soportado: usa un archivo .xlsx o .csv (en Excel: Guardar como).");
}

export function parseCsv(text: string): string[][] {
  const clean = text.replace(/^﻿/, "");
  const firstLine = clean.split(/\r?\n/, 1)[0] ?? "";
  const sep = (firstLine.match(/;/g)?.length ?? 0) >= (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (quoted) {
      if (ch === '"' && clean[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === sep) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && clean[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell || row.length) rows.push([...row, cell]);
  return rows.filter((r) => r.some((c) => c.trim()));
}

const MAX_XML_BYTES = 50 * 1024 * 1024; // límite al descomprimir una parte (evita "zip bombs")
const MAX_COLUMN = 16383; // última columna de Excel (XFD)

/** Entradas del zip (central directory). Se descomprime solo lo que se pide, con límite de tamaño. */
function unzip(bytes: Uint8Array): (name: string) => Uint8Array | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("El archivo no es un Excel .xlsx válido.");
  const count = view.getUint16(eocd + 10, true);
  let p = view.getUint32(eocd + 16, true);
  const entries = new Map<string, { method: number; raw: Uint8Array }>();
  const dec = new TextDecoder();
  for (let n = 0; n < count; n++) {
    if (view.getUint32(p, true) !== 0x02014b50) throw new Error("El archivo .xlsx está dañado.");
    const method = view.getUint16(p + 10, true);
    const compSize = view.getUint32(p + 20, true);
    const nameLen = view.getUint16(p + 28, true);
    const extraLen = view.getUint16(p + 30, true);
    const commentLen = view.getUint16(p + 32, true);
    const local = view.getUint32(p + 42, true);
    const name = dec.decode(bytes.subarray(p + 46, p + 46 + nameLen));
    if (local + 30 > bytes.length) throw new Error("El archivo .xlsx está dañado.");
    const dataStart = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
    if (dataStart + compSize > bytes.length) throw new Error("El archivo .xlsx está dañado.");
    entries.set(name, { method, raw: bytes.subarray(dataStart, dataStart + compSize) });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return (name) => {
    const e = entries.get(name);
    if (!e) return null;
    if (e.method === 0) return e.raw;
    try {
      return new Uint8Array(inflateRawSync(e.raw, { maxOutputLength: MAX_XML_BYTES }));
    } catch {
      throw new Error("El Excel es demasiado grande o está dañado. Divídelo o guárdalo como .csv.");
    }
  };
}

const unescape = (s: string) =>
  s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&amp;/g, "&");

const texts = (xml: string) => [...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((m) => unescape(m[1])).join("");

function colIndex(ref: string): number {
  const letters = ref.match(/^[A-Z]+/)?.[0] ?? "A";
  return [...letters].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;
}

export function readXlsx(bytes: Uint8Array): string[][] {
  const extract = unzip(bytes);
  const dec = new TextDecoder();
  const get = (name: string) => {
    const f = extract(name);
    return f ? dec.decode(f) : null;
  };

  // Primera hoja según workbook.xml y sus relaciones.
  const workbook = get("xl/workbook.xml") ?? "";
  const rid = workbook.match(/<sheet\b[^>]*\br:id="([^"]+)"/)?.[1];
  const rels = get("xl/_rels/workbook.xml.rels") ?? "";
  // Sin construir expresiones regulares con datos del archivo.
  const rel = [...rels.matchAll(/<Relationship\b[^>]*>/g)].map((m) => m[0]).find((tag) => tag.match(/\bId="([^"]+)"/)?.[1] === rid);
  const target = rel?.match(/\bTarget="([^"]+)"/)?.[1] ?? null;
  const sheetPath = target ? (target.startsWith("/") ? target.slice(1) : `xl/${target}`) : "xl/worksheets/sheet1.xml";
  const sheet = get(sheetPath) ?? get("xl/worksheets/sheet1.xml");
  if (!sheet) throw new Error("No se encontró la hoja en el Excel.");

  const shared = [...(get("xl/sharedStrings.xml") ?? "").matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => texts(m[1]));

  const rows: string[][] = [];
  for (const r of sheet.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    const row: string[] = [];
    for (const c of r[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = c[1];
      const body = c[2] ?? "";
      const ref = attrs.match(/\br="([A-Z]+\d+)"/)?.[1];
      const type = attrs.match(/\bt="([^"]+)"/)?.[1];
      const v = body.match(/<v>([\s\S]*?)<\/v>/)?.[1];
      let value = "";
      if (type === "s") value = shared[Number(v)] ?? "";
      else if (type === "inlineStr") value = texts(body);
      else if (v !== undefined) value = unescape(v);
      const idx = ref ? colIndex(ref) : row.length;
      if (idx > MAX_COLUMN) continue;
      while (row.length < idx) row.push("");
      row[idx] = value;
    }
    if (row.some((x) => x.trim())) rows.push(row);
  }
  return rows;
}
