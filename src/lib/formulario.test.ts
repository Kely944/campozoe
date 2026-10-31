import { describe, expect, it } from "vitest";
import { isGoogleFormUrl, parseGoogleForm, prefillUrl } from "./formulario";

// Estructura de FB_PUBLIC_LOAD_DATA_ de un Formulario de Google (simplificada).
const data = [
  null,
  [
    "Oferta semanal",
    [
      [111, "Código de proveedor", null, 0, [[1001, null, 1]]],
      [112, "Centro de acopio", null, 2, [[1002, [["CAF 300 Quito"], ["CAF 400 Loja"]], 1]]],
      [113, "Código de barras del producto", null, 0, [[1003, null, 1]]],
      [114, "Número de javas", null, 0, [[1004, null, 1]]],
      [115, "Día de entrega", null, 2, [[1005, [["Miércoles"], ["Viernes"]], 1]]],
      [116, "Observaciones", null, 1, [[1006, null, 0]]],
      [117, "Sección sin pregunta", null, 8, null],
    ],
  ],
  "/forms",
  "Oferta",
];
const html = `<html><script>var FB_PUBLIC_LOAD_DATA_ = ${JSON.stringify(data)};</script></html>`;

describe("formulario de oferta prellenado (RF-14)", () => {
  it("solo consulta enlaces de Google Forms", () => {
    expect(isGoogleFormUrl("https://forms.gle/abc123")).toBe(true);
    expect(isGoogleFormUrl("https://docs.google.com/forms/d/e/XYZ/viewform")).toBe(true);
    expect(isGoogleFormUrl("https://docs.google.com/document/d/1")).toBe(false);
    expect(isGoogleFormUrl("http://forms.gle/abc")).toBe(false);
    expect(isGoogleFormUrl("https://evil.example/forms.gle")).toBe(false);
  });

  it("lee las preguntas y sus opciones", () => {
    const q = parseGoogleForm(html);
    expect(q?.map((x) => [x.title, x.entryId])).toEqual([
      ["Código de proveedor", 1001],
      ["Centro de acopio", 1002],
      ["Código de barras del producto", 1003],
      ["Número de javas", 1004],
      ["Día de entrega", 1005],
      ["Observaciones", 1006],
    ]);
    expect(q?.[4].options).toEqual(["Miércoles", "Viernes"]);
    expect(parseGoogleForm("<html>otro formato</html>")).toBeNull();
  });

  it("arma el enlace prellenado con las opciones exactas y avisa lo que falta", () => {
    const q = parseGoogleForm(html)!;
    const res = prefillUrl("https://docs.google.com/forms/d/e/XYZ/viewform?usp=sf_link", q, {
      supplierCode: "PRV-123",
      acopio: "CAF 400 (Loja)",
      barcode: "7861234500012",
      javas: 60,
      day: 5,
    });
    const u = new URL(res.url);
    expect(u.origin + u.pathname).toBe("https://docs.google.com/forms/d/e/XYZ/viewform");
    expect(Object.fromEntries(u.searchParams)).toEqual({
      usp: "pp_url",
      "entry.1001": "PRV-123",
      "entry.1002": "CAF 400 Loja",
      "entry.1003": "7861234500012",
      "entry.1004": "60",
      "entry.1005": "Viernes",
    });
    expect(res.missing).toEqual(["Observaciones"]);
  });
});
