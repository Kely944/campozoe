import { describe, expect, it } from "vitest";
import {
  addBusinessDays,
  balancesByCustomer,
  creditNoteDeadline,
  creditNoteObligation,
  daysSince,
  parseCreditNoteForm,
  parseCreditSaleForm,
  reconcile,
  suggestInvoices,
} from "./cobros";
import { formatLocalInput, fromLocal } from "./time";

function form(entries: Record<string, string>) {
  const fd = new FormData();
  Object.entries(entries).forEach(([k, v]) => fd.append(k, v));
  return fd;
}

describe("ventas a crédito (RF-23, RF-25)", () => {
  it("cliente sin datos tributarios: nombre o puesto, monto y fecha", () => {
    expect(parseCreditSaleForm(form({ customer: "  Puesto 12  mercado ", amount: "25,50" }), "2026-10-31")).toEqual({
      data: { customer: "Puesto 12 mercado", amount: 25.5, sold_on: "2026-10-31", notes: null },
    });
    expect(parseCreditSaleForm(form({ customer: "Rosa", amount: "10", sold_on: "2026-11-05" }), "2026-10-31")).toEqual({
      error: "La fecha de la venta no puede ser futura.",
    });
    expect(parseCreditSaleForm(form({ customer: "", amount: "10" }), "2026-10-31")).toEqual({ error: "Escribe el nombre o puesto del cliente." });
  });

  it("saldos por cliente de mayor a menor, sin contar lo cobrado", () => {
    const res = balancesByCustomer([
      { id: "1", customer: "Doña Rosa", amount: 20, sold_on: "2026-10-01", paid_on: null },
      { id: "2", customer: "doña  rosa ", amount: 15.5, sold_on: "2026-10-10", paid_on: null },
      { id: "3", customer: "Puesto 12", amount: 50, sold_on: "2026-10-20", paid_on: null },
      { id: "4", customer: "Puesto 12", amount: 99, sold_on: "2026-09-20", paid_on: "2026-10-01" },
      { id: "5", customer: "Don Luis", amount: 5, sold_on: "2026-10-25", paid_on: null },
    ]);
    expect(res).toEqual([
      { customer: "Puesto 12", total: 50, count: 1, oldest: "2026-10-20" },
      { customer: "Doña Rosa", total: 35.5, count: 2, oldest: "2026-10-01" },
      { customer: "Don Luis", total: 5, count: 1, oldest: "2026-10-25" },
    ]);
  });

  it("daysSince", () => {
    expect(daysSince("2026-10-17", "2026-10-31")).toBe(14);
  });
});

describe("nota de crédito (RF-26)", () => {
  it("8 días laborables saltan fines de semana", () => {
    // factura del jueves 22-oct-2026 → vie 23, lun 26 … lun 2-nov es el 7.º, mar 3-nov el 8.º
    expect(creditNoteDeadline("2026-10-22")).toBe("2026-11-03");
    expect(addBusinessDays("2026-10-30", 1)).toBe("2026-11-02"); // viernes + 1 = lunes
  });

  it("formulario y tarea con aviso antes del último día a las 17:00", () => {
    const parsed = parseCreditNoteForm(form({ invoice_number: "001-001-000045", issued_on: "2026-10-22", customer: "Mercado" }), "2026-10-31");
    expect(parsed).toMatchObject({ data: { invoice_number: "001-001-000045", issued_on: "2026-10-22" } });
    const ob = creditNoteObligation("data" in parsed ? parsed.data : (null as never), "majo", fromLocal(2026, 10, 31, 9));
    expect(formatLocalInput(new Date(ob.due_at!))).toBe("2026-11-03T17:00");
    expect(ob).toMatchObject({ frequency: "once", reminder_offsets_min: [2880, 1440, 240], priority: "alta", responsible_id: "majo" });
  });

  it("si el plazo ya pasó, avisa enseguida", () => {
    const now = fromLocal(2026, 11, 20, 9);
    const ob = creditNoteObligation({ invoice_number: "1", customer: null, issued_on: "2026-10-01", reason: null }, null, now);
    expect(new Date(ob.due_at!).getTime() - now.getTime()).toBe(10 * 60_000);
  });
});

describe("conciliación de pagos de Favorita (RF-27)", () => {
  const invoices = [
    { id: "a", label: "F-1", amount: 960, date: "2026-07-01" },
    { id: "b", label: "F-2", amount: 1200.5, date: "2026-07-08" },
    { id: "c", label: "F-3", amount: 800, date: "2026-07-15" },
  ];

  it("diferencia entre pago y facturas elegidas", () => {
    expect(reconcile(2160.5, invoices.slice(0, 2))).toEqual({ sum: 2160.5, diff: 0, exact: true });
    expect(reconcile(2000, invoices.slice(0, 2))).toEqual({ sum: 2160.5, diff: -160.5, exact: false });
  });

  it("sugiere las facturas más antiguas que suman el pago exacto", () => {
    expect(suggestInvoices(2160.5, invoices)).toEqual(["a", "b"]);
    expect(suggestInvoices(2960.5, [...invoices].reverse())).toEqual(["a", "b", "c"]);
    expect(suggestInvoices(1000, invoices)).toBeNull();
  });
});
