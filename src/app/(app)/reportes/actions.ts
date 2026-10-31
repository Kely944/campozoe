"use server";

import { revalidatePath } from "next/cache";
import type { FormState } from "@/app/actions";
import { readTable } from "@/lib/hoja";
import { IMPORT_KINDS, mapProducts, mapReceivables, mapSales, type ImportKind } from "@/lib/importacion";
import { requireAdmin } from "@/lib/session";

const BATCH = 500;

/** RF-32: importa un Excel/CSV del facturador o del historial. */
export async function importFile(_: FormState, formData: FormData): Promise<FormState> {
  // Primero el permiso: no se procesa ningún archivo de quien no es administradora.
  const { supabase } = await requireAdmin();
  const kind = String(formData.get("kind")) as ImportKind;
  const file = formData.get("file");
  if (!Object.hasOwn(IMPORT_KINDS, kind)) return { error: "Elige qué vas a importar." };
  if (!(file instanceof File) || file.size === 0) return { error: "Elige el archivo." };
  if (file.size > 10 * 1024 * 1024) return { error: "El archivo pasa de 10 MB. Divídelo por años." };

  let rows: string[][];
  try {
    rows = readTable(new Uint8Array(await file.arrayBuffer()), file.name);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo leer el archivo." };
  }

  const result = kind === "ventas" ? mapSales(rows) : kind === "productos" ? mapProducts(rows) : mapReceivables(rows);
  if ("error" in result) return { error: result.error };
  if (!result.records.length) return { error: "No se encontraron filas válidas en el archivo." };

  // Cuentas por cobrar: la foto nueva se inserta completa y recién entonces se borra la anterior.
  const importedAt = new Date().toISOString();
  const table = kind === "ventas" ? "sales" : kind === "productos" ? "catalog_products" : "receivables";
  const conflict = kind === "ventas" ? "import_key" : kind === "productos" ? "name" : undefined;
  let saved = 0;
  for (let i = 0; i < result.records.length; i += BATCH) {
    const chunk = (result.records.slice(i, i + BATCH) as unknown as Record<string, unknown>[]).map((r) =>
      kind === "cxc" ? { ...r, imported_at: importedAt } : r,
    );
    const { error, count } = conflict
      ? await supabase.from(table).upsert(chunk, { onConflict: conflict, ignoreDuplicates: kind === "ventas", count: "exact" })
      : await supabase.from(table).insert(chunk, { count: "exact" });
    if (error) {
      if (kind === "cxc") {
        await supabase.from("receivables").delete().eq("imported_at", importedAt);
        return { error: "No se pudo importar; se mantienen las cuentas por cobrar anteriores." };
      }
      return { error: `Se guardaron ${saved} filas y luego falló: revisa el archivo e intenta de nuevo.` };
    }
    saved += count ?? chunk.length;
  }
  if (kind === "cxc") await supabase.from("receivables").delete().lt("imported_at", importedAt);

  revalidatePath("/reportes");
  revalidatePath("/cobros");
  const skipped = result.skipped ? ` Se saltaron ${result.skipped} filas incompletas.` : "";
  const dupes = kind === "ventas" && saved < result.records.length ? ` ${result.records.length - saved} ya estaban importadas.` : "";
  return { ok: `${IMPORT_KINDS[kind]}: ${saved} filas nuevas.${dupes}${skipped}` };
}
