/**
 * RF-32: convierte las filas de un Excel del facturador (o del historial 2019–2023) en registros.
 * Las columnas se reconocen por el nombre del encabezado; el formato exacto del facturador
 * es pregunta abierta, por eso se aceptan varios nombres para cada columna.
 */

export const IMPORT_KINDS = {
  ventas: "Ventas (facturador o historial)",
  productos: "Productos",
  cxc: "Cuentas por cobrar",
} as const;
export type ImportKind = keyof typeof IMPORT_KINDS;

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const ALIASES = {
  fecha: ["fecha", "fecha emision", "fecha de emision", "f emision", "emision", "fecha factura"],
  vence: ["vence", "vencimiento", "fecha vencimiento", "fecha de vencimiento", "f vencimiento"],
  cliente: ["cliente", "razon social", "nombre cliente", "nombre", "comprador", "cliente proveedor"],
  producto: ["producto", "descripcion", "item", "detalle", "articulo", "nombre producto"],
  codigo: ["codigo", "cod", "codigo producto", "codigo principal", "cod producto"],
  cantidad: ["cantidad", "cant", "unidades", "cantidad vendida"],
  total: ["total", "valor", "monto", "importe", "precio total", "subtotal", "valor total"],
  saldo: ["saldo", "saldo pendiente", "por cobrar", "pendiente", "valor pendiente"],
  precio: ["precio", "pvp", "precio unitario", "p unitario", "precio venta"],
  documento: ["factura", "numero", "documento", "comprobante", "recibo", "n factura", "no factura", "numero factura", "secuencial", "n"],
};
type Field = keyof typeof ALIASES;

const REQUIRED: Record<ImportKind, Field[]> = {
  ventas: ["fecha", "cliente", "producto", "total"],
  productos: ["producto"],
  cxc: ["cliente", "saldo"],
};

/** Busca la fila de encabezados (en las primeras 15) y la columna de cada campo. */
export function findColumns(rows: string[][], kind: ImportKind): { header: number; cols: Partial<Record<Field, number>> } | null {
  for (let h = 0; h < Math.min(rows.length, 15); h++) {
    const cells = rows[h].map(norm);
    const cols: Partial<Record<Field, number>> = {};
    for (const field of Object.keys(ALIASES) as Field[]) {
      // Coincidencia exacta primero; luego "empieza con" (ej. "fecha emision 2026").
      let idx = cells.findIndex((c) => ALIASES[field].includes(c));
      if (idx < 0) idx = cells.findIndex((c) => c && ALIASES[field].some((a) => a.length > 3 && c.startsWith(a)));
      if (idx >= 0 && !Object.values(cols).includes(idx)) cols[field] = idx;
    }
    if (REQUIRED[kind].every((f) => cols[f] !== undefined)) return { header: h, cols };
  }
  return null;
}

/** "1.234,56", "1,234.56", "$ 12,50", "156.5" → número. */
export function parseNumber(raw: string): number | null {
  let s = raw.replace(/[^\d,.-]/g, "");
  if (!s || !/\d/.test(s)) return null;
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  if (lastComma > lastDot) s = s.replace(/\./g, "").replace(",", ".");
  else s = s.replace(/,/g, "");
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** "24/10/2026", "2026-10-24", "24-10-26" o número de serie de Excel → "2026-10-24". */
export function parseDate(raw: string): string | null {
  const s = raw.trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return ymd(+m[1], +m[2], +m[3]);
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/);
  if (m) return ymd(m[3].length === 2 ? 2000 + +m[3] : +m[3], +m[2], +m[1]);
  if (/^\d{5}(\.\d+)?$/.test(s)) {
    const d = new Date(Date.UTC(1899, 11, 30) + Math.floor(Number(s)) * 86400000);
    return ymd(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
  }
  return null;
}

function ymd(y: number, m: number, d: number): string | null {
  if (y < 2000 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export interface SaleRecord {
  sold_on: string;
  customer: string;
  product: string;
  units: number;
  amount: number;
  document: string | null;
  import_key: string; // evita duplicados al importar dos veces el mismo archivo
}
export interface ProductRecord {
  code: string | null;
  name: string;
  price: number | null;
}
export interface ReceivableRecord {
  customer: string;
  document: string | null;
  issued_on: string | null;
  due_on: string | null;
  balance: number;
}

export type ImportResult<T> = { records: T[]; skipped: number } | { error: string };

const cell = (row: string[], i: number | undefined) => (i === undefined ? "" : String(row[i] ?? "").trim());
const isTotalRow = (row: string[]) => row.some((c) => /^(total|totales|subtotal)\b/i.test(String(c).trim()));

function missing(kind: ImportKind) {
  return {
    error: `No se encontraron las columnas necesarias (${REQUIRED[kind].join(", ")}). Revisa que la primera fila del reporte tenga los títulos.`,
  };
}

export function mapSales(rows: string[][]): ImportResult<SaleRecord> {
  const found = findColumns(rows, "ventas");
  if (!found) return missing("ventas");
  const { header, cols } = found;
  const records: SaleRecord[] = [];
  let skipped = 0;
  const seen = new Map<string, number>();
  for (const row of rows.slice(header + 1)) {
    if (isTotalRow(row)) continue;
    const sold_on = parseDate(cell(row, cols.fecha));
    const customer = cell(row, cols.cliente).replace(/\s+/g, " ");
    const product = cell(row, cols.producto).replace(/\s+/g, " ");
    const amount = parseNumber(cell(row, cols.total));
    const units = cols.cantidad === undefined ? 1 : parseNumber(cell(row, cols.cantidad));
    if (!sold_on || !customer || !product || amount === null || units === null) {
      skipped++;
      continue;
    }
    const document = cell(row, cols.documento) || null;
    const base = [sold_on, norm(customer), norm(product), document ?? "", units, amount].join("|");
    // Dos líneas idénticas en el mismo archivo son ventas distintas: se numeran.
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    records.push({ sold_on, customer, product, units, amount, document, import_key: `${base}|${n}` });
  }
  return { records, skipped };
}

export function mapProducts(rows: string[][]): ImportResult<ProductRecord> {
  const found = findColumns(rows, "productos");
  if (!found) return missing("productos");
  const { header, cols } = found;
  const records: ProductRecord[] = [];
  let skipped = 0;
  for (const row of rows.slice(header + 1)) {
    const name = cell(row, cols.producto).replace(/\s+/g, " ");
    if (!name || isTotalRow(row)) {
      skipped += name ? 0 : 1;
      continue;
    }
    records.push({ code: cell(row, cols.codigo) || null, name, price: parseNumber(cell(row, cols.precio)) });
  }
  return { records, skipped };
}

export function mapReceivables(rows: string[][]): ImportResult<ReceivableRecord> {
  const found = findColumns(rows, "cxc");
  if (!found) return missing("cxc");
  const { header, cols } = found;
  const records: ReceivableRecord[] = [];
  let skipped = 0;
  for (const row of rows.slice(header + 1)) {
    if (isTotalRow(row)) continue;
    const customer = cell(row, cols.cliente).replace(/\s+/g, " ");
    const balance = parseNumber(cell(row, cols.saldo));
    if (!customer || balance === null || balance <= 0) {
      skipped++;
      continue;
    }
    records.push({
      customer,
      document: cell(row, cols.documento) || null,
      issued_on: parseDate(cell(row, cols.fecha)),
      due_on: parseDate(cell(row, cols.vence)),
      balance,
    });
  }
  return { records, skipped };
}
