"use client";

import { useState } from "react";

type Result = {
  status: string;
  categoryId: string | null;
  subcategory: string | null;
  categoryLabel: string | null;
  confidence: number;
  signals: { term: string; kind: string; weight: number }[];
  alternatives: { label: string; confidence: number }[];
};

/**
 * Banc d'essai d'un titre.
 *
 * Montre non seulement la décision, mais les signaux qui l'ont produite : sans
 * cela, un classement surprenant reste inexplicable, et on corrige à l'aveugle.
 */
export default function CategoryDebugger() {
  const [title, setTitle] = useState("Lit bébé évolutif blanc");
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);

  async function test() {
    setBusy(true);
    try {
      const res = await fetch("/api/category/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      const data = await res.json();
      setResult(data.result ?? null);
    } finally {
      setBusy(false);
    }
  }

  const TONE: Record<string, string> = {
    auto: "bg-emerald-50 text-emerald-700",
    suggested: "bg-[#e8f0fa] text-[#2f6fb8]",
    ambiguous: "bg-amber-50 text-amber-700",
    unknown: "bg-slate-100 text-slate-500",
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5">
      <h2 className="font-extrabold text-slate-900">Tester un titre</h2>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void test();
        }}
        className="mt-3 flex flex-wrap gap-2"
      >
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="flex-1 min-w-[260px] rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#2f6fb8]"
          placeholder="Peugeot 208 GT Line 2022"
        />
        <button
          type="submit"
          disabled={busy}
          className="rounded-full bg-[#2f6fb8] px-5 py-2 text-sm font-bold text-white disabled:opacity-50"
        >
          {busy ? "…" : "Analyser"}
        </button>
      </form>

      {result && (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <span className={`rounded-full px-3 py-1 text-xs font-bold ${TONE[result.status] ?? ""}`}>
              {result.status}
            </span>
            <span className="font-bold text-slate-900">
              {result.categoryLabel ?? "—"}
              {result.subcategory ? ` → ${result.subcategory}` : ""}
            </span>
            <span className="text-sm tabular-nums text-slate-500">
              confiance {Math.round(result.confidence * 1000) / 10} %
            </span>
          </div>

          {result.signals.length > 0 && (
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Signaux détectés</p>
              <ul className="mt-1 flex flex-wrap gap-1.5">
                {result.signals.map((s, i) => (
                  <li
                    key={i}
                    className="rounded-lg bg-slate-50 border border-slate-200 px-2.5 py-1 text-xs"
                    title={`poids ${s.weight}`}
                  >
                    <span className="font-mono font-bold">{s.term}</span>
                    <span className="text-slate-500"> · {s.kind}</span>
                    <span className="text-slate-400 tabular-nums"> {s.weight}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {result.alternatives.length > 0 && (
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Concurrents</p>
              <ol className="mt-1 space-y-0.5 text-sm">
                {result.alternatives.map((a, i) => (
                  <li key={i} className="flex justify-between gap-4">
                    <span>{a.label}</span>
                    <span className="tabular-nums text-slate-500">{Math.round(a.confidence * 1000) / 10} %</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
