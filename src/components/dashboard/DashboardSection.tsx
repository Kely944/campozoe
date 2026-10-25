"use client";

import { useRef, useState } from "react";
import type { Summary } from "@/lib/dashboard";
import StackedBars, { type Selection } from "./StackedBars";

export interface DetailRow {
  id: string;
  bucketKey: string;
  personKey: string;
  status: string;
  cells: string[]; // ya formateadas, en el orden de `columns`
}

interface Props {
  title: string;
  emptyText: string;
  summary: Summary<string>;
  statuses: readonly string[];
  statusLabels: Record<string, string>;
  colors: Record<string, string>;
  columns: string[];
  rows: DetailRow[];
  percentOf?: string; // estado que se muestra también como porcentaje del total
  tiles?: { label: string; value: number }[]; // cifras extra
  extra?: React.ReactNode;
}

const MAX_ROWS = 200;

/** Bloque del panel: cifras, leyenda, gráficas por fecha y por persona, y lista filtrable. */
export default function DashboardSection(props: Props) {
  const { title, emptyText, summary, statuses, statusLabels, colors, columns, rows, percentOf, tiles = [], extra } = props;
  const [selected, setSelected] = useState<Selection | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const total = statuses.reduce((n, s) => n + summary.totals[s], 0);

  const select = (s: Selection | null) => {
    setSelected(s);
    if (s) listRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const filtered = selected
    ? rows.filter(
        (r) => r.status === selected.status && (selected.axis === "bucket" ? r.bucketKey : r.personKey) === selected.key,
      )
    : rows;
  const selectedLabel = selected
    ? `${statusLabels[selected.status]} · ${
        (selected.axis === "bucket" ? summary.byBucket : summary.byPerson).find((s) => s.key === selected.key)?.label ?? ""
      }`
    : null;

  const chart = { statuses, statusLabels, colors, selected, onSelect: select };

  return (
    <section className="mb-10 space-y-4">
      <h2 className="text-lg font-bold">{title}</h2>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {statuses.map((s) => (
          <div key={s} className="card p-3">
            <p className="text-2xl font-bold text-stone-900">
              {s === percentOf && total ? `${Math.round((summary.totals[s] / total) * 100)}%` : summary.totals[s]}
            </p>
            <p className="flex items-center gap-2 text-sm text-stone-600">
              <span className="size-3 shrink-0 rounded-sm" style={{ background: colors[s] }} aria-hidden />
              {statusLabels[s]}
              {s === percentOf && total ? ` (${summary.totals[s]})` : ""}
            </p>
          </div>
        ))}
        {tiles.map((t) => (
          <div key={t.label} className="card p-3">
            <p className="text-2xl font-bold text-stone-900">{t.value}</p>
            <p className="text-sm text-stone-600">{t.label}</p>
          </div>
        ))}
      </div>

      {total === 0 ? (
        <p className="card text-stone-500">{emptyText}</p>
      ) : (
        <div className="card space-y-6">
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-stone-700" aria-label="Leyenda">
            {statuses.map((s) => (
              <li key={s} className="flex items-center gap-2">
                <span className="size-3 rounded-sm" style={{ background: colors[s] }} aria-hidden />
                {statusLabels[s]}
              </li>
            ))}
          </ul>
          <StackedBars {...chart} series={summary.byBucket} orientation="vertical" axis="bucket" title="Por fecha" />
          <StackedBars {...chart} series={summary.byPerson} orientation="horizontal" axis="person" title="Por persona" />
        </div>
      )}

      <div ref={listRef} className="scroll-mt-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold">
            Detalle <span className="font-normal text-stone-500">({filtered.length})</span>
          </h3>
          {selectedLabel && (
            <div className="flex items-center gap-2">
              <span className="rounded-lg bg-stone-200 px-3 py-1 text-sm font-semibold">{selectedLabel}</span>
              <button type="button" className="btn-secondary" onClick={() => select(null)}>
                Ver todo
              </button>
            </div>
          )}
        </div>
        {filtered.length === 0 ? (
          <p className="text-stone-500">Nada que mostrar.</p>
        ) : (
          <ul className="space-y-2">
            {filtered.slice(0, MAX_ROWS).map((r) => (
              <li key={r.id} className="card flex gap-3 p-3">
                <span className="mt-1 size-3 shrink-0 rounded-sm" style={{ background: colors[r.status] }} aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold" title={r.cells[0]}>
                    {r.cells[0]}
                  </p>
                  {r.cells.slice(1).map((c, i) =>
                    c ? (
                      <p key={i} className="break-words text-sm text-stone-600">
                        <span className="text-stone-500">{columns[i + 1]}:</span> {c}
                      </p>
                    ) : null,
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
        {filtered.length > MAX_ROWS && (
          <p className="text-sm text-stone-500">
            Mostrando {MAX_ROWS} de {filtered.length}. Toca una barra para ver menos filas.
          </p>
        )}
      </div>

      {extra}
    </section>
  );
}
