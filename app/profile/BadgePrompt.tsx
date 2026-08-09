"use client";

import { useState } from "react";

/**
 * Proposition du badge de vérification, posée une fois le compte vérifié.
 *
 * Question fermée, deux boutons : le badge n'est pas imposé. La réponse « oui »
 * n'affiche rien tout de suite — le badge arrive après deux semaines
 * d'observation, et l'écran le dit pour éviter d'être pris pour un bug.
 */
export default function BadgePrompt({
  requestedAt,
  delayDays,
}: {
  requestedAt: string | null;
  delayDays: number;
}) {
  const [state, setState] = useState<"idle" | "requested" | "declined">(
    requestedAt ? "requested" : "idle",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function answer(accept: boolean) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/profile/verification-badge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accept }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error ?? "Action impossible");
      else setState(accept ? "requested" : "declined");
    } catch {
      setError("Erreur réseau, réessayez");
    } finally {
      setBusy(false);
    }
  }

  if (state === "declined") return null;

  if (state === "requested") {
    const since = requestedAt ? new Date(requestedAt) : new Date();
    const due = new Date(since.getTime() + delayDays * 24 * 60 * 60 * 1000);
    return (
      <div className="bg-white rounded-2xl p-5 shadow-[0_4px_24px_rgba(21,21,125,0.06)] mb-8 flex items-start gap-4">
        <div className="w-10 h-10 rounded-full bg-[#d5e3fc] flex items-center justify-center shrink-0">
          <span className="material-symbols-outlined text-[#2f6fb8]">hourglass_top</span>
        </div>
        <div>
          <p className="font-bold text-on-surface">Badge de vérification demandé</p>
          <p className="text-outline text-sm mt-0.5 leading-relaxed">
            Il s&apos;affichera sur votre profil et vos annonces à partir du{" "}
            {due.toLocaleDateString("fr-FR")}. Ce délai nous sert à vérifier que tout se passe bien
            sur votre compte.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl p-5 shadow-[0_4px_24px_rgba(21,21,125,0.06)] mb-8">
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
          <span
            className="material-symbols-outlined text-emerald-700"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            verified
          </span>
        </div>
        <div className="min-w-0">
          <p className="font-bold text-on-surface">Votre compte a bien été vérifié</p>
          <p className="text-outline text-sm mt-0.5 leading-relaxed">
            Souhaitez-vous afficher le <strong>badge de vérification</strong> sur votre profil et vos
            annonces&nbsp;? Il rassure les acheteurs. Il est accordé après {delayDays} jours, et peut
            être retiré à tout moment en cas de manquement aux règles.
          </p>
        </div>
      </div>

      {error && <p className="mt-3 text-sm font-semibold text-error">{error}</p>}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => answer(true)}
          className="rounded-full bg-primary px-6 py-2.5 text-sm font-bold text-white disabled:opacity-50"
        >
          Oui, afficher le badge
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => answer(false)}
          className="rounded-full border border-outline-variant/40 px-6 py-2.5 text-sm font-bold text-on-surface-variant disabled:opacity-50"
        >
          Non merci
        </button>
      </div>
    </div>
  );
}
