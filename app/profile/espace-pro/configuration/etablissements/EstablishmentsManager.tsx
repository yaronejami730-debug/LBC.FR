"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import BusinessModelPicker from "../BusinessModelPicker";
import type { BusinessModelChoice } from "@/lib/pro/business-model";

export type ManagedEstablishment = {
  id: string;
  name: string;
  city: string | null;
  slug: string;
  isPublished: boolean;
};

const input =
  "w-full bg-surface-container-low rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/50 border border-transparent focus:border-primary/30";

/**
 * Liste des boutiques du compte, et ouverture d'une nouvelle.
 *
 * Le sélecteur de la barre de navigation sert à travailler dans une boutique ;
 * cet écran sert à les administrer. Ouvrir un deuxième point de vente était
 * jusqu'ici réservé à l'API — c'est-à-dire, en pratique, impossible.
 */
export default function EstablishmentsManager({
  establishments,
  activeId,
}: {
  establishments: ManagedEstablishment[];
  activeId: string;
}) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  // « Que propose principalement votre entreprise ? » — la réponse décide des
  // sections que le professionnel verra. Non répondue, on retombe sur le preset
  // de son métier : personne n'est bloqué par une question.
  const [businessModel, setBusinessModel] = useState<BusinessModelChoice | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function select(id: string) {
    document.cookie = `activeEstablishment=${id}; path=/; max-age=${60 * 60 * 24 * 180}; samesite=lax`;
    router.push(`/profile/espace-pro/configuration?etab=${id}`);
    router.refresh();
  }

  async function create(form: HTMLFormElement) {
    const fd = new FormData(form);
    const name = String(fd.get("name") ?? "").trim();
    if (!name) return;

    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/pro/establishments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          city: String(fd.get("city") ?? ""),
          postalCode: String(fd.get("postalCode") ?? ""),
          addressLine: String(fd.get("addressLine") ?? ""),
          // Recopier une boutique existante évite de ressaisir la carte des
          // prestations et les règles de réservation ; l'adresse, les photos et
          // l'équipe restent vides, ce sont elles qui distinguent deux points
          // de vente.
          copyFrom: String(fd.get("copyFrom") ?? "") || undefined,
          businessModel: businessModel ?? undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Création impossible");
        return;
      }
      form.reset();
      setBusinessModel(null);
      setCreating(false);
      // La nouvelle boutique naît hors ligne : on l'ouvre directement sur sa
      // fiche, il reste l'adresse et l'équipe à renseigner.
      select(data.establishment.id);
    } catch {
      setError("Erreur réseau, réessayez.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      {error && (
        <div className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      <section className="bg-white rounded-2xl border border-slate-100 p-5">
        <h2 className="text-base font-extrabold font-['Manrope'] mb-3">Mes établissements</h2>
        <ul className="space-y-2">
          {establishments.map((e) => (
            <li
              key={e.id}
              className={`rounded-xl border px-4 py-3 flex items-center gap-3 ${
                e.id === activeId ? "border-primary bg-primary/5" : "border-slate-100"
              }`}
            >
              <span
                aria-hidden
                className={`w-2 h-2 rounded-full shrink-0 ${e.isPublished ? "bg-emerald-500" : "bg-slate-300"}`}
              />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold truncate">{e.name}</span>
                <span className="block text-xs text-outline">
                  {e.city ?? "Adresse à compléter"}
                  {e.isPublished ? "" : " · hors ligne"}
                  {e.id === activeId ? " · en cours" : ""}
                </span>
              </span>
              {e.id === activeId ? (
                <span className="text-xs font-bold text-primary shrink-0">Sélectionné</span>
              ) : (
                <button
                  type="button"
                  onClick={() => select(e.id)}
                  title={`Travailler sur ${e.name}`}
                  className="text-xs font-bold text-outline hover:text-primary shrink-0"
                >
                  Ouvrir
                </button>
              )}
            </li>
          ))}
        </ul>

        {!creating && (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="mt-4 rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-white"
          >
            + Ouvrir un établissement
          </button>
        )}
      </section>

      {creating && (
        <section className="bg-white rounded-2xl border border-slate-100 p-5">
          <h2 className="text-base font-extrabold font-['Manrope'] mb-1">Nouvel établissement</h2>
          <p className="text-xs text-outline mb-4">
            Il naît hors ligne : renseignez son adresse, ses horaires et son équipe avant de le publier.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void create(e.currentTarget);
            }}
            className="space-y-3"
          >
            <label className="block text-xs font-semibold text-outline">
              Nom de l&apos;établissement
              <input name="name" required placeholder="Salon Neuilly" className={input} />
            </label>
            <label className="block text-xs font-semibold text-outline">
              Adresse
              <input name="addressLine" placeholder="12 rue de Longchamp" className={input} />
            </label>
            <div className="grid sm:grid-cols-2 gap-3">
              <label className="block text-xs font-semibold text-outline">
                Ville
                <input name="city" placeholder="Neuilly-sur-Seine" className={input} />
              </label>
              <label className="block text-xs font-semibold text-outline">
                Code postal
                <input name="postalCode" placeholder="92200" className={input} />
              </label>
            </div>
            <label className="block text-xs font-semibold text-outline">
              Reprendre la carte d&apos;un établissement existant
              <select name="copyFrom" defaultValue={activeId} className={input}>
                <option value="">Partir d&apos;une fiche vide</option>
                {establishments.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
            </label>

            {/* Posée seulement pour une fiche neuve : recopier un établissement
                existant reprend déjà ses réglages, redemander l'activité
                reviendrait à faire choisir deux fois la même chose. */}
            <div className="pt-2">
              <BusinessModelPicker value={businessModel} onChange={setBusinessModel} />
            </div>

            <div className="flex items-center gap-3 pt-1">
              <button
                type="submit"
                disabled={busy}
                className="rounded-full bg-primary px-6 py-2.5 text-sm font-bold text-white disabled:opacity-50"
              >
                {busy ? "Création…" : "Créer"}
              </button>
              <button
                type="button"
                onClick={() => setCreating(false)}
                className="text-sm font-bold text-outline"
              >
                Annuler
              </button>
            </div>
          </form>
        </section>
      )}
    </div>
  );
}
