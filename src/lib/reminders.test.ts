import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { fromLocal } from "./time";

vi.mock("server-only", () => ({}));
vi.mock("./whatsapp", () => ({
  sendReminder: vi.fn().mockRejectedValue(new Error("WhatsApp 400: número inválido")),
}));

const { runReminders } = await import("./reminders");

interface Call {
  table: string;
  op: string;
  payload?: unknown;
  filters: [string, unknown][];
}

/** Cliente falso: registra cada operación y devuelve datos fijos por tabla. */
function fakeDb(data: Record<string, unknown[]>, failureInsertResult: { error: unknown } = { error: null }) {
  const calls: Call[] = [];
  const from = (table: string) => {
    const call: Call = { table, op: "select", filters: [] };
    const result = () => {
      if (call.op === "insert" && table === "notifications") return { data: { id: "n1" }, error: null };
      if (call.op === "select") return { data: data[table] ?? [], error: null };
      return { data: null, error: null };
    };
    const builder = {
      select: () => builder,
      eq: (col: string, val: unknown) => (call.filters.push([col, val]), builder),
      gte: () => builder,
      lte: () => builder,
      in: () => builder,
      single: () => builder,
      insert: (payload: unknown) => ((call.op = "insert"), (call.payload = payload), calls.push(call), builder),
      update: (payload: unknown) => ((call.op = "update"), (call.payload = payload), calls.push(call), builder),
      delete: () => ((call.op = "delete"), calls.push(call), builder),
      upsert: (payload: unknown) => ((call.op = "upsert"), (call.payload = payload), calls.push(call), builder),
      then: (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
        Promise.resolve(result()).then(resolve, reject),
    };
    return builder;
  };
  const rpc = (fn: string, args: unknown) => {
    calls.push({ table: fn, op: "rpc", payload: args, filters: [] });
    return Promise.resolve(fn === "log_notification_failure" ? failureInsertResult : { data: null, error: null });
  };
  return { db: { from, rpc } as unknown as SupabaseClient, calls };
}

const now = fromLocal(2026, 10, 27, 8, 30);
const occurrenceId = "occ-1";
const data = {
  obligations: [
    {
      id: "ob-1",
      title: "Pedido de champiñón",
      frequency: "daily",
      due_at: null,
      time_of_day: "09:00",
      weekdays: null,
      day_of_month: null,
      starts_on: "2026-01-01",
      reminder_offsets_min: [60],
      repeat_every_min: null,
      escalate_before_min: null,
      responsible_id: "majo",
      backup_id: null,
      priority: "normal",
      active: true,
    },
  ],
  profiles: [{ id: "majo", full_name: "Majo", phone: "593991234567", role: "admin" }],
  occurrences: [
    { id: occurrenceId, obligation_id: "ob-1", due_at: fromLocal(2026, 10, 27, 9).toISOString(), status: "pending" },
  ],
  notifications: [],
};

describe("runReminders: fallos de envío", () => {
  it("un envío fallido se registra con log_notification_failure y libera el slot", async () => {
    const { db, calls } = fakeDb(data);
    const summary = await runReminders(db, now);

    expect(calls).toContainEqual(
      expect.objectContaining({
        table: "log_notification_failure",
        op: "rpc",
        payload: {
          p_occurrence: occurrenceId,
          p_recipient: "majo",
          p_slot: "reminder:60",
          p_error: "Error: WhatsApp 400: número inválido",
        },
      }),
    );
    expect(calls).toContainEqual(
      expect.objectContaining({ table: "notifications", op: "delete", filters: [["id", "n1"]] }),
    );
    expect(summary.failed).toHaveLength(1);
  });

  it("si guardar el fallo falla, igual libera el slot", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { db, calls } = fakeDb(data, { error: { message: "x" } });
    await runReminders(db, now);

    expect(calls).toContainEqual(
      expect.objectContaining({ table: "notifications", op: "delete", filters: [["id", "n1"]] }),
    );
    errorSpy.mockRestore();
  });
});
