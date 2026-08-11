"use client";

import { useState } from "react";
import Link from "next/link";
import { Toggle } from "@/components/ui/Toggle";

/**
 * Interrupteur « en ligne / hors ligne » de la fiche publique.
 *
 * Il vit en haut de l'espace pro, au-dessus du formulaire, parce qu'il ne
 * répond pas à la même question : le formulaire sert à décrire l'établissement,
 * celui-ci à décider si le public le voit maintenant. Confondre les deux
 * obligeait à réenregistrer toute la carte pour fermer la vitrine deux jours.
 *
 * L'adresse publique est affichée en clair et reste la même dans les deux
 * états : c'est elle qu'on imprime sur une carte de visite, elle ne doit jamais
 * devenir un 404.
 */
export default function VisibilitySwitch({
  slug,
  name,
  initial,
  establishmentId,
  canToggle,
}: {
  slug: string;
  name: string;
  initial: boolean;
  establishmentId: string;
  /** Un MANAGER tient l'agenda, il n'éteint pas la boutique. */
  canToggle: boolean;
}) {
  const [isPublished, setIsPublished] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const publicUrl = `/pro/${slug}`;

  async function toggle() {
    if (saving || !canToggle) return;
    const next = !isPublished;
    setSaving(true);
    setError(null);
    // Bascule optimiste : le geste doit répondre tout de suite. En cas d'échec
    // on revient à l'état réel plutôt que de laisser croire à une fermeture.
    setIsPublished(next);
    try {
      const res = await fetch("/api/pro-profile/visibility", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublished: next, establishmentId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setIsPublished(!next);
        setError(data.error ?? "Modification impossible");
      }
    } catch {
      setIsPublished(!next);
      setError("Erreur réseau, réessayez");
    } finally {
      setSaving(false);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${publicUrl}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Copie impossible, sélectionnez le lien à la main");
    }
  }

  return (
    <section className="bg-white rounded-2xl border border-slate-100 p-5 mb-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span
              aria-hidden
              className={`w-2 h-2 rounded-full ${isPublished ? "bg-emerald-500" : "bg-slate-300"}`}
            />
            <h2 className="text-base font-extrabold font-['Manrope']">
              {isPublished ? "Fiche en ligne" : "Fiche hors ligne"}
            </h2>
          </div>
          <p className="text-sm text-outline mt-1 leading-relaxed">
            {isPublished
              ? "Votre fiche est consultable et réservable par vos clients."
              : `Les visiteurs voient « ${name} met à jour sa fiche ». Les réservations en ligne sont fermées, le lien reste valable.`}
          </p>
        </div>

        <Toggle
          checked={isPublished}
          onChange={toggle}
          size="lg"
          tone="emerald"
          loading={saving}
          disabled={!canToggle}
          label={isPublished ? "Mettre la fiche hors ligne" : "Mettre la fiche en ligne"}
          title={
            canToggle
              ? isPublished
                ? "Mettre hors ligne"
                : "Mettre en ligne"
              : "Réservé au responsable de l'établissement"
          }
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Link
          href={publicUrl}
          title={`Voir la fiche publique de ${name}`}
          className="inline-flex items-center gap-1.5 rounded-full bg-surface-container-low px-3.5 py-2 text-sm font-semibold text-on-surface-variant hover:bg-slate-100"
        >
          <span className="material-symbols-outlined text-[18px]">open_in_new</span>
          Voir la fiche
        </Link>
        <button
          type="button"
          onClick={copy}
          title="Copier le lien public"
          className="inline-flex items-center gap-1.5 rounded-full bg-surface-container-low px-3.5 py-2 text-sm font-semibold text-on-surface-variant hover:bg-slate-100"
        >
          <span className="material-symbols-outlined text-[18px]">
            {copied ? "check" : "link"}
          </span>
          {copied ? "Lien copié" : "Copier le lien"}
        </button>
        <span className="text-xs text-outline truncate">deal&amp;co{publicUrl}</span>
      </div>

      {error && <p className="mt-3 text-sm font-semibold text-red-600">{error}</p>}
    </section>
  );
}
