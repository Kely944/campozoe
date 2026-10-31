import { DELIVERY_DAYS, type DeliveryDay } from "./favorita";

/**
 * RF-14: llenar el formulario de oferta automáticamente "si el formato del enlace lo permite".
 * Si el enlace es un Formulario de Google, se leen sus preguntas y se arma un enlace
 * prellenado por producto: Majo solo revisa y presiona "Enviar". Si el formato no se
 * reconoce, la app sigue mostrando los datos para copiar.
 */

export interface FormQuestion {
  title: string;
  entryId: number;
  options: string[];
}

/** Hosts permitidos (evita que el servidor consulte direcciones arbitrarias). */
export function isGoogleFormUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && (u.hostname === "forms.gle" || (u.hostname === "docs.google.com" && u.pathname.startsWith("/forms/")));
  } catch {
    return false;
  }
}

/** Lee las preguntas de la variable FB_PUBLIC_LOAD_DATA_ que trae la página del formulario. */
export function parseGoogleForm(html: string): FormQuestion[] | null {
  const m = html.match(/FB_PUBLIC_LOAD_DATA_\s*=\s*([\s\S]*?);\s*<\/script>/);
  if (!m) return null;
  try {
    const data = JSON.parse(m[1]);
    const items: unknown[] = data?.[1]?.[1] ?? [];
    const questions: FormQuestion[] = [];
    for (const it of items) {
      const item = it as [unknown, string, unknown, number, [[number, [string][] | null]] | null];
      const field = item?.[4]?.[0];
      if (!field || typeof field[0] !== "number") continue;
      questions.push({ title: String(item[1] ?? ""), entryId: field[0], options: (field[1] ?? []).map((o) => String(o[0])) });
    }
    return questions.length ? questions : null;
  } catch {
    return null;
  }
}

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export interface PrefillValues {
  supplierCode: string | null;
  acopio: string;
  barcode: string | null;
  javas: number;
  day: DeliveryDay;
}

/** Elige el valor de cada pregunta por palabras clave del título. */
function valueFor(q: FormQuestion, v: PrefillValues): string | null {
  const t = norm(q.title);
  if (t.includes("proveedor")) return v.supplierCode;
  if (t.includes("acopio") || t.includes("centro")) return q.options.length ? (q.options.find((o) => norm(o).includes("400") || norm(o).includes("loja")) ?? null) : v.acopio;
  if (t.includes("barra") || t.includes("ean")) return v.barcode;
  if (t.includes("java") || t.includes("cantidad")) return String(v.javas);
  if (t.includes("dia") || t.includes("entrega")) {
    const day = norm(DELIVERY_DAYS[v.day]);
    return q.options.length ? (q.options.find((o) => norm(o).startsWith(day.slice(0, 3))) ?? null) : DELIVERY_DAYS[v.day];
  }
  return null;
}

/** Enlace prellenado: `…/viewform?usp=pp_url&entry.N=valor`. Devuelve también qué preguntas quedaron sin llenar. */
export function prefillUrl(formUrl: string, questions: FormQuestion[], v: PrefillValues) {
  const base = formUrl.split("?")[0].replace(/\/(viewform|formResponse)$/, "") + "/viewform";
  const params = new URLSearchParams({ usp: "pp_url" });
  const missing: string[] = [];
  for (const q of questions) {
    const value = valueFor(q, v);
    if (value) params.append(`entry.${q.entryId}`, value);
    else missing.push(q.title);
  }
  return { url: `${base}?${params.toString()}`, missing };
}
