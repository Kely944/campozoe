import { describe, expect, it } from "vitest";
import { maskAccount, monthCalendar, parseChequeForm, parsePaymentForm, paymentObligation, type Cheque, type Payment } from "./pagos";

function form(entries: Record<string, string>) {
  const fd = new FormData();
  Object.entries(entries).forEach(([k, v]) => fd.append(k, v));
  return fd;
}

const loan: Payment = {
  id: "p1",
  kind: "prestamo",
  name: "Préstamo equipos",
  bank: "Banco Pichincha",
  amount: 850.5,
  day_of_month: 5,
  debit_account: "2200123456",
  notice_days: 3,
  active: true,
  notes: null,
  obligation_id: null,
};

describe("parsePaymentForm (RF-15)", () => {
  it("préstamo con banco, cuota, día y cuenta", () => {
    const res = parsePaymentForm(
      form({ kind: "prestamo", name: "Préstamo equipos", bank: "Banco Pichincha", amount: "$850,50", day_of_month: "5", debit_account: "2200 123 456", notice_days: "3", active: "on" }),
    );
    expect(res).toEqual({
      data: { kind: "prestamo", name: "Préstamo equipos", bank: "Banco Pichincha", amount: 850.5, day_of_month: 5, debit_account: "2200123456", notice_days: 3, active: true, notes: null },
    });
  });

  it("errores claros", () => {
    expect(parsePaymentForm(form({ kind: "x" }))).toEqual({ error: "Elige el tipo de pago." });
    expect(parsePaymentForm(form({ kind: "trabajador", name: "Kelly", amount: "0", day_of_month: "1" }))).toEqual({ error: "Escribe el monto de la cuota." });
    expect(parsePaymentForm(form({ kind: "trabajador", name: "Kelly", amount: "450", day_of_month: "32" }))).toEqual({ error: "Elige el día de pago (1 a 31)." });
  });
});

describe("paymentObligation (RF-16, RNF-04)", () => {
  it("avisa con días de anticipación, sin monto y con la cuenta enmascarada", () => {
    const ob = paymentObligation(loan, "majo");
    expect(ob.title).toBe("Transferir para cuota: Préstamo equipos (Banco Pichincha cta. …3456)");
    expect(ob.title + ob.description).not.toContain("850");
    expect(ob.title + ob.description).not.toContain("2200123456");
    expect(ob).toMatchObject({ frequency: "monthly", day_of_month: 5, reminder_offsets_min: [4320, 1440, 120], responsible_id: "majo", priority: "alta" });
  });

  it("anticipación de 1 día no duplica el aviso", () => {
    expect(paymentObligation({ ...loan, notice_days: 1 }, null).reminder_offsets_min).toEqual([1440, 120]);
  });

  it("maskAccount", () => {
    expect(maskAccount("2200123456")).toBe("…3456");
    expect(maskAccount(null)).toBeNull();
  });
});

describe("parseChequeForm (RF-18)", () => {
  it("cheque posfechado", () => {
    expect(
      parseChequeForm(form({ number: "001234", beneficiary: "Molinos del Sur", amount: "1200", issued_on: "2026-10-31", cash_on: "2026-11-30" })),
    ).toMatchObject({ data: { number: "001234", amount: 1200, cash_on: "2026-11-30" } });
  });

  it("la fecha del cheque no puede ser antes de la emisión", () => {
    expect(parseChequeForm(form({ number: "1", beneficiary: "X", amount: "10", issued_on: "2026-10-31", cash_on: "2026-10-01" }))).toEqual({
      error: "La fecha del cheque no puede ser antes de la emisión.",
    });
  });
});

describe("monthCalendar (RF-17)", () => {
  const cheque: Cheque = {
    id: "c1",
    number: "001234",
    bank: "Produbanco",
    beneficiary: "Molinos del Sur",
    amount: 1200,
    issued_on: "2026-10-31",
    cash_on: "2026-11-10",
    notes: null,
    status: "emitido",
  };

  it("agrupa por semana de lunes a domingo y suma", () => {
    const worker: Payment = { ...loan, id: "p2", kind: "trabajador", name: "Kelly", bank: null, amount: 470, day_of_month: 30 };
    // noviembre 2026: el 1 es domingo
    const res = monthCalendar([loan, worker], [cheque, { ...cheque, id: "c2", status: "cobrado" }], 2026, 11);
    expect(res.weeks.map((w) => [w.start, w.end, w.total])).toEqual([
      ["2026-11-01", "2026-11-01", 0],
      ["2026-11-02", "2026-11-08", 850.5],
      ["2026-11-09", "2026-11-15", 1200],
      ["2026-11-16", "2026-11-22", 0],
      ["2026-11-23", "2026-11-29", 0],
      ["2026-11-30", "2026-11-30", 470],
    ]);
    expect(res.total).toBe(2520.5);
  });

  it("el día 31 cae en el último día de febrero; pagos pausados no cuentan", () => {
    const res = monthCalendar([{ ...loan, day_of_month: 31 }, { ...loan, id: "p3", active: false }], [], 2027, 2);
    expect(res.weeks.flatMap((w) => w.items.map((i) => i.date))).toEqual(["2027-02-28"]);
  });
});
