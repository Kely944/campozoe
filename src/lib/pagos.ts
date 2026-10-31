import type { ObligationInput } from "./obligation-form";
import { addDays, daysInMonth, weekdayOf } from "./time";

export const PAYMENT_KINDS = {
  prestamo: "Cuota de préstamo",
  proveedor: "Pago a proveedor",
  trabajador: "Pago a trabajador",
  otro: "Otro pago",
} as const;
export type PaymentKind = keyof typeof PAYMENT_KINDS;

export const BANKS = ["Banco Pichincha", "Produbanco", "Banco de Loja"];

export interface PaymentInput {
  kind: PaymentKind;
  name: string;
  bank: string | null;
  amount: number;
  day_of_month: number;
  debit_account: string | null;
  notice_days: number;
  active: boolean;
  notes: string | null;
}

export interface Payment extends PaymentInput {
  id: string;
  obligation_id: string | null;
}

type FormLike = { get(name: string): FormDataEntryValue | null };
const str = (f: FormLike, name: string) => String(f.get(name) ?? "").trim();
const money = (raw: string) => Number(raw.replace(/\s|\$/g, "").replace(",", "."));

/** RF-15: préstamo o pago recurrente mensual. */
export function parsePaymentForm(f: FormLike): { data: PaymentInput } | { error: string } {
  const kind = str(f, "kind") as PaymentKind;
  if (!(kind in PAYMENT_KINDS)) return { error: "Elige el tipo de pago." };
  const name = str(f, "name");
  if (!name) return { error: "Escribe a quién o qué se paga." };
  const amount = money(str(f, "amount"));
  if (!Number.isFinite(amount) || amount <= 0) return { error: "Escribe el monto de la cuota." };
  const day = Number(str(f, "day_of_month"));
  if (!Number.isInteger(day) || day < 1 || day > 31) return { error: "Elige el día de pago (1 a 31)." };
  const notice = Number(str(f, "notice_days") || "3");
  if (!Number.isInteger(notice) || notice < 0 || notice > 15) return { error: "Los días de anticipación van de 0 a 15." };
  return {
    data: {
      kind,
      name,
      bank: str(f, "bank") || null,
      amount: Math.round(amount * 100) / 100,
      day_of_month: day,
      debit_account: str(f, "debit_account").replace(/\s/g, "") || null,
      notice_days: notice,
      active: f.get("active") === "on",
      notes: str(f, "notes") || null,
    },
  };
}

/** "2200123456" -> "…3456": la tarea la ve todo el equipo, la cuenta completa solo la administradora. */
export function maskAccount(account: string | null): string | null {
  return account ? `…${account.slice(-4)}` : null;
}

/**
 * RF-16: la tarea con aviso para transferir a la cuenta de débito correcta.
 * Sin monto (RNF-04: solo Majo ve montos) y con la cuenta enmascarada.
 */
export function paymentObligation(p: PaymentInput, responsibleId: string | null): ObligationInput {
  const where = [p.bank, maskAccount(p.debit_account) && `cta. ${maskAccount(p.debit_account)}`].filter(Boolean).join(" ");
  const offsets = [...new Set([p.notice_days * 1440, 1440, 120].filter((m) => m > 0))].sort((a, b) => b - a);
  return {
    title: p.kind === "prestamo" ? `Transferir para cuota: ${p.name}${where ? ` (${where})` : ""}` : `Pagar: ${p.name}${where ? ` (${where})` : ""}`,
    description: where ? `Pasar el dinero a ${where} antes del cobro. Monto en Pagos.` : "Monto y detalle en Pagos.",
    frequency: "monthly",
    due_at: null,
    time_of_day: "09:00",
    weekdays: null,
    day_of_month: p.day_of_month,
    extra_day_of_month: null,
    reminder_offsets_min: offsets,
    repeat_every_min: 240,
    escalate_before_min: null,
    responsible_id: responsibleId,
    backup_id: null,
    priority: "alta",
    active: p.active,
  };
}

