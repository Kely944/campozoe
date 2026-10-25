"use client";

import { useState } from "react";
import type { Series } from "@/lib/dashboard";

export interface Selection {
  axis: "bucket" | "person";
  key: string;
  status: string;
}

interface Props<S extends string> {
  series: Series<S>[];
  statuses: readonly S[];
  statusLabels: Record<S, string>;
  colors: Record<S, string>; // valores var(--...)
  orientation: "vertical" | "horizontal";
  axis: Selection["axis"];
  selected: Selection | null;
  onSelect: (s: Selection | null) => void;
  title: string;
}

const same = (a: Selection | null, b: Selection) => !!a && a.axis === b.axis && a.key === b.key && a.status === b.status;

/** Barras apiladas hechas a mano: cada segmento es un botón que filtra la lista. */
export default function StackedBars<S extends string>(props: Props<S>) {
  const { series, statuses, statusLabels, colors, orientation, axis, selected, onSelect, title } = props;
  const [hover, setHover] = useState<{ sel: Selection; text: string } | null>(null);
  const max = Math.max(1, ...series.map((s) => s.total));
  const vertical = orientation === "vertical";

  const describe = (s: Series<S>, status: S) => `${s.label} · ${statusLabels[status]} · ${s.counts[status]}`;
  const tooltip =
    hover?.text ??
    (selected?.axis === axis
      ? (() => {
          const s = series.find((x) => x.key === selected.key);
          return s ? describe(s, selected.status as S) : null;
        })()
      : null);

  const segments = (s: Series<S>) => {
    const nonZero = statuses.filter((st) => s.counts[st] > 0);
    return nonZero.map((status, i) => {
      const sel: Selection = { axis, key: s.key, status };
      const dimmed = selected && !same(selected, sel);
      const size = `${(s.counts[status] / max) * 100}%`;
      const end = i === nonZero.length - 1;
      return (
        <button
          key={status}
          type="button"
          aria-label={describe(s, status)}
          aria-pressed={same(selected, sel)}
          onClick={() => onSelect(same(selected, sel) ? null : sel)}
          onMouseEnter={() => setHover({ sel, text: describe(s, status) })}
          onMouseLeave={() => setHover(null)}
          onFocus={() => setHover({ sel, text: describe(s, status) })}
          onBlur={() => setHover(null)}
          className={`shrink-0 outline-offset-2 focus-visible:outline-2 focus-visible:outline-stone-800 ${
            end ? (vertical ? "rounded-t-[4px]" : "rounded-r-[4px]") : ""
          }`}
          style={{
            background: colors[status],
            opacity: dimmed ? 0.35 : 1,
            [vertical ? "height" : "width"]: size,
            [vertical ? "width" : "height"]: "100%",
          }}
        />
      );
    });
  };

  const every = series.length <= 7 ? 1 : series.length <= 14 ? 3 : 5;

  return (
    <figure className="space-y-2">
      <figcaption className="text-sm font-semibold text-stone-700">{title}</figcaption>
      <p className="min-h-5 text-sm text-stone-600" aria-live="polite">
        {tooltip ?? "Toca una barra para ver el detalle."}
      </p>
      {vertical ? (
        <div>
          <div className="relative h-40 border-b border-stone-300">
            <span className="absolute -top-1 right-0 text-xs text-stone-500">{max}</span>
            <div className="absolute inset-x-0 top-0 border-t border-dashed border-stone-200" />
            <div className="absolute inset-x-0 top-1/2 border-t border-dashed border-stone-200" />
            <div className="relative flex h-full items-end gap-[2px] pr-6">
              {series.map((s) => (
                <div key={s.key} className="flex h-full min-w-0 flex-1 flex-col-reverse gap-[2px]">
                  {segments(s)}
                </div>
              ))}
            </div>
          </div>
          <div className="flex gap-[2px] overflow-hidden pr-6 pt-1">
            {series.map((s, i) => (
              <span key={s.key} className="min-w-0 flex-1 overflow-visible whitespace-nowrap text-center text-xs text-stone-500">
                {i % every === 0 || i === series.length - 1 ? s.label : ""}
              </span>
            ))}
          </div>
        </div>
      ) : (
        <ul className="space-y-2">
          {series.map((s) => (
            <li key={s.key} className="grid grid-cols-[6.5rem_1fr_2.5rem] items-center gap-2">
              <span className="truncate text-sm text-stone-700" title={s.label}>
                {s.label}
              </span>
              <div className="flex h-8 gap-[2px]">{segments(s)}</div>
              <span className="text-right text-sm font-semibold text-stone-800">{s.total}</span>
            </li>
          ))}
        </ul>
      )}
    </figure>
  );
}
