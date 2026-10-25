import { describe, expect, it } from "vitest";
import { parseObligationForm } from "./obligation-form";

function form(entries: [string, string][]) {
  const fd = new FormData();
  entries.forEach(([k, v]) => fd.append(k, v));
  return fd;
}

describe("parseObligationForm", () => {
  it("semanal con días y avisos ordenados", () => {
    const res = parseObligationForm(
      form([
        ["title", "Oferta Favorita"],
        ["frequency", "weekly"],
        ["time_of_day", "19:00"],
        ["weekdays", "3"],
        ["offsets", "60"],
        ["offsets", "2880"],
        ["repeat_every_min", "120"],
        ["priority", "alta"],
        ["active", "on"],
      ]),
    );
    expect(res).toMatchObject({
      data: { weekdays: [3], reminder_offsets_min: [2880, 60], repeat_every_min: 120, priority: "alta", active: true },
    });
  });

  it("única: convierte la hora local de Ecuador a UTC", () => {
    const res = parseObligationForm(
      form([["title", "Pagar"], ["frequency", "once"], ["due_local", "2026-10-30T10:00"], ["offsets", "1440"]]),
    );
    expect(res).toMatchObject({ data: { due_at: "2026-10-30T15:00:00.000Z", time_of_day: null } });
  });

  it("errores claros", () => {
    expect(parseObligationForm(form([["frequency", "daily"]]))).toEqual({ error: "Escribe un nombre para la tarea." });
    expect(
      parseObligationForm(form([["title", "X"], ["frequency", "weekly"], ["time_of_day", "09:00"], ["offsets", "60"]])),
    ).toEqual({ error: "Elige al menos un día de la semana." });
    expect(
      parseObligationForm(
        form([["title", "X"], ["frequency", "daily"], ["time_of_day", "09:00"], ["offsets", "60"], ["responsible_id", "a"], ["backup_id", "a"]]),
      ),
    ).toEqual({ error: "El respaldo debe ser otra persona." });
  });
});
