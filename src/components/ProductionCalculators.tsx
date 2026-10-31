"use client";

import { useState } from "react";
import { CORCHO_KG, dryGrainKg, mushroomTrays } from "@/lib/produccion";

const num = (v: string) => Number(v.replace(",", ".")) || 0;
const kg = (n: number) => `${n.toLocaleString("es-EC")} kg`;

/** RF-28 y RF-30: calculadoras con resultado en vivo. */
export default function ProductionCalculators() {
  const [units, setUnits] = useState("800");
  const [grams, setGrams] = useState("300");
  const [yld, setYld] = useState("2");
  const grain = dryGrainKg(num(units), num(grams), Math.max(1, num(yld)));

  const [corchos, setCorchos] = useState("1");
  const [kg1, setKg1] = useState("");
  const [g90, setG90] = useState("");
  const [merma, setMerma] = useState("");
  const trays = mushroomTrays(num(corchos) * CORCHO_KG, { kg1: num(kg1), g90: num(g90), merma: num(merma) });

  return (
    <div className="space-y-8">
      <section className="card">
        <h2 className="mb-3 text-xl font-semibold">Grano a remojar</h2>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="label" htmlFor="calc-units">Unidades</label>
            <input className="field" id="calc-units" inputMode="numeric" value={units} onChange={(e) => setUnits(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="calc-grams">Gramos c/u</label>
            <input className="field" id="calc-grams" inputMode="numeric" value={grams} onChange={(e) => setGrams(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="calc-yield">Rendimiento</label>
            <input className="field" id="calc-yield" inputMode="decimal" value={yld} onChange={(e) => setYld(e.target.value)} />
          </div>
        </div>
        <p className="mt-4 rounded-xl bg-green-50 px-4 py-3 text-green-900 dark:bg-green-950/40 dark:text-green-200" aria-live="polite">
          Cocido: <strong>{kg(grain.cookedKg)}</strong> · Remojar: <strong className="text-xl">{kg(grain.dryKg)}</strong> de grano seco
        </p>
      </section>

      <section className="card">
        <h2 className="mb-3 text-xl font-semibold">Bandejas de champiñón</h2>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="calc-corchos">Corchos de 14 kg</label>
            <input className="field" id="calc-corchos" inputMode="decimal" value={corchos} onChange={(e) => setCorchos(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="calc-merma">Merma % (opcional)</label>
            <input className="field" id="calc-merma" inputMode="decimal" value={merma} onChange={(e) => setMerma(e.target.value)} placeholder="0" />
          </div>
          <div>
            <label className="label" htmlFor="calc-kg1">Bandejas de 1 kg</label>
            <input className="field" id="calc-kg1" inputMode="numeric" value={kg1} onChange={(e) => setKg1(e.target.value)} placeholder="0" />
          </div>
          <div>
            <label className="label" htmlFor="calc-g90">Bandejas de 90 g</label>
            <input className="field" id="calc-g90" inputMode="numeric" value={g90} onChange={(e) => setG90(e.target.value)} placeholder="0" />
          </div>
        </div>
        <div className="mt-4" aria-live="polite">
          {"error" in trays ? (
            <p className="rounded-xl bg-red-50 px-4 py-3 text-red-800 dark:bg-red-950/40 dark:text-red-300">{trays.error}</p>
          ) : (
            <>
              <p className="rounded-xl bg-green-50 px-4 py-3 text-green-900 dark:bg-green-950/40 dark:text-green-200">
                Con {kg(trays.usableKg)}: {trays.kg1 > 0 && `${trays.kg1} de 1 kg + `}{trays.g90 > 0 && `${trays.g90} de 90 g + `}
                <strong className="text-xl">{trays.g150} de 150 g</strong>
                {trays.leftoverG > 0 && ` (sobran ${trays.leftoverG} g)`}
              </p>
              <p className="mt-2 text-sm text-stone-600 dark:text-stone-400">
                Si fuera un solo tamaño: {trays.only.g150} de 150 g · {trays.only.g90} de 90 g · {trays.only.kg1} de 1 kg
              </p>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
