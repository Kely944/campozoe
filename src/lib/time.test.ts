import { describe, expect, it } from "vitest";
import { addDays, formatDate, formatUSD, fromLocal, localDate, weekdayOf } from "./time";

describe("fechas locales", () => {
  it("localDate usa la hora de Ecuador, no UTC", () => {
    // 31-oct 22:00 en Ecuador = 1-nov 03:00 UTC
    expect(localDate(fromLocal(2026, 10, 31, 22))).toBe("2026-10-31");
  });

  it("addDays cruza meses y años", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("weekdayOf y formatDate", () => {
    expect(weekdayOf("2026-11-02")).toBe(1); // lunes
    expect(formatDate("2026-11-02")).toBe("lunes, 2 de noviembre");
  });

  it("formatUSD", () => {
    expect(formatUSD(1234.5).replace(/\s/g, " ")).toMatch(/\$\s?1\.234,50/);
  });
});
