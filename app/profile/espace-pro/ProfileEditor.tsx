"use client";

import { useState } from "react";
import PrestationFields from "@/components/wellness/PrestationFields";
import { WELLNESS_FORMS, summarizeWellnessValues } from "@/lib/wellness/form-schema";

type Service = { section: string; label: string; durationMin: string; price: string };

type Initial = {
  name: string;
  slug: string | null;
  description: string;
  addressLine: string;
  city: string;
  postalCode: string;
  phone: string;
  website: string;
  isPublished: boolean;
  services: Service[];
};

const SUBCATEGORIES = Object.keys(WELLNESS_FORMS);

const input =
  "w-full bg-surface-container-low rounded-xl px-4 py-3 text-base outline-none focus:ring-2 focus:ring-primary/50 border border-transparent focus:border-primary/30";

/**
 * Éditeur de fiche établissement + carte de prestations.
 *
 * L'ajout d'une prestation passe par le même moteur que le dépôt d'annonce
 * (lib/wellness/form-schema) : on choisit une rubrique, le formulaire adapte
 * ses questions, et la ligne rejoint la carte. Un salon décrit ainsi trente
 * prestations sans publier trente annonces.
 */
export default function ProfileEditor({ initial }: { initial: Initial }) {
  const [fiche, setFiche] = useState(initial);
  const [services, setServices] = useState<Service[]>(initial.services);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  // Formulaire d'ajout — une rubrique, des champs qui s'adaptent, un prix.
  const [openAdd, setOpenAdd] = useState(false);
  const [sub, setSub] = useState(SUBCATEGORIES[0]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [price, setPrice] = useState("");

  const set = (k: keyof Initial, v: string | boolean) => setFiche((p) => ({ ...p, [k]: v }));

  function addService() {
    const label = summarizeWellnessValues(sub, values) || sub;
    const amount = parseFloat(price.replace(",", "."));
    if (!amount || amount < 0) return;
    setServices((prev) => [
      ...prev,
      { section: sub, label, durationMin: values.durationMin ?? "", price: String(amount) },
    ]);
    setValues({});
    setPrice("");
    setOpenAdd(false);
  }

  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/pro-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...fiche,
          services: services.map((s) => ({
            section: s.section,
            label: s.label,
            durationMin: s.durationMin ? parseInt(s.durationMin) : null,
            price: parseFloat(s.price),
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) setMessage({ ok: false, text: data.error ?? "Enregistrement impossible" });
      else
        setMessage({
          ok: true,
          text: `Fiche enregistrée · ${data.services} prestation${data.services > 1 ? "s" : ""} · /pro/${data.slug}`,
        });
    } catch {
      setMessage({ ok: false, text: "Erreur réseau, réessayez" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold font-['Manrope']">Mon espace professionnel</h1>
        <p className="text-sm text-outline mt-1">
          Une fiche, une carte. Vos prestations ne deviennent pas des annonces séparées.
        </p>
      </div>

      <section className="bg-white rounded-2xl border border-slate-100 p-6 space-y-4">
        <h2 className="text-[10px] font-bold text-primary uppercase tracking-widest">
          Établissement
        </h2>
        <input
          value={fiche.name}
          onChange={(e) => set("name", e.target.value)}
          placeholder="Nom de l'établissement"
          className={input}
        />
        <textarea
          value={fiche.description}
          onChange={(e) => set("description", e.target.value)}
          rows={4}
          placeholder="Présentation du salon"
          className={input + " resize-none"}
        />
        <input
          value={fiche.addressLine}
          onChange={(e) => set("addressLine", e.target.value)}
          placeholder="Adresse"
          className={input}
        />
        <div className="grid grid-cols-3 gap-3">
          <input
            value={fiche.postalCode}
            onChange={(e) => set("postalCode", e.target.value)}
            placeholder="Code postal"
            className={input}
          />
          <input
            value={fiche.city}
            onChange={(e) => set("city", e.target.value)}
            placeholder="Ville"
            className={input + " col-span-2"}
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input
            value={fiche.phone}
            onChange={(e) => set("phone", e.target.value)}
            placeholder="Téléphone"
            className={input}
          />
          <input
            value={fiche.website}
            onChange={(e) => set("website", e.target.value)}
            placeholder="Site web"
            className={input}
          />
        </div>
        <label className="flex items-center gap-2 text-sm font-semibold text-on-surface-variant">
          <input
            type="checkbox"
            checked={fiche.isPublished}
            onChange={(e) => set("isPublished", e.target.checked)}
            className="w-4 h-4 accent-[#2f6fb8]"
          />
          Fiche visible publiquement
        </label>
      </section>

      <section className="bg-white rounded-2xl border border-slate-100 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[10px] font-bold text-primary uppercase tracking-widest">
            Carte des prestations ({services.length})
          </h2>
          <button
            type="button"
            onClick={() => setOpenAdd((v) => !v)}
            className="inline-flex items-center gap-1.5 text-sm font-bold text-primary hover:underline"
          >
            <span className="material-symbols-outlined text-[18px]">
              {openAdd ? "close" : "add_circle"}
            </span>
            {openAdd ? "Annuler" : "Ajouter une prestation"}
          </button>
        </div>

        {openAdd && (
          <div className="rounded-xl bg-surface-container-low p-4 mb-4 space-y-4">
            <div>
              <label className="text-[10px] text-outline uppercase font-bold tracking-wider block mb-1.5">
                Rubrique
              </label>
              <div className="flex flex-wrap gap-2">
                {SUBCATEGORIES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => {
                      setSub(s);
                      setValues({});
                    }}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${
                      sub === s
                        ? "bg-primary text-white border-primary"
                        : "bg-white border-slate-200 text-slate-600 hover:border-primary/40"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <PrestationFields
              subcategory={sub}
              values={values}
              onChange={(id, v) => setValues((prev) => ({ ...prev, [id]: v }))}
              compact
            />

            <div>
              <label className="text-[10px] text-outline uppercase font-bold tracking-wider block mb-1.5">
                Prix
              </label>
              <div className="relative max-w-[160px]">
                <input
                  value={price}
                  onChange={(e) => setPrice(e.target.value.replace(/[^\d.,]/g, "").slice(0, 7))}
                  inputMode="decimal"
                  placeholder="60"
                  className={input + " pr-8 text-right"}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-outline">€</span>
              </div>
            </div>

            <button
              type="button"
              onClick={addService}
              disabled={!price.trim()}
              className="rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-white disabled:opacity-40"
            >
              Ajouter à ma carte
            </button>
          </div>
        )}

        {services.length === 0 ? (
          <p className="text-sm text-outline">Aucune prestation. Ajoutez la première ci-dessus.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {services.map((s, i) => (
              <li key={`${s.label}-${i}`} className="flex items-baseline gap-3 py-2.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-primary shrink-0 w-28 truncate">
                  {s.section}
                </span>
                <span className="font-semibold">{s.label}</span>
                {s.durationMin && (
                  <span className="text-xs text-outline shrink-0">{s.durationMin} min</span>
                )}
                <span className="flex-1 border-b border-dotted border-slate-200 translate-y-[-3px]" aria-hidden />
                <span className="font-extrabold text-primary shrink-0">
                  {parseFloat(s.price).toLocaleString("fr-FR")} €
                </span>
                <button
                  type="button"
                  onClick={() => setServices((prev) => prev.filter((_, idx) => idx !== i))}
                  aria-label="Retirer"
                  className="w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-outline hover:text-error"
                >
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {message && (
        <p
          className={`text-sm font-semibold rounded-xl px-4 py-3 ${
            message.ok ? "bg-emerald-50 text-emerald-800" : "bg-error-container text-on-error-container"
          }`}
        >
          {message.text}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={saving || fiche.name.trim().length < 2}
          className="rounded-full bg-primary px-6 py-3 text-sm font-bold text-white disabled:opacity-40"
        >
          {saving ? "Enregistrement…" : "Enregistrer ma fiche"}
        </button>
        {fiche.slug && (
          <a
            href={`/pro/${fiche.slug}`}
            target="_blank"
            rel="noreferrer"
            title="Voir ma fiche publique"
            className="text-sm font-bold text-primary hover:underline"
          >
            Voir ma fiche publique
          </a>
        )}
      </div>
    </div>
  );
}
