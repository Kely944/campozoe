import { describe, expect, it, vi } from "vitest";
import {
  bucketKeyFor,
  buildBuckets,
  classifyCompliance,
  classifyNotifications,
  fetchAll,
  filterDetail,
  findMissingPhones,
  summarize,
  parsePeriod,
  slotLabel,
  type FailureRow,
  type NotificationRow,
  type OccurrenceRow,
} from "./dashboard";
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

describe("slotLabel", () => {
  it("nombra cada tipo de aviso en español", () => {
    expect(slotLabel("reminder:1440")).toBe("Aviso 1 día antes");
    expect(slotLabel("reminder:120")).toBe("Aviso 2 h antes");
    expect(slotLabel("repeat:3")).toBe("Repetición");
    expect(slotLabel("escalation")).toBe("Aviso al respaldo");
    expect(slotLabel("overdue")).toBe("Vencida");
  });
});

describe("classifyNotifications", () => {
  const buckets = buildBuckets(7, now);
  const names = new Map([["beto", "Beto"]]);
  const titles = new Map([["o1", "Oferta Favorita"]]);
  const at = (d: number, h: number, m = 0) => fromLocal(2026, 10, d, h, m).toISOString();
  const sent = (over: Partial<NotificationRow> = {}): NotificationRow => ({
    occurrence_id: "o1",
    recipient_id: "beto",
    slot: "reminder:60",
    status: "sent",
    sent_at: at(22, 10),
    ...over,
  });
  const fail = (failed_at: string, error = "WhatsApp 400", attempts = 1): FailureRow => ({
    occurrence_id: "o1",
    recipient_id: "beto",
    slot: "reminder:60",
    error,
    failed_at,
    attempts,
  });
  const classify = (s: NotificationRow[], f: FailureRow[], t = titles) => classifyNotifications(s, f, t, names, buckets);

  it("falló y luego salió: un solo aviso enviado", () => {
    const res = classify([sent()], [fail(at(22, 9)), fail(at(22, 9, 5))]);
    expect(res).toEqual([
      {
        key: "o1|reminder:60|beto",
        occurrenceId: "o1",
        title: "Oferta Favorita",
        slotLabel: "Aviso 1 h antes",
        personId: "beto",
        personName: "Beto",
        status: "enviado",
        at: at(22, 10),
        lastError: null,
        attempts: 0,
        bucketKey: "2026-10-22",
      },
    ]);
  });

  it("solo fallos: un aviso fallido con el último error y los intentos", () => {
    const res = classify([], [fail(at(21, 9), "viejo"), fail(at(22, 9, 10), "último"), fail(at(22, 9, 5), "medio")]);
    expect(res).toHaveLength(1);
    expect(res[0]).toMatchObject({ status: "fallido", attempts: 3, lastError: "último", at: at(22, 9, 10), bucketKey: "2026-10-22" });
  });

  it("excluye envíos en curso sin fallos", () => {
    expect(classify([sent({ status: "sending" })], [])).toEqual([]);
  });

  it("simulated se muestra como simulado", () => {
    expect(classify([sent({ status: "simulated" })], [])[0].status).toBe("simulado");
  });

  it("excluye avisos fuera del periodo", () => {
    expect(classify([sent({ sent_at: at(10, 10) })], [])).toEqual([]);
  });

  it("usa el contador de intentos de la fila (una fila por aviso)", () => {
    expect(classify([], [fail(at(22, 9), "token vencido", 288)])[0]).toMatchObject({ status: "fallido", attempts: 288 });
  });

  it("tarea que ya no existe se llama Tarea eliminada", () => {
    expect(classify([sent()], [], new Map())[0].title).toBe("Tarea eliminada");
  });
});

describe("summarize", () => {
  const buckets = buildBuckets(7, now);
  const statuses = ["a_tiempo", "tarde"] as const;
  const item = (status: (typeof statuses)[number], bucketKey: string, personId: string | null, personName: string) => ({
    status,
    bucketKey,
    personId,
    personName,
  });
  const res = summarize(
    [
      item("a_tiempo", "2026-10-20", "beto", "Beto"),
      item("tarde", "2026-10-20", null, "Administradora"),
      item("tarde", "2026-10-22", null, "Administradora"),
    ],
    statuses,
    buckets,
  );

  it("un grupo por día, en orden y con ceros", () => {
    expect(res.byBucket.map((s) => s.key)).toEqual(buckets.map((b) => b.key));
    expect(res.byBucket[0]).toEqual({ key: "2026-10-18", label: "Dom 18", counts: { a_tiempo: 0, tarde: 0 }, total: 0 });
    expect(res.byBucket[2]).toMatchObject({ counts: { a_tiempo: 1, tarde: 1 }, total: 2 });
  });

  it("personas por total descendente; sin responsable es admin", () => {
    expect(res.byPerson.map((s) => [s.key, s.label, s.total])).toEqual([
      ["admin", "Administradora", 2],
      ["beto", "Beto", 1],
    ]);
  });

  it("totales por estado", () => {
    expect(res.totals).toEqual({ a_tiempo: 1, tarde: 2 });
  });
});

describe("findMissingPhones", () => {
  const profiles = [
    { id: "majo", full_name: "Majo", phone: null, role: "admin" as const },
    { id: "beto", full_name: "Beto", phone: null, role: "operativo" as const },
    { id: "kelly", full_name: "Kelly", phone: null, role: "operativo" as const },
    { id: "ana", full_name: "Ana", phone: "593991234567", role: "operativo" as const },
  ];
  const ob = (id: string, responsible_id: string | null, backup_id: string | null = null, active = true) => ({
    id,
    title: `Tarea ${id}`,
    active,
    responsible_id,
    backup_id,
  });

  it("lista personas y tareas sin WhatsApp", () => {
    const res = findMissingPhones(profiles, [
      ob("1", "beto"),
      ob("2", null),
      ob("3", "beto", "kelly"),
      ob("4", "ana"),
      ob("5", "beto", null, false),
    ]);
    expect(res.people.map((p) => p.name)).toEqual(["Majo", "Beto", "Kelly"]);
    expect(res.tasks).toEqual([
      { id: "1", title: "Tarea 1", who: ["Beto"] },
      { id: "2", title: "Tarea 2", who: ["Administradora"] },
      { id: "3", title: "Tarea 3", who: ["Beto", "Kelly (respaldo)"] },
    ]);
  });
});

describe("filterDetail", () => {
  const rows = [
    { id: "1", bucketKey: "2026-10-20", personKey: "beto", status: "tarde" },
    { id: "2", bucketKey: "2026-10-20", personKey: "admin", status: "a_tiempo" },
    { id: "3", bucketKey: "2026-10-21", personKey: "beto", status: "a_tiempo" },
  ];
  const ids = (f: Parameters<typeof filterDetail>[1]) => filterDetail(rows, f).map((r) => r.id);

  it("sin filtro devuelve todo", () => {
    expect(ids({ selection: null, status: null })).toEqual(["1", "2", "3"]);
  });

  it("filtra por barra tocada (fecha o persona)", () => {
    expect(ids({ selection: { axis: "bucket", key: "2026-10-20" }, status: null })).toEqual(["1", "2"]);
    expect(ids({ selection: { axis: "person", key: "beto" }, status: null })).toEqual(["1", "3"]);
  });

  it("filtra por estado de la leyenda", () => {
    expect(ids({ selection: null, status: "a_tiempo" })).toEqual(["2", "3"]);
  });

  it("combina barra y estado", () => {
    expect(ids({ selection: { axis: "person", key: "beto" }, status: "tarde" })).toEqual(["1"]);
  });
});
