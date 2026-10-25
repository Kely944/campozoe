import { describe, expect, it, vi } from "vitest";
import { bucketKeyFor, buildBuckets, classifyCompliance, fetchAll, parsePeriod, type OccurrenceRow } from "./dashboard";
import { DAY, fromLocal } from "./time";

const now = fromLocal(2026, 10, 24, 15); // sábado

describe("parsePeriod", () => {
  it("acepta 7, 30 y 90; cualquier otro valor es 30", () => {
    expect(parsePeriod("7")).toBe(7);
    expect(parsePeriod("30")).toBe(30);
    expect(parsePeriod("90")).toBe(90);
    expect(parsePeriod("15")).toBe(30);
    expect(parsePeriod(undefined)).toBe(30);
    expect(parsePeriod(["90"])).toBe(90);
  });
});

describe("buildBuckets", () => {
  it("7 días: un grupo por día local", () => {
    const b = buildBuckets(7, now);
    expect(b).toHaveLength(7);
    expect(b[0].key).toBe("2026-10-18");
    expect(b[0].start).toEqual(fromLocal(2026, 10, 18));
    expect(b[6].key).toBe("2026-10-24");
    expect(b[6].end).toEqual(fromLocal(2026, 10, 25));
    expect(b[6].label).toBe("Sáb 24");
  });

  it("30 días: 30 grupos", () => {
    expect(buildBuckets(30, now)).toHaveLength(30);
  });

  it("90 días: semanas de lunes a domingo", () => {
    const b = buildBuckets(90, now);
    expect(b[0].start).toEqual(fromLocal(2026, 7, 27));
    for (const w of b) {
      expect(w.end.getTime() - w.start.getTime()).toBe(7 * DAY);
      expect(new Date(w.start.getTime() - 5 * 3600_000).getUTCDay()).toBe(1);
    }
    expect(b[b.length - 1].start).toEqual(fromLocal(2026, 10, 19));
    expect(b[b.length - 1].label).toBe("19 oct");
  });
});

describe("bucketKeyFor", () => {
  it("usa el día local de Ecuador, no el de UTC", () => {
    expect(bucketKeyFor(fromLocal(2026, 10, 18, 23, 30), buildBuckets(7, now))).toBe("2026-10-18");
  });

  it("el domingo por la noche cae en su semana, no en la siguiente", () => {
    expect(bucketKeyFor(fromLocal(2026, 10, 18, 23, 30), buildBuckets(90, now))).toBe("2026-10-12");
  });

  it("fuera del periodo devuelve null", () => {
    expect(bucketKeyFor(fromLocal(2026, 10, 17, 23, 59), buildBuckets(7, now))).toBeNull();
  });
});

describe("fetchAll", () => {
  it("lee todas las páginas de 1000 filas", async () => {
    const rows = Array.from({ length: 2500 }, (_, i) => i);
    const page = vi.fn((from: number, to: number) => Promise.resolve({ data: rows.slice(from, to + 1), error: null }));
    const all = await fetchAll(page);
    expect(all).toHaveLength(2500);
    expect(page.mock.calls).toEqual([
      [0, 999],
      [1000, 1999],
      [2000, 2999],
    ]);
  });

  it("lanza el error de la consulta", async () => {
    const err = { message: "boom" };
    await expect(fetchAll(() => Promise.resolve({ data: null, error: err }))).rejects.toBe(err);
  });
});

describe("classifyCompliance", () => {
  const buckets = buildBuckets(7, now);
  const names = new Map([
    ["beto", "Beto"],
    ["majo", "Majo"],
  ]);
  const due = fromLocal(2026, 10, 22, 9);
  const row = (over: Partial<OccurrenceRow>): OccurrenceRow => ({
    id: "o1",
    due_at: due.toISOString(),
    status: "done",
    done_at: due.toISOString(),
    done_by: "beto",
    title: "Pedido de champiñón",
    responsible_id: "beto",
    ...over,
  });
  const classify = (rows: OccurrenceRow[]) => classifyCompliance(rows, names, buckets, now);

  it("marcada a la hora exacta del plazo es a tiempo", () => {
    expect(classify([row({})])[0]).toMatchObject({
      status: "a_tiempo",
      personId: "beto",
      personName: "Beto",
      doneByName: "Beto",
      bucketKey: "2026-10-22",
    });
  });

  it("un minuto después del plazo es tarde", () => {
    const late = new Date(due.getTime() + 60_000).toISOString();
    expect(classify([row({ done_at: late })])[0].status).toBe("tarde");
  });

  it("pendiente con plazo pasado es sin hacer", () => {
    expect(classify([row({ status: "pending", done_at: null, done_by: null })])[0]).toMatchObject({
      status: "sin_hacer",
      doneByName: null,
    });
  });

  it("excluye ocurrencias futuras y anteriores al periodo", () => {
    const future = fromLocal(2026, 10, 24, 16).toISOString();
    const before = fromLocal(2026, 10, 17, 9).toISOString();
    expect(classify([row({ due_at: future, status: "pending" }), row({ due_at: before })])).toEqual([]);
  });

  it("sin responsable se muestra como Administradora", () => {
    expect(classify([row({ responsible_id: null })])[0]).toMatchObject({ personId: null, personName: "Administradora" });
  });

  it("quien marcó y no está en la lista es Alguien", () => {
    expect(classify([row({ done_by: "x" })])[0].doneByName).toBe("Alguien");
  });

  it("ordena por fecha límite descendente", () => {
    const older = fromLocal(2026, 10, 20, 9).toISOString();
    expect(classify([row({ id: "a", due_at: older, done_at: older }), row({ id: "b" })]).map((i) => i.id)).toEqual(["b", "a"]);
  });
});
