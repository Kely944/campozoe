import { describe, expect, it } from "vitest";
import { generateOccurrences, planNotifications, type ObligationRule, type PlanInput } from "./schedule";
import { fromLocal, toLocal } from "./time";

const base: ObligationRule = {
  frequency: "daily",
  due_at: null,
  time_of_day: "09:00",
  weekdays: null,
  day_of_month: null,
  starts_on: "2026-01-01",
};

const local = (d: Date) => {
  const p = toLocal(d);
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${String(p.minute).padStart(2, "0")}`;
};

describe("generateOccurrences", () => {
  it("diaria: una por día a la hora local", () => {
    const res = generateOccurrences(base, fromLocal(2026, 10, 24, 10), fromLocal(2026, 10, 27, 23));
    // el 24 a las 9:00 ya pasó
    expect(res.map(local)).toEqual(["2026-10-25 9:00", "2026-10-26 9:00", "2026-10-27 9:00"]);
  });

  it("diaria con días de semana: excluye domingo", () => {
    const rule = { ...base, weekdays: [1, 2, 3, 4, 5, 6] };
    // 25-oct-2026 es domingo
    const res = generateOccurrences(rule, fromLocal(2026, 10, 25), fromLocal(2026, 10, 26, 23));
    expect(res.map(local)).toEqual(["2026-10-26 9:00"]);
  });

  it("semanal: miércoles 19:00 (oferta Favorita)", () => {
    const rule: ObligationRule = { ...base, frequency: "weekly", weekdays: [3], time_of_day: "19:00" };
    const res = generateOccurrences(rule, fromLocal(2026, 10, 24), fromLocal(2026, 11, 7));
    expect(res.map(local)).toEqual(["2026-10-28 19:00", "2026-11-4 19:00"]);
  });

  it("mensual: día 31 cae en el último día de meses cortos", () => {
    const rule: ObligationRule = { ...base, frequency: "monthly", day_of_month: 31, time_of_day: "10:00" };
    const res = generateOccurrences(rule, fromLocal(2026, 11, 1), fromLocal(2027, 2, 28, 23));
    expect(res.map(local)).toEqual(["2026-11-30 10:00", "2026-12-31 10:00", "2027-1-31 10:00", "2027-2-28 10:00"]);
  });

  it("única: solo si cae en el rango", () => {
    const rule: ObligationRule = { ...base, frequency: "once", due_at: fromLocal(2026, 10, 30, 11).toISOString() };
    expect(generateOccurrences(rule, fromLocal(2026, 10, 24), fromLocal(2026, 11, 7))).toHaveLength(1);
    expect(generateOccurrences(rule, fromLocal(2026, 11, 1), fromLocal(2026, 11, 7))).toHaveLength(0);
  });

  it("respeta la fecha de inicio", () => {
    const rule = { ...base, starts_on: "2026-10-27" };
    const res = generateOccurrences(rule, fromLocal(2026, 10, 25), fromLocal(2026, 10, 28, 23));
    expect(res.map(local)).toEqual(["2026-10-27 9:00", "2026-10-28 9:00"]);
  });
});

describe("planNotifications", () => {
  const due = fromLocal(2026, 10, 28, 19); // miércoles 19:00
  const input = (over: Partial<PlanInput>): PlanInput => ({
    now: fromLocal(2026, 10, 26, 10),
    dueAt: due,
    status: "pending",
    offsetsMin: [2880, 1440, 120],
    repeatEveryMin: 60,
    escalateBeforeMin: 240,
    responsibleId: "majo",
    backupId: "beto",
    sent: [],
    ...over,
  });

  it("sin avisos antes del primer offset", () => {
    expect(planNotifications(input({ now: fromLocal(2026, 10, 26, 10) }))).toEqual([]);
  });

  it("envía el recordatorio al alcanzar el offset", () => {
    const res = planNotifications(input({ now: fromLocal(2026, 10, 26, 19, 5) }));
    expect(res).toEqual([{ slot: "reminder:2880", recipientId: "majo", kind: "reminder" }]);
  });

  it("si se crea tarde, solo envía el recordatorio más cercano", () => {
    const res = planNotifications(input({ now: fromLocal(2026, 10, 28, 10) }));
    expect(res).toEqual([{ slot: "reminder:1440", recipientId: "majo", kind: "reminder" }]);
  });

  it("no repite un recordatorio ya enviado", () => {
    const sentAt = fromLocal(2026, 10, 26, 19, 5);
    const res = planNotifications(
      input({ now: fromLocal(2026, 10, 26, 19, 30), sent: [{ slot: "reminder:2880", recipientId: "majo", sentAt }] }),
    );
    expect(res).toEqual([]);
  });

  it("repite cada hora hasta que se marque hecha", () => {
    const sentAt = fromLocal(2026, 10, 27, 10);
    const res = planNotifications(
      input({ now: fromLocal(2026, 10, 27, 11, 2), sent: [{ slot: "reminder:2880", recipientId: "majo", sentAt }] }),
    );
    expect(res).toEqual([{ slot: "repeat:1", recipientId: "majo", kind: "repeat" }]);
  });

  it("escala al respaldo cerca del plazo", () => {
    const sent = [{ slot: "reminder:1440", recipientId: "majo", sentAt: fromLocal(2026, 10, 27, 19) }];
    const res = planNotifications(input({ now: fromLocal(2026, 10, 28, 15, 30), sent, repeatEveryMin: null }));
    expect(res).toEqual([{ slot: "escalation", recipientId: "beto", kind: "escalation" }]);
  });

  it("vencida: avisa a responsable y respaldo una sola vez", () => {
    const res = planNotifications(input({ now: fromLocal(2026, 10, 28, 19, 10) }));
    expect(res.map((r) => r.recipientId)).toEqual(["majo", "beto"]);
    const again = planNotifications(
      input({
        now: fromLocal(2026, 10, 28, 20),
        sent: res.map((r) => ({ ...r, sentAt: fromLocal(2026, 10, 28, 19, 10) })),
      }),
    );
    expect(again).toEqual([]);
  });

  it("nada si está hecha o sin responsable", () => {
    expect(planNotifications(input({ now: fromLocal(2026, 10, 28, 10), status: "done" }))).toEqual([]);
    expect(planNotifications(input({ now: fromLocal(2026, 10, 28, 10), responsibleId: null }))).toEqual([]);
  });

  it("no envía en horario de descanso (21:00-07:00)", () => {
    expect(planNotifications(input({ now: fromLocal(2026, 10, 27, 22) }))).toEqual([]);
    expect(planNotifications(input({ now: fromLocal(2026, 10, 28, 7) }))).toHaveLength(1);
  });
});
