"use client";

/**
 * Panneau de simulation.
 *
 * Montre, pour une catégorie, qui recevrait quoi et pourquoi — avant qu'un
 * seul email ne parte. Les lignes écartées sont affichées au même titre que
 * les retenues : régler un seuil sans voir ce qu'il exclut revient à le régler
 * au hasard.
 */

import { useState, useTransition } from "react";
import { simulateCampaign, type SimulationSummary } from "./actions";

type CategoryOption = { id: string; label: string; freshCount: number };

export default function SimulationPanel({ categories }: { categories: CategoryOption[] }) {
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const [result, setResult] = useState<SimulationSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const run = () => {
    setError(null);
    startTransition(async () => {
      try {
        setResult(await simulateCampaign(categoryId));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Simulation impossible");
      }
    });
  };

  return (
    <div className="bg-white border border-[#eceef0] rounded-xl p-5 space-y-4">
      <div>
        <h2 className="font-bold text-[#191c1e]">Simulation (dry run)</h2>
        <p className="text-sm text-[#777683] mt-1">
          Calcule la campagne sans rien envoyer. Chaque ligne indique le score, la
          distance et la raison d&apos;une exclusion.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className="border border-[#eceef0] rounded-lg px-3 py-2 text-sm bg-white"
        >
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label} — {c.freshCount} annonce{c.freshCount > 1 ? "s" : ""} récente
              {c.freshCount > 1 ? "s" : ""}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={run}
          disabled={pending || !categoryId}
          className="px-4 py-2 rounded-lg bg-[#191c1e] text-white text-sm font-semibold disabled:opacity-50"
        >
          {pending ? "Calcul en cours…" : "Lancer la simulation"}
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {result && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Stat label="Annonces" value={result.listingCount} />
            <Stat label="Comptes examinés" value={result.candidateUsers} />
            <Stat label="Comptes ciblés" value={result.targetedUsers} />
            <Stat label="Couples notés" value={result.lines.length} />
          </div>

          {Object.keys(result.exclusions).length > 0 && (
            <div>
              <h3 className="text-xs uppercase text-[#5a5b6e] font-semibold mb-2">
                Motifs d&apos;exclusion
              </h3>
              <div className="flex flex-wrap gap-2">
                {Object.entries(result.exclusions)
                  .sort((a, b) => b[1] - a[1])
                  .map(([reason, count]) => (
                    <span
                      key={reason}
                      className="px-2.5 py-1 rounded-full bg-[#f7f7fb] text-xs text-[#5a5b6e]"
                    >
                      {reason} · {count}
                    </span>
                  ))}
              </div>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#f7f7fb] text-[#5a5b6e] text-xs uppercase">
                <tr>
                  <th className="text-left px-3 py-2">Compte</th>
                  <th className="text-left px-3 py-2">Annonce</th>
                  <th className="text-right px-3 py-2">Distance</th>
                  <th className="text-right px-3 py-2">Catégorie</th>
                  <th className="text-right px-3 py-2">Zone</th>
                  <th className="text-right px-3 py-2">Score</th>
                  <th className="text-left px-3 py-2">Position</th>
                  <th className="text-left px-3 py-2">Décision</th>
                </tr>
              </thead>
              <tbody>
                {result.lines.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-3 py-6 text-center text-[#777683]">
                      Aucun couple à afficher — aucune annonce localisée ou aucun compte proche.
                    </td>
                  </tr>
                )}
                {result.lines.map((line) => (
                  <tr key={`${line.userId}-${line.listingId}`} className="border-t border-[#eceef0]">
                    <td className="px-3 py-2 text-xs text-[#777683]">{line.email}</td>
                    <td className="px-3 py-2 text-[#191c1e] max-w-[220px] truncate">
                      {line.listingTitle}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {line.distanceKm.toFixed(1)} km
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{line.categoryScore}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{line.locationScore}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-semibold">{line.score}</td>
                    <td className="px-3 py-2 text-xs">
                      <span
                        className={`px-2 py-0.5 rounded-full ${
                          line.certainty === "CERTAIN"
                            ? "bg-blue-50 text-blue-700"
                            : "bg-amber-50 text-amber-700"
                        }`}
                      >
                        {line.certainty === "CERTAIN" ? "certaine" : "estimée"}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {line.decision === "RETENUE" ? (
                        <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-800 font-semibold">
                          retenue
                        </span>
                      ) : (
                        <span className="text-[#777683]">{line.reason ?? "écartée"}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-[#f7f9fb] rounded-lg px-3 py-2">
      <div className="text-xs text-[#777683]">{label}</div>
      <div className="text-lg font-bold text-[#191c1e] tabular-nums">{value}</div>
    </div>
  );
}
