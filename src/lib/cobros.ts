import type { ObligationInput } from "./obligation-form";
import { addDays, fromLocal, weekdayOf } from "./time";

type FormLike = { get(name: string): FormDataEntryValue | null };
const str = (f: FormLike, name: string) => String(f.get(name) ?? "").trim();
const money = (raw: string) => Number(raw.replace(/\s|\$/g, "").replace(",", "."));
const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);
const round2 = (n: number) => Math.round(n * 100) / 100;

export interface CreditSaleInput {
  customer: string;
  amount: number;
  sold_on: string;
  notes: string | null;
}

/** RF-23: venta a crédito sin datos tributarios. */
export function parseCreditSaleForm(f: FormLike, today: string): { data: CreditSaleInput } | { error: string } {
  const customer = str(f, "customer").replace(/\s+/g, " ");
  if (!customer) return { error: "Escribe el nombre o puesto del cliente." };
  const amount = money(str(f, "amount"));
  if (!Number.isFinite(amount) || amount <= 0) return { error: "Escribe el monto fiado." };
  const sold_on = str(f, "sold_on") || today;
  if (!isDate(sold_on)) return { error: "Elige la fecha de la venta." };
  if (sold_on > today) return { error: "La fecha de la venta no puede ser futura." };
  return { data: { customer, amount: round2(amount), sold_on, notes: str(f, "notes") || null } };
}

export interface CreditSale {
  id: string;
  customer: string;
  amount: number;
  sold_on: string;
  paid_on: string | null;
}

export interface CustomerBalance {
  customer: string;
  total: number;
  count: number;
  oldest: string;
}

/** RF-25: saldo pendiente por cliente, de mayor a menor. "Doña Rosa" y "doña  rosa " son el mismo cliente. */
export function balancesByCustomer(sales: CreditSale[]): CustomerBalance[] {
  const map = new Map<string, CustomerBalance>();
  for (const s of sales) {
    if (s.paid_on) continue;
    const key = s.customer.trim().replace(/\s+/g, " ").toLocaleLowerCase("es");
    const b = map.get(key) ?? { customer: s.customer.trim(), total: 0, count: 0, oldest: s.sold_on };
    b.total = round2(b.total + Number(s.amount));
    b.count++;
    if (s.sold_on < b.oldest) b.oldest = s.sold_on;
    map.set(key, b);
  }
  return [...map.values()].sort((a, b) => b.total - a.total || a.oldest.localeCompare(b.oldest));
}

/** Días desde la venta (para resaltar los cobros que pasan del plazo). */
export function daysSince(dateStr: string, today: string): number {
  return Math.round((Date.parse(today) - Date.parse(dateStr)) / 86400000);
}

/** Suma días laborables (lunes a viernes). Sin feriados: así el plazo nunca queda más tarde que el real. */
export function addBusinessDays(dateStr: string, n: number): string {
  let d = dateStr;
  let left = n;
  while (left > 0) {
    d = addDays(d, 1);
    const wd = weekdayOf(d);
    if (wd !== 0 && wd !== 6) left--;
  }
  return d;
}

export const CREDIT_NOTE_BUSINESS_DAYS = 8;

/** RF-26: último día para hacer la nota de crédito (8 días laborables desde la factura). */
export function creditNoteDeadline(issuedOn: string): string {
  return addBusinessDays(issuedOn, CREDIT_NOTE_BUSINESS_DAYS);
}

export interface CreditNoteInput {
  invoice_number: string;
  customer: string | null;
  issued_on: string;
  reason: string | null;
}

export function parseCreditNoteForm(f: FormLike, today: string): { data: CreditNoteInput } | { error: string } {
  const invoice_number = str(f, "invoice_number");
  if (!invoice_number) return { error: "Escribe el número de la factura." };
  const issued_on = str(f, "issued_on");
  if (!isDate(issued_on)) return { error: "Elige la fecha de la factura." };
  if (issued_on > today) return { error: "La fecha de la factura no puede ser futura." };
  return { data: { invoice_number, customer: str(f, "customer") || null, issued_on, reason: str(f, "reason") || null } };
}

/** Tarea con aviso 2 días, 1 día y 4 h antes del último día (a las 17:00). */
export function creditNoteObligation(n: CreditNoteInput, responsibleId: string | null, now: Date): ObligationInput {
  const [y, m, d] = creditNoteDeadline(n.issued_on).split("-").map(Number);
  const deadline = fromLocal(y, m, d, 17);
  return {
    title: `Nota de crédito de la factura ${n.invoice_number}${n.customer ? ` (${n.customer})` : ""}`,
    description: "Después del plazo ya no se puede anular la factura.",
    frequency: "once",
    due_at: (deadline > now ? deadline : new Date(now.getTime() + 10 * 60_000)).toISOString(),
    time_of_day: null,
    weekdays: null,
    day_of_month: null,
    extra_day_of_month: null,
    reminder_offsets_min: [2880, 1440, 240],
    repeat_every_min: 120,
    escalate_before_min: null,
    responsible_id: responsibleId,
    backup_id: null,
    priority: "alta",
    active: true,
  };
}

export interface InvoiceToReconcile {
  id: string;
  label: string;
  amount: number;
  date: string;
}

/** RF-27: diferencia entre el pago recibido y las facturas elegidas. */
export function reconcile(paymentAmount: number, selected: InvoiceToReconcile[]) {
  const sum = round2(selected.reduce((s, i) => s + Number(i.amount), 0));
  return { sum, diff: round2(paymentAmount - sum), exact: Math.abs(paymentAmount - sum) < 0.005 };
}

/**
 * Sugerencia: Favorita paga las facturas más antiguas primero. Devuelve las más antiguas
 * cuya suma da exactamente el pago, o null si ningún grupo desde la más antigua cuadra.
 */
export function suggestInvoices(paymentAmount: number, invoices: InvoiceToReconcile[]): string[] | null {
  const target = Math.round(paymentAmount * 100);
  let acc = 0;
  const ids: string[] = [];
  for (const i of [...invoices].sort((a, b) => a.date.localeCompare(b.date))) {
    acc += Math.round(Number(i.amount) * 100);
    ids.push(i.id);
    if (acc === target) return ids;
    if (acc > target) return null;
  }
  return null;
}