export const CHEQUE_STATUS = { emitido: "Emitido", cobrado: "Cobrado", anulado: "Anulado" } as const;
export type ChequeStatus = keyof typeof CHEQUE_STATUS;

export interface ChequeInput {
  number: string;
  bank: string | null;
  beneficiary: string;
  amount: number;
  issued_on: string;
  cash_on: string; // fecha posfechada
  notes: string | null;
}

export interface Cheque extends ChequeInput {
  id: string;
  status: ChequeStatus;
}

const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);

/** RF-18: cheque emitido con fecha posfechada. */
export function parseChequeForm(f: FormLike): { data: ChequeInput } | { error: string } {
  const number = str(f, "number");
  if (!number) return { error: "Escribe el número del cheque." };
  const beneficiary = str(f, "beneficiary");
  if (!beneficiary) return { error: "Escribe a quién se le dio el cheque." };
  const amount = money(str(f, "amount"));
  if (!Number.isFinite(amount) || amount <= 0) return { error: "Escribe el monto del cheque." };
  const issued_on = str(f, "issued_on");
  const cash_on = str(f, "cash_on");
  if (!isDate(issued_on) || !isDate(cash_on)) return { error: "Elige la fecha de emisión y la fecha del cheque." };
  if (cash_on < issued_on) return { error: "La fecha del cheque no puede ser antes de la emisión." };
  return {
    data: { number, bank: str(f, "bank") || null, beneficiary, amount: Math.round(amount * 100) / 100, issued_on, cash_on, notes: str(f, "notes") || null },
  };
}

export interface CalendarItem {
  date: string;
  label: string;
  detail: string | null;
  amount: number;
  kind: PaymentKind | "cheque";
}

export interface CalendarWeek {
  start: string; // primer día de la semana dentro del mes
  end: string;
  items: CalendarItem[];
  total: number;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** RF-17: pagos del mes agrupados por semana (lunes a domingo) con su total. */
export function monthCalendar(payments: Payment[], cheques: Cheque[], year: number, month: number): { weeks: CalendarWeek[]; total: number } {
  const last = daysInMonth(year, month);
  const first = `${year}-${pad(month)}-01`;
  const items: CalendarItem[] = [];
  for (const p of payments) {
    if (!p.active) continue;
    items.push({
      date: `${year}-${pad(month)}-${pad(Math.min(p.day_of_month, last))}`,
      label: p.name,
      detail: [PAYMENT_KINDS[p.kind], p.bank].filter(Boolean).join(" · "),
      amount: Number(p.amount),
      kind: p.kind,
    });
  }
  for (const c of cheques) {
    if (c.status !== "emitido" || !c.cash_on.startsWith(`${year}-${pad(month)}-`)) continue;
    items.push({ date: c.cash_on, label: `Cheque ${c.number}: ${c.beneficiary}`, detail: c.bank, amount: Number(c.amount), kind: "cheque" });
  }
  items.sort((a, b) => a.date.localeCompare(b.date) || a.label.localeCompare(b.label));

  const weeks: CalendarWeek[] = [];
  let start = first;
  while (start.slice(0, 7) === first.slice(0, 7)) {
    const toSunday = (7 - weekdayOf(start)) % 7;
    let end = addDays(start, toSunday);
    if (end.slice(0, 7) !== first.slice(0, 7)) end = `${year}-${pad(month)}-${pad(last)}`;
    const inWeek = items.filter((i) => i.date >= start && i.date <= end);
    weeks.push({ start, end, items: inWeek, total: round2(inWeek.reduce((s, i) => s + i.amount, 0)) });
    start = addDays(end, 1);
  }
  return { weeks, total: round2(items.reduce((s, i) => s + i.amount, 0)) };
}

const round2 = (n: number) => Math.round(n * 100) / 100;
