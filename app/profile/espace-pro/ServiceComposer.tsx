"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Ajout d'une ligne à la carte des prestations.
 *
 * L'ancien formulaire ne proposait que les rubriques « Beauté & Bien-être » —
 * massage, onglerie, épilation. Un coiffeur n'y trouvait rien, un VTC ou un
 * plombier encore moins : la carte était pensée pour une seule verticale.
 *
 * Ici, tout est saisissable et rien n'est imposé. Le catalogue professionnel
 * (2 200 prestations, 30 métiers) sert de **suggestion** : on tape trois
 * lettres, on choisit, la rubrique et l'intitulé se remplissent. On peut aussi
 * ne rien choisir et tout écrire à la main — c'est le même formulaire.
 */

const input =
  "w-full bg-white rounded-xl px-4 py-3 text-base outline-none focus:ring-2 focus:ring-primary/50 border border-slate-200 focus:border-primary/30";

export type DraftService = {
  section: string;
  label: string;
  durationMin: string;
  price: string;
  priceNote: string;
};

type Suggestion = { id: string; label: string; sub: string; cat: string };

const EMPTY: DraftService = { section: "", label: "", durationMin: "", price: "", priceNote: "" };

/** Mentions de tarif les plus courantes, toutes activités confondues. */
const PRICE_NOTES = ["", "à partir de", "sur devis", "par personne", "par heure"];

export default function ServiceComposer({
  onAdd,
  onCancel,
}: {
  onAdd: (service: DraftService) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<DraftService>(EMPTY);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Suggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const set = (k: keyof DraftService, v: string) => setDraft((p) => ({ ...p, [k]: v }));

  // Recherche débouncée : on ne suit pas la frappe touche par touche, et sous
  // trois caractères le catalogue renverrait tout et n'importe quoi.
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    const q = query.trim();
    if (q.length < 3) {
      setResults([]);
      return;
    }
    setSearching(true);
    timer.current = setTimeout(() => {
      fetch(`/api/taxonomy/pro/suggest?q=${encodeURIComponent(q)}`)
        .then((r) => r.json())
        .then((d: { results?: Suggestion[] }) => setResults((d.results ?? []).slice(0, 8)))
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }, 300);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [query]);

  function pick(s: Suggestion) {
    // La suggestion remplit, elle ne verrouille pas : les deux champs restent
    // modifiables ensuite. Un salon nomme ses prestations comme il l'entend.
    setDraft((p) => ({ ...p, section: p.section || s.sub, label: s.label }));
    setQuery("");
    setResults([]);
  }

  const ready = draft.label.trim().length > 1 && draft.price.trim().length > 0;

  return (
    <div className="rounded-xl bg-surface-container-low p-4 mb-4 space-y-4">
      {/* ── Recherche au catalogue ────────────────────────────────── */}
      <div>
        <label className="text-[10px] text-outline uppercase font-bold tracking-wider block mb-1.5">
          Chercher dans le catalogue
        </label>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="ex : balayage, coupe homme, massage, dépannage…"
          className={input}
        />
        {searching && <p className="text-[11px] text-outline mt-1">Recherche…</p>}
        {results.length > 0 && (
          <ul className="mt-2 rounded-xl border border-slate-200 bg-white divide-y divide-slate-100 overflow-hidden">
            {results.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => pick(r)}
                  className="w-full text-left px-3 py-2 hover:bg-surface-container-low"
                >
                  <span className="block text-sm font-semibold">{r.label}</span>
                  <span className="block text-[11px] text-outline">
                    {r.cat} · {r.sub}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="text-[11px] text-outline mt-1">
          Facultatif — vous pouvez tout saisir vous-même ci-dessous.
        </p>
      </div>

      {/* ── Saisie libre ──────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] text-outline uppercase font-bold tracking-wider block mb-1.5">
            Rubrique
          </label>
          <input
            value={draft.section}
            onChange={(e) => set("section", e.target.value)}
            placeholder="ex : Coupe, Couleur, Soins"
            className={input}
          />
        </div>
        <div>
          <label className="text-[10px] text-outline uppercase font-bold tracking-wider block mb-1.5">
            Intitulé *
          </label>
          <input
            value={draft.label}
            onChange={(e) => set("label", e.target.value)}
            placeholder="ex : Coupe femme + brushing"
            className={input}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="text-[10px] text-outline uppercase font-bold tracking-wider block mb-1.5">
            Durée (min)
          </label>
          <input
            value={draft.durationMin}
            onChange={(e) => set("durationMin", e.target.value.replace(/\D/g, "").slice(0, 3))}
            inputMode="numeric"
            placeholder="60"
            className={input}
          />
        </div>
        <div>
          <label className="text-[10px] text-outline uppercase font-bold tracking-wider block mb-1.5">
            Prix *
          </label>
          <div className="relative">
            <input
              value={draft.price}
              onChange={(e) => set("price", e.target.value.replace(/[^\d.,]/g, "").slice(0, 7))}
              inputMode="decimal"
              placeholder="55"
              className={input + " pr-8 text-right"}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-outline">€</span>
          </div>
        </div>
        <div>
          <label className="text-[10px] text-outline uppercase font-bold tracking-wider block mb-1.5">
            Mention
          </label>
          <select
            value={draft.priceNote}
            onChange={(e) => set("priceNote", e.target.value)}
            className={input}
          >
            {PRICE_NOTES.map((n) => (
              <option key={n} value={n}>
                {n === "" ? "Aucune" : n}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Sans durée ferme, aucun créneau n'est calculable : le dire ici évite
          qu'un salon s'étonne de ne pas voir la ligne dans la réservation. */}
      {!draft.durationMin && (
        <p className="text-[11px] text-outline">
          Sans durée, la prestation reste affichée sur la fiche mais ne pourra pas être réservée
          en ligne.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => {
            onAdd({ ...draft, section: draft.section.trim() || "Prestations" });
            setDraft(EMPTY);
            setQuery("");
          }}
          disabled={!ready}
          className="rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-white disabled:opacity-40"
        >
          Ajouter à ma carte
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full border border-slate-200 px-5 py-2.5 text-sm font-bold text-on-surface-variant"
        >
          Annuler
        </button>
      </div>
    </div>
  );
}
