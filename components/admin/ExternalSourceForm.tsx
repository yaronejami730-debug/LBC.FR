"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  addExternalSource,
  searchUsersForSourcePicker,
} from "@/app/admin/actions";

type UserOption = {
  id: string;
  email: string;
  name: string;
  isPro: boolean;
  companyName: string | null;
};

/** Affichage : nom commercial pour les pros, nom perso sinon. */
function displayName(u: UserOption): string {
  return u.isPro && u.companyName ? u.companyName : u.name;
}

function UserPicker({
  selected,
  onSelect,
}: {
  selected: UserOption | null;
  onSelect: (u: UserOption | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserOption[]>([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement | null>(null);

  // Debounce 250 ms — évite un round-trip par frappe.
  useEffect(() => {
    if (selected || query.trim().length < 2) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const r = await searchUsersForSourcePicker(query);
        setResults(r);
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [query, selected]);

  // Ferme la dropdown au clic dehors.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  if (selected) {
    return (
      <div className="mt-1.5 flex items-center gap-2 px-3 py-2 rounded-xl border border-[#eceef0] bg-[#f7f9fb]">
        <span className="material-symbols-outlined text-[18px] text-[#2f6fb8]">
          {selected.isPro ? "storefront" : "person"}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-[#191c1e] truncate">
            {displayName(selected)}
          </p>
          <p className="text-[11px] text-[#777683] truncate">{selected.email}</p>
        </div>
        <button
          type="button"
          onClick={() => {
            onSelect(null);
            setQuery("");
            setResults([]);
          }}
          className="w-7 h-7 flex items-center justify-center rounded-lg text-[#777683] hover:bg-white hover:text-[#ba1a1a]"
          title="Changer de compte"
        >
          <span className="material-symbols-outlined text-[16px]">close</span>
        </button>
        {/* champ caché posté avec le formulaire */}
        <input type="hidden" name="ownerId" value={selected.id} />
      </div>
    );
  }

  return (
    <div className="relative mt-1.5" ref={boxRef}>
      <input
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder="Rechercher par email, nom ou société…"
        autoComplete="off"
        className="w-full px-4 py-2.5 rounded-xl border border-[#eceef0] text-sm focus:outline-none focus:ring-2 focus:ring-[#2f6fb8]/30"
      />

      {open && query.trim().length >= 2 && (
        <div className="absolute z-10 left-0 right-0 mt-1 bg-white border border-[#eceef0] rounded-xl shadow-lg max-h-64 overflow-y-auto">
          {searching && (
            <div className="px-4 py-3 text-xs text-[#777683]">Recherche…</div>
          )}
          {!searching && results.length === 0 && (
            <div className="px-4 py-3 text-xs text-[#777683]">Aucun compte trouvé.</div>
          )}
          {results.map((u) => (
            <button
              key={u.id}
              type="button"
              onClick={() => {
                onSelect(u);
                setOpen(false);
              }}
              className="w-full text-left px-4 py-2.5 hover:bg-[#f7f9fb] flex items-center gap-3"
            >
              <span className="material-symbols-outlined text-[18px] text-[#777683]">
                {u.isPro ? "storefront" : "person"}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[#191c1e] truncate">
                  {displayName(u)}
                </p>
                <p className="text-[11px] text-[#777683] truncate">{u.email}</p>
              </div>
              {u.isPro && (
                <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-[#e1e0ff] text-[#2f6fb8]">
                  Pro
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ExternalSourceForm() {
  const [selectedOwner, setSelectedOwner] = useState<UserOption | null>(null);
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const [labelTouched, setLabelTouched] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [ok, setOk] = useState(false);

  // Préremplit le libellé avec le nom du compte sélectionné (modifiable).
  useEffect(() => {
    if (selectedOwner && !labelTouched) {
      setLabel(displayName(selectedOwner));
    }
  }, [selectedOwner, labelTouched]);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setOk(false);
    if (!selectedOwner) {
      setError("Sélectionne un compte propriétaire.");
      return;
    }
    const formData = new FormData(e.currentTarget);
    const form = e.currentTarget;
    startTransition(async () => {
      try {
        await addExternalSource(formData);
        setOk(true);
        form.reset();
        setSelectedOwner(null);
        setLabel("");
        setUrl("");
        setLabelTouched(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur");
      }
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white rounded-2xl border border-[#eceef0] p-6 space-y-4"
    >
      <h2 className="font-bold text-[#191c1e]">Ajouter une source</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <span className="text-[10px] font-bold uppercase tracking-widest text-[#777683]">
            Compte propriétaire
          </span>
          <UserPicker selected={selectedOwner} onSelect={setSelectedOwner} />
        </div>

        <label className="block md:col-span-2">
          <span className="text-[10px] font-bold uppercase tracking-widest text-[#777683]">
            Libellé public
          </span>
          <input
            type="text"
            name="label"
            required
            value={label}
            onChange={(e) => {
              setLabel(e.target.value);
              setLabelTouched(true);
            }}
            placeholder="BSK Paris 17, Century 21 Marseille Prado…"
            className="w-full mt-1.5 px-4 py-2.5 rounded-xl border border-[#eceef0] text-sm focus:outline-none focus:ring-2 focus:ring-[#2f6fb8]/30"
          />
          <p className="text-[10px] text-[#777683] mt-1">
            Nom affiché aux utilisateurs sur les annonces importées.
          </p>
        </label>

        <label className="block md:col-span-2">
          <span className="text-[10px] font-bold uppercase tracking-widest text-[#777683]">
            URL source (agence / franchisé)
          </span>
          <input
            type="url"
            name="url"
            required
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://bskimmobilier.com/sylvie-mekil-8374"
            className="w-full mt-1.5 px-4 py-2.5 rounded-xl border border-[#eceef0] text-sm focus:outline-none focus:ring-2 focus:ring-[#2f6fb8]/30"
          />
          <p className="text-[10px] text-[#777683] mt-1">
            Le scraper crawle uniquement ce slug d&apos;agence — jamais le reste du domaine.
            Connecteur détecté automatiquement.
          </p>
        </label>
      </div>

      {error && (
        <p className="text-sm text-[#ba1a1a] bg-[#ffdad6] rounded-xl px-4 py-2.5">{error}</p>
      )}
      {ok && (
        <p className="text-sm text-emerald-700 bg-emerald-50 rounded-xl px-4 py-2.5">
          Source ajoutée.
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="inline-flex items-center gap-2 bg-[#2f6fb8] text-white text-sm font-bold px-5 py-2.5 rounded-xl hover:bg-[#255a96] disabled:opacity-50"
      >
        <span className="material-symbols-outlined text-[18px]">add</span>
        {isPending ? "Ajout en cours…" : "Ajouter la source"}
      </button>
    </form>
  );
}
