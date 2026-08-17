"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type PlacementRow = {
  key: string;
  label: string;
  surface: string;
  description: string;
  format: string;
  platform: string;
  model: string;
  priceCents: number;
  priced: boolean;
  isOpen: boolean;
  events30d: number;
};

const euros = (cents: number) =>
  (cents / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });

/**
 * Réglages de diffusion.
 *
 * Deux blocs, deux natures de décision. En haut, **comment** on choisit une
 * campagne : au hasard entre les éligibles, ou selon ce que le visiteur semble
 * chercher. En bas, **où** l'on vend, avec le prix et ce que chaque emplacement
 * a réellement produit sur trente jours — un emplacement ouvert qui n'a rien
 * servi n'est pas un tarif à revoir, c'est un inventaire à comprendre.
 */
export default function DiffusionSettings({
  rows,
  surfaces,
  smartEnabled,
  advertisers,
  threshold,
}: {
  rows: PlacementRow[];
  surfaces: string[];
  smartEnabled: boolean;
  advertisers: number;
  threshold: number;
}) {
  const router = useRouter();
  const [smart, setSmart] = useState(smartEnabled);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(payload: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/ads-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Enregistrement impossible");
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Enregistrement impossible");
    } finally {
      setBusy(false);
    }
  }

  const ready = advertisers >= threshold;

  return (
    <div className="space-y-8">
      {error && (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-[#ba1a1a]">{error}</p>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-extrabold text-slate-900">Mode de diffusion</h2>

        <label className="mt-4 flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={smart}
            disabled={busy}
            onChange={(e) => {
              setSmart(e.target.checked);
              void save({ smartSuggestions: e.target.checked });
            }}
            className="mt-1 h-4 w-4"
          />
          <span>
            <span className="block text-sm font-bold text-slate-800">Diffusion suggérée</span>
            <span className="mt-1 block text-sm leading-relaxed text-slate-500">
              Les campagnes qui l'ont accepté sont servies en priorité aux visiteurs dont
              l'intention correspond : la catégorie consultée, ce qu'ils ont cherché récemment,
              leurs intérêts déjà calculés, et les mots-clés de leur arrivée quand il y en a.
              Désactivé, le moteur tire au sort entre les campagnes éligibles — le fonctionnement
              actuel.
            </span>
          </span>
        </label>

        {/* Le seuil informe, il ne déclenche rien : une régie change de mode
            quand son exploitant le décide, pas quand un compteur franchit un
            chiffre. */}
        <p
          className={`mt-4 rounded-xl px-4 py-3 text-sm ${
            ready ? "bg-[#e8f5ee] text-[#0f6b45]" : "bg-slate-50 text-slate-500"
          }`}
        >
          {advertisers} annonceur{advertisers > 1 ? "s" : ""} avec une campagne active.{" "}
          {ready
            ? `Le seuil de ${threshold} est atteint : suggérer a maintenant du sens, il y a de quoi choisir.`
            : `En dessous de ${threshold}, suggérer revient à choisir le moins hors-sujet de trois publicités. La diffusion classique reste préférable.`}
        </p>
      </section>

      <section className="space-y-5">
        <h2 className="text-sm font-extrabold text-slate-900">Inventaire</h2>

        {surfaces.map((surface) => (
          <div key={surface}>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
              {surface}
            </p>
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              {rows
                .filter((r) => r.surface === surface)
                .map((r) => (
                  <div
                    key={r.key}
                    className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-4 py-3 last:border-0"
                  >
                    <div className="min-w-[220px] flex-1">
                      <p className="text-sm font-bold text-slate-800">{r.label}</p>
                      <p className="text-xs text-slate-400">{r.description}</p>
                      <p className="mt-0.5 text-[11px] text-slate-400">
                        {r.format} · {r.platform === "BOTH" ? "web et mobile" : r.platform.toLowerCase()}
                      </p>
                    </div>

                    <div className="w-28 text-right tabular-nums">
                      <p className="text-sm font-bold text-slate-800">
                        {r.priced ? `${euros(r.priceCents)} ${r.model}` : "—"}
                      </p>
                      {!r.priced && (
                        <p className="text-[11px] font-semibold text-[#ba1a1a]">Aucun tarif</p>
                      )}
                    </div>

                    <div className="w-24 text-right tabular-nums">
                      <p className="text-sm font-semibold text-slate-600">{r.events30d}</p>
                      <p className="text-[11px] text-slate-400">30 j</p>
                    </div>

                    <label className="flex w-28 items-center justify-end gap-2 text-xs font-bold text-slate-500">
                      <input
                        type="checkbox"
                        checked={r.isOpen}
                        disabled={busy || !r.priced}
                        onChange={(e) => void save({ placement: r.key, isOpen: e.target.checked })}
                        className="h-4 w-4"
                      />
                      {r.isOpen ? "Ouvert" : "Fermé"}
                    </label>
                  </div>
                ))}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
