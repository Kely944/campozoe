"use client";

import { useState } from "react";
import type { BarSelection, Series } from "@/lib/dashboard";

interface Props<S extends string> {
  series: Series<S>[];
  statuses: readonly S[];
  statusLabels: Record<S, string>;
  colors: Record<S, string>; // valores var(--...)
  orientation: "vertical" | "horizontal";
  axis: BarSelection["axis"];
  selected: BarSelection | null;
  status: string | null; // estado elegido en la leyenda: los demás segmentos se atenúan
  onSelect: (s: BarSelection | null) => void;
  title: string;
}

/**
 * Barras apiladas hechas a mano. Cada barra completa (columna o fila) es un botón grande que
 * filtra la lista; el estado se elige en la leyenda.
 */
export default function StackedBars<S extends string>(props: Props<S>) {
  const { series, statuses, statusLabels, colors, orientation, axis, selected, status, onSelect, title } = props;
  const [hover, setHover] = useState<string | null>(null);
  const max = Math.max(1, ...series.map((s) => s.total));
  const vertical = orientation === "vertical";

  const describe = (s: Series<S>) => {
    const parts = statuses.filter((st) => s.counts[st] > 0).map((st) => `${statusLabels[st]} ${s.counts[st]}`);
    return `${s.label} · ${parts.length ? parts.join(" · ") : "sin datos"}`;
  };
  const selectedSeries = selected?.axis === axis ? series.find((s) => s.key === selected.key) : undefined;
  const tooltip = hover ?? (selectedSeries ? describe(selectedSeries) : null);

  const bar = (s: Series<S>) => {
    const isSelected = selected?.axis === axis && selected.key === s.key;
    const dimBar = selected?.axis === axis && !isSelected;
    const nonZero = statuses.filter((st) => s.counts[st] > 0);
    // La pila ocupa la fracción del máximo; cada segmento crece según su cantidad.
    const track = `${(s.total / max) * 100}%`;
    return (
      <button
        key={s.key}
        type="button"
        aria-label={describe(s)}
        aria-pressed={isSelected}
        onClick={() => onSelect(isSelected ? null : { axis, key: s.key })}
        onMouseEnter={() => setHover(describe(s))}
        onMouseLeave={() => setHover(null)}
        onFocus={() => setHover(describe(s))}
        onBlur={() => setHover(null)}
        className={`flex min-w-0 outline-offset-2 focus-visible:outline-2 focus-visible:outline-stone-800 dark:focus-visible:outline-stone-200 ${
          vertical ? "h-full flex-1 flex-col-reverse" : "h-11 w-full items-center gap-2 text-left"
        } ${isSelected ? "rounded-md bg-stone-100 dark:bg-stone-800" : ""}`}
        style={{ opacity: dimBar ? 0.35 : 1 }}
      >
        {!vertical && (
          <span className="w-[6.5rem] shrink-0 truncate text-sm text-stone-700 dark:text-stone-300" title={s.label}>
            {s.label}
          </span>
        )}
        <span className={`flex min-w-0 ${vertical ? "h-full w-full flex-col-reverse" : "h-8 flex-1"}`} aria-hidden>
          <span
            className={`flex gap-[2px] ${vertical ? "w-full flex-col-reverse" : "h-full"}`}
            style={{ [vertical ? "height" : "width"]: track }}
          >
            {nonZero.map((st, i) => (
              <span
                key={st}
                className={`min-h-0 min-w-0 ${i === nonZero.length - 1 ? (vertical ? "rounded-t-[4px]" : "rounded-r-[4px]") : ""}`}
                style={{
                  background: colors[st],
                  opacity: status && status !== st ? 0.35 : 1,
                  flexGrow: s.counts[st],
                  flexBasis: 0,
                }}
              />
            ))}
          </span>
        </span>
        {!vertical && <span className="w-10 shrink-0 text-right text-sm font-semibold text-stone-800 dark:text-stone-200">{s.total}</span>}
      </button>
    );
  };

  const every = series.length <= 7 ? 1 : series.length <= 14 ? 3 : 5;

  return (
    <figure className="space-y-2">
      <figcaption className="text-sm font-semibold text-stone-700 dark:text-stone-300">{title}</figcaption>
      <p className="min-h-5 text-sm text-stone-600 dark:text-stone-400" aria-live="polite">
        {tooltip ?? "Toca una barra para ver el detalle."}
      </p>
      {vertical ? (
        <div>
          <div className="relative h-40 border-b border-stone-300 dark:border-stone-700">
            <span className="absolute -top-1 right-0 text-xs text-stone-500 dark:text-stone-400">{max}</span>
            <div className="absolute inset-x-0 top-0 border-t border-dashed border-stone-200 dark:border-stone-800" />
            <div className="absolute inset-x-0 top-1/2 border-t border-dashed border-stone-200 dark:border-stone-800" />
            <div className="relative flex h-full gap-[2px] pr-6">{series.map(bar)}</div>
          </div>
          <div className="flex gap-[2px] overflow-hidden pr-6 pt-1">
            {series.map((s, i) => (
              <span key={s.key} className="min-w-0 flex-1 overflow-visible whitespace-nowrap text-left text-xs text-stone-500 dark:text-stone-400">
                {i % every === 0 ? s.label : ""}
              </span>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-1">{series.map(bar)}</div>
      )}
    </figure>
  );
}
