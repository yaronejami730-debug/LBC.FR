"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CAMPAIGN_STATUSES, objectiveLabel, placementLabel } from "@/lib/ads/placements";

export type ModeratedCampaign = {
  id: string;
  name: string;
  objective: string;
  status: string;
  startAt: string;
  endAt: string;
  dailyBudgetCents: number;
  totalBudgetCents: number;
  spentCents: number;
  reviewNote: string | null;
  advertiser: string;
  email: string;
  zones: { label: string; radiusKm: number }[];
  placements: string[];
  ad: {
    title: string;
    description: string;
    imageUrl: string;
    ctaLabel: string;
    destinationUrl: string | null;
  } | null;
};

const euros = (cents: number) =>
  (cents / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });

const day = (iso: string) =>
  new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });

const STATUS_TONE: Record<string, string> = {
  ACTIVE: "bg-emerald-50 text-emerald-700",
  SCHEDULED: "bg-[#e8f0fa] text-[#2f6fb8]",
  PENDING_REVIEW: "bg-amber-50 text-amber-700",
  REJECTED: "bg-[#fbe6e4] text-[#ba1a1a]",
  PAUSED: "bg-slate-100 text-slate-600",
  ENDED: "bg-slate-100 text-slate-600",
  DRAFT: "bg-slate-100 text-slate-500",
};

/**
 * Décision de modération.
 *
 * La publicité est montrée telle que le visiteur la verra : juger une campagne
 * sur une ligne de tableau, c'est juger un titre, pas une publicité.
 */
export default function CampaignModeration({
  pending,
  others,
}: {
  pending: ModeratedCampaign[];
  others: ModeratedCampaign[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function decide(id: string, approve: boolean) {
    setBusy(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/campaigns/${id}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approve, note: approve ? null : note }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Décision impossible");
        return;
      }
      setRejecting(null);
      setNote("");
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-8">
      {error && (
        <p className="rounded-xl bg-[#fbe6e4] px-4 py-3 text-sm font-semibold text-[#ba1a1a]">{error}</p>
      )}

      <section className="space-y-4">
        {pending.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center">
            <p className="font-bold text-slate-900">Rien à modérer</p>
            <p className="text-sm text-slate-500 mt-1">
              Les campagnes soumises par les annonceurs apparaîtront ici.
            </p>
          </div>
        ) : (
          pending.map((c) => (
            <article key={c.id} className="rounded-2xl border-2 border-amber-200 bg-white overflow-hidden">
              <div className="grid md:grid-cols-[280px_minmax(0,1fr)]">
                {/* La publicité, telle qu'elle sera vue. */}
                <div className="bg-slate-50 p-4 border-b md:border-b-0 md:border-r border-slate-200">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                    Aperçu
                  </p>
                  {c.ad ? (
                    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={c.ad.imageUrl}
                        alt=""
                        className="w-full h-32 object-cover bg-slate-100"
                      />
                      <div className="p-3">
                        <p className="font-bold text-sm text-slate-900">{c.ad.title}</p>
                        <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{c.ad.description}</p>
                        <p className="mt-2 inline-block rounded-full bg-[#2f6fb8] px-3 py-1 text-[11px] font-bold text-white">
                          {c.ad.ctaLabel}
                        </p>
                        <p className="mt-2 text-[10px] text-slate-400 truncate">
                          {c.ad.destinationUrl ?? "annonce Deal&Co"}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">Aucun créatif.</p>
                  )}
                </div>

                <div className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="font-extrabold text-slate-900">{c.name}</h2>
                      <p className="text-xs text-slate-500">
                        {c.advertiser} · {c.email}
                      </p>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${STATUS_TONE[c.status]}`}>
                      {CAMPAIGN_STATUSES[c.status as keyof typeof CAMPAIGN_STATUSES] ?? c.status}
                    </span>
                  </div>

                  <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                    <div>
                      <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Objectif</dt>
                      <dd>{objectiveLabel(c.objective)}</dd>
                    </div>
                    <div>
                      <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Période</dt>
                      <dd>{day(c.startAt)} → {day(c.endAt)}</dd>
                    </div>
                    <div>
                      <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Budget</dt>
                      <dd className="tabular-nums">
                        {euros(c.dailyBudgetCents)}/jour · {euros(c.totalBudgetCents)} au total
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Emplacements</dt>
                      <dd>{c.placements.map(placementLabel).join(", ")}</dd>
                    </div>
                    <div className="col-span-2">
                      <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Diffusion</dt>
                      <dd>
                        {c.zones.length === 0
                          ? "France entière"
                          : c.zones
                              .map((z) => (z.radiusKm > 0 ? `${z.label} + ${z.radiusKm} km` : z.label))
                              .join(" · ")}
                      </dd>
                    </div>
                  </dl>

                  {rejecting === c.id ? (
                    <div className="mt-4 space-y-2">
                      <textarea
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        rows={2}
                        placeholder="Motif du refus, envoyé tel quel à l'annonceur."
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#ba1a1a] resize-none"
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => decide(c.id, false)}
                          disabled={busy === c.id || !note.trim()}
                          className="rounded-lg bg-[#ba1a1a] px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
                        >
                          {busy === c.id ? "…" : "Confirmer le refus"}
                        </button>
                        <button
                          type="button"
                          onClick={() => { setRejecting(null); setNote(""); }}
                          className="text-xs font-bold text-slate-500"
                        >
                          Annuler
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => decide(c.id, true)}
                        disabled={busy === c.id}
                        className="rounded-full bg-emerald-600 px-5 py-2 text-xs font-bold text-white disabled:opacity-50"
                      >
                        {busy === c.id ? "…" : "Valider et diffuser"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setRejecting(c.id)}
                        className="rounded-full bg-[#fbe6e4] px-5 py-2 text-xs font-bold text-[#ba1a1a]"
                      >
                        Refuser
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </article>
          ))
        )}
      </section>

      {others.length > 0 && (
        <section>
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-3">
            Toutes les campagnes
          </h2>
          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {["Campagne", "Annonceur", "Statut", "Période", "Budget", "Dépensé"].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {others.map((c) => (
                  <tr key={c.id}>
                    <td className="px-4 py-3 font-bold text-slate-900">{c.name}</td>
                    <td className="px-4 py-3 text-slate-500">{c.advertiser}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${STATUS_TONE[c.status] ?? ""}`}>
                        {CAMPAIGN_STATUSES[c.status as keyof typeof CAMPAIGN_STATUSES] ?? c.status}
                      </span>
                      {c.reviewNote && (
                        <span className="block text-[11px] text-slate-400 mt-0.5 line-clamp-1">
                          {c.reviewNote}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                      {day(c.startAt)} → {day(c.endAt)}
                    </td>
                    <td className="px-4 py-3 tabular-nums">{euros(c.totalBudgetCents)}</td>
                    <td className="px-4 py-3 tabular-nums">{euros(c.spentCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
