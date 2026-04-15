"use client";

import { useState, useRef } from "react";
import { createClientAccount } from "@/app/admin/actions";

type CreatedClient = { userId: string; email: string; name: string };

const fieldCls =
  "w-full px-4 py-3 rounded-xl border border-[#eceef0] bg-white text-[#191c1e] text-sm focus:outline-none focus:ring-2 focus:ring-[#2f6fb8]/30 focus:border-[#2f6fb8] transition-all";
const labelCls = "block text-xs font-bold uppercase tracking-widest text-[#777683] mb-1.5";

type Suggestion = { siret: string; name: string; siren: string; ville?: string };

export default function CreateClientForm({
  onCreated,
}: {
  onCreated: (client: CreatedClient) => void;
}) {
  const [prenom, setPrenom] = useState("");
  const [nom, setNom] = useState("");
  const [email, setEmail] = useState("");
  const [accountType, setAccountType] = useState<"particulier" | "pro">("particulier");
  const [companyName, setCompanyName] = useState("");
  const [siret, setSiret] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Autocomplétion entreprise
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<Suggestion | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  function handleQueryChange(val: string) {
    setQuery(val);
    setSelected(null);
    setSuggestions([]);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (val.trim().length < 2) { setSearching(false); return; }
    setSearching(true);
    searchTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://recherche-entreprises.api.gouv.fr/search?q=${encodeURIComponent(val.trim())}&page=1&per_page=6`
        );
        const data = await res.json();
        const results: Suggestion[] = (data?.results ?? []).map((r: any) => ({
          siret: r.siege?.siret ?? "",
          name: r.nom_raison_sociale || r.nom_complet || "",
          siren: r.siren ?? "",
          ville: r.siege?.libelle_commune ?? "",
        })).filter((r: Suggestion) => r.name);
        setSuggestions(results);
      } catch { /* ignore */ }
      setSearching(false);
    }, 350);
  }

  function selectSuggestion(s: Suggestion) {
    setSelected(s);
    setCompanyName(s.name);
    setSiret(s.siret);
    setQuery(s.name);
    setSuggestions([]);
  }

  function clearSelection() {
    setSelected(null);
    setCompanyName("");
    setSiret("");
    setQuery("");
    setSuggestions([]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);
    try {
      const fullName = `${prenom.trim()} ${nom.trim()}`.trim();
      const result = await createClientAccount(
        email.trim(),
        fullName,
        accountType === "pro",
        companyName.trim() || null,
        siret.trim() || null,
      );
      setSuccess(`Compte créé — invitation envoyée à ${result.email}`);
      onCreated(result);
      setPrenom(""); setNom(""); setEmail("");
      setAccountType("particulier"); setCompanyName(""); setSiret("");
      setQuery(""); setSelected(null); setSuggestions([]);
    } catch (err: any) {
      setError(err.message ?? "Une erreur est survenue.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Prénom / Nom */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Prénom</label>
          <input
            type="text"
            value={prenom}
            onChange={(e) => setPrenom(e.target.value)}
            placeholder="Jean"
            required
            className={fieldCls}
          />
        </div>
        <div>
          <label className={labelCls}>Nom</label>
          <input
            type="text"
            value={nom}
            onChange={(e) => setNom(e.target.value)}
            placeholder="Dupont"
            required
            className={fieldCls}
          />
        </div>
      </div>

      {/* Email */}
      <div>
        <label className={labelCls}>Adresse email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="jean@exemple.fr"
          required
          className={fieldCls}
        />
      </div>

      {/* Type de compte */}
      <div>
        <label className={labelCls}>Type de compte</label>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setAccountType("particulier")}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all text-left ${
              accountType === "particulier"
                ? "border-[#2f6fb8] bg-[#2f6fb8]/5"
                : "border-[#eceef0] bg-white hover:border-[#2f6fb8]/30"
            }`}
          >
            <span
              className={`material-symbols-outlined text-[20px] ${accountType === "particulier" ? "text-[#2f6fb8]" : "text-[#9ca3af]"}`}
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              person
            </span>
            <div>
              <p className={`text-sm font-bold ${accountType === "particulier" ? "text-[#2f6fb8]" : "text-[#464652]"}`}>
                Particulier
              </p>
              <p className="text-[10px] text-[#9ca3af]">Compte personnel</p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setAccountType("pro")}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all text-left ${
              accountType === "pro"
                ? "border-[#2f6fb8] bg-[#2f6fb8]/5"
                : "border-[#eceef0] bg-white hover:border-[#2f6fb8]/30"
            }`}
          >
            <span
              className={`material-symbols-outlined text-[20px] ${accountType === "pro" ? "text-[#2f6fb8]" : "text-[#9ca3af]"}`}
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              business_center
            </span>
            <div>
              <p className={`text-sm font-bold ${accountType === "pro" ? "text-[#2f6fb8]" : "text-[#464652]"}`}>
                Professionnel
              </p>
              <p className="text-[10px] text-[#9ca3af]">Compte entreprise</p>
            </div>
          </button>
        </div>
      </div>

      {/* Champs Pro */}
      {accountType === "pro" && (
        <div className="bg-[#f8f9fb] rounded-2xl border border-[#eceef0] p-4 space-y-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#777683]">Informations professionnelles</p>

          {/* Société sélectionnée */}
          {selected ? (
            <div className="flex items-start justify-between gap-3 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
              <div className="flex items-start gap-2 min-w-0">
                <span className="material-symbols-outlined text-emerald-600 text-[18px] shrink-0 mt-0.5" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-[#191c1e] truncate">{selected.name}</p>
                  <p className="text-[10px] text-[#777683] font-mono mt-0.5">SIRET {selected.siret}</p>
                  {selected.ville && <p className="text-[10px] text-[#9ca3af]">{selected.ville}</p>}
                </div>
              </div>
              <button
                type="button"
                onClick={clearSelection}
                className="shrink-0 text-[10px] font-bold text-[#777683] hover:text-red-500 transition-colors underline underline-offset-2 mt-1"
              >
                Changer
              </button>
            </div>
          ) : (
            <div>
              <label className={labelCls}>
                Rechercher la société
                <span className="text-[#9ca3af] normal-case font-normal ml-1">(optionnel)</span>
              </label>
              <div className="relative" ref={dropdownRef}>
                <div className="relative">
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => handleQueryChange(e.target.value)}
                    placeholder="Nom de société, SIRET ou SIREN…"
                    autoComplete="off"
                    className={`${fieldCls} pr-10`}
                  />
                  {searching ? (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2 border-[#2f6fb8] border-t-transparent animate-spin" />
                  ) : query.length > 0 ? (
                    <button
                      type="button"
                      onClick={clearSelection}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9ca3af] hover:text-[#464652]"
                    >
                      <span className="material-symbols-outlined text-[18px]">close</span>
                    </button>
                  ) : (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-[#c7c5d4] text-[18px]">search</span>
                  )}
                </div>

                {/* Dropdown suggestions */}
                {suggestions.length > 0 && (
                  <ul className="absolute z-50 w-full mt-1 bg-white border border-[#eceef0] rounded-xl shadow-lg overflow-hidden">
                    {suggestions.map((s) => (
                      <li key={s.siret || s.siren}>
                        <button
                          type="button"
                          onClick={() => selectSuggestion(s)}
                          className="w-full text-left px-4 py-3 hover:bg-[#f8f9fb] transition-colors border-b border-[#f2f4f6] last:border-0 flex items-start gap-3"
                        >
                          <span className="material-symbols-outlined text-[#2f6fb8] text-[16px] shrink-0 mt-0.5" style={{ fontVariationSettings: "'FILL' 1" }}>business</span>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-[#191c1e] truncate">{s.name}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              {s.siret && <span className="text-[10px] text-[#777683] font-mono">SIRET {s.siret}</span>}
                              {s.ville && <span className="text-[10px] text-[#9ca3af]">· {s.ville}</span>}
                            </div>
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                {/* Aucun résultat */}
                {!searching && query.length >= 2 && suggestions.length === 0 && (
                  <p className="text-xs text-[#9ca3af] mt-1.5 flex items-center gap-1">
                    <span className="material-symbols-outlined text-[12px]">info</span>
                    Aucune entreprise trouvée — vous pouvez continuer sans société.
                  </p>
                )}
              </div>

              <p className="text-[10px] text-[#9ca3af] mt-1.5 flex items-center gap-1">
                <span className="material-symbols-outlined text-[12px]">info</span>
                Si non renseigné, le SIRET sera demandé au client lors de l'activation.
              </p>
            </div>
          )}
        </div>
      )}

      {error && (
        <p className="text-red-600 text-sm bg-red-50 px-4 py-3 rounded-xl border border-red-100 flex items-center gap-2">
          <span className="material-symbols-outlined text-[16px]">error</span>
          {error}
        </p>
      )}
      {success && (
        <p className="text-emerald-700 text-sm bg-emerald-50 px-4 py-3 rounded-xl border border-emerald-100 flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
          {success}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="flex items-center gap-2 px-6 py-3 bg-[#2f6fb8] text-white rounded-xl font-bold text-sm hover:bg-[#1a5a9e] transition-all disabled:opacity-60 shadow-md shadow-[#2f6fb8]/20 active:scale-95"
      >
        <span className="material-symbols-outlined text-[18px]">person_add</span>
        {loading ? "Création en cours…" : "Créer le compte & envoyer l'invitation"}
      </button>
    </form>
  );
}
