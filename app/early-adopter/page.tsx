"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";

type CompanyResult = {
  siret: string | null;
  siren: string | null;
  companyName: string;
  ville: string;
  activite: string;
};

export default function EarlyAdopterPage() {
  const [companyQuery, setCompanyQuery] = useState("");
  const [suggestions, setSuggestions] = useState<CompanyResult[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<CompanyResult | null>(null);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "full" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [position, setPosition] = useState<number | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Autocomplete
  useEffect(() => {
    if (selectedCompany) return;
    if (companyQuery.length < 2) { setSuggestions([]); return; }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoadingSuggestions(true);
      try {
        const res = await fetch(`/api/company-search?q=${encodeURIComponent(companyQuery)}`);
        const data = await res.json();
        setSuggestions(data.results ?? []);
      } catch {
        setSuggestions([]);
      } finally {
        setLoadingSuggestions(false);
      }
    }, 300);
  }, [companyQuery, selectedCompany]);

  // Fermer dropdown si clic extérieur
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setSuggestions([]);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function selectCompany(c: CompanyResult) {
    setSelectedCompany(c);
    setCompanyQuery(c.companyName);
    setSuggestions([]);
  }

  function resetCompany() {
    setSelectedCompany(null);
    setCompanyQuery("");
    setSuggestions([]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedCompany && !companyQuery.trim()) return;

    setStatus("loading");
    setErrorMsg("");

    try {
      const res = await fetch("/api/early-adopter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: selectedCompany?.companyName ?? companyQuery.trim(),
          siret: selectedCompany?.siret ?? null,
          managerFirstName: firstName.trim(),
          email: email.trim(),
        }),
      });
      const data = await res.json();

      if (res.status === 410) { setStatus("full"); return; }
      if (!res.ok) { setErrorMsg(data.error ?? "Erreur lors de l'inscription"); setStatus("error"); return; }

      setPosition(data.position);
      setStatus("success");
    } catch {
      setErrorMsg("Impossible de joindre le serveur.");
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <div className="min-h-screen bg-[#f7f9fb] flex items-center justify-center px-4 py-16">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="w-20 h-20 rounded-full bg-[#fbbf24]/20 flex items-center justify-center mx-auto">
            <span className="text-4xl">🎯</span>
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-[#191c1e]">
              Vous êtes pré-inscrit !
            </h1>
            {position && (
              <p className="text-[#2f6fb8] font-black text-lg mt-1">
                Place n°{position} / 50
              </p>
            )}
            <p className="text-[#777683] text-sm mt-3 leading-relaxed">
              Bienvenue parmi nos <strong className="text-[#191c1e]">premiers partenaires professionnels</strong>.
              Dès votre inscription sur Deal&nbsp;&amp;&nbsp;Co avec cette adresse email,
              vous bénéficierez automatiquement de <strong className="text-[#191c1e]">−50% pendant 3 ans</strong> sur
              tous nos espaces publicitaires.
            </p>
          </div>
          <Link
            href="/register"
            className="inline-block bg-[#2f6fb8] text-white font-bold px-8 py-4 rounded-full hover:bg-[#2563a8] transition-all"
          >
            Créer mon compte maintenant →
          </Link>
          <p className="text-xs text-[#b0b3ba]">
            Vous recevrez une confirmation par email très prochainement.
          </p>
        </div>
      </div>
    );
  }

  if (status === "full") {
    return (
      <div className="min-h-screen bg-[#f7f9fb] flex items-center justify-center px-4 py-16">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="text-5xl">😕</div>
          <h1 className="text-2xl font-extrabold text-[#191c1e]">Les 50 places sont complètes</h1>
          <p className="text-[#777683] text-sm">
            Toutes les places fondateurs sont prises. Inscrivez-vous quand même — nous annoncerons de nouvelles offres prochainement.
          </p>
          <Link href="/register" className="inline-block bg-[#2f6fb8] text-white font-bold px-8 py-4 rounded-full">
            Créer mon compte
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f9fb]">
      {/* Header */}
      <header className="bg-white border-b border-[#eceef0] px-6 py-4 flex items-center justify-between">
        <Link href="/">
          <Image src="/logo-dealco.png" alt="Deal & Co" width={120} height={38} className="object-contain" />
        </Link>
        <Link href="/register" className="text-sm font-bold text-[#2f6fb8] hover:underline">
          Créer un compte →
        </Link>
      </header>

      <div className="max-w-lg mx-auto px-4 py-12 space-y-8">

        {/* Hero */}
        <div className="text-center space-y-3">
          <span className="inline-block bg-[#fbbf24]/20 text-[#b45309] text-xs font-black uppercase tracking-widest px-4 py-1.5 rounded-full">
            Offre fondateurs — 50 places seulement
          </span>
          <h1 className="text-3xl font-extrabold text-[#191c1e] leading-tight">
            −50% sur nos publicités<br/>pendant&nbsp;3&nbsp;ans
          </h1>
          <p className="text-[#777683] text-sm leading-relaxed">
            Deal&nbsp;&amp;&nbsp;Co est la marketplace locale <strong className="text-[#191c1e]">100% gratuite</strong> pour publier vos annonces.
            Notre modèle : nous nous rémunérons uniquement via des <strong className="text-[#191c1e]">espaces publicitaires</strong>.
            En rejoignant nos 50 premiers partenaires pros, vous obtenez <strong className="text-[#191c1e]">−50% pendant 3 ans</strong> sur tous nos forfaits pub.
          </p>
        </div>

        {/* Avantages */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { icon: "money_off", label: "Annonces\ngratuit à vie", color: "text-emerald-600 bg-emerald-50" },
            { icon: "campaign", label: "Pub −50%\npendant 3 ans", color: "text-[#2f6fb8] bg-[#2f6fb8]/10" },
            { icon: "verified", label: "Badge Pro\nvérifié", color: "text-amber-600 bg-amber-50" },
          ].map(({ icon, label, color }) => (
            <div key={icon} className="bg-white rounded-2xl border border-[#eceef0] p-4 text-center space-y-2">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center mx-auto ${color}`}>
                <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>{icon}</span>
              </div>
              <p className="text-xs font-bold text-[#191c1e] leading-tight whitespace-pre-line">{label}</p>
            </div>
          ))}
        </div>

        {/* Formulaire */}
        <div className="bg-white rounded-2xl border border-[#eceef0] p-6 shadow-sm">
          <h2 className="font-extrabold text-[#191c1e] mb-1">Réservez votre place</h2>
          <p className="text-xs text-[#777683] mb-5">Aucun paiement requis. Juste votre société et votre email.</p>

          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Société avec autocomplete */}
            <div className="space-y-1.5">
              <label className="block text-xs font-black uppercase tracking-widest text-[#777683]">
                Nom de la société
              </label>
              <div ref={dropdownRef} className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-[18px] text-[#777683]">
                  store
                </span>
                <input
                  type="text"
                  value={companyQuery}
                  onChange={(e) => { setCompanyQuery(e.target.value); setSelectedCompany(null); }}
                  placeholder="Rechercher votre société…"
                  required
                  disabled={status === "loading"}
                  className="w-full pl-11 pr-10 py-3.5 rounded-xl border border-[#eceef0] bg-[#f7f9fb] text-[#191c1e] text-sm placeholder:text-[#b0b3ba] focus:outline-none focus:ring-2 focus:ring-[#2f6fb8]/30 focus:border-[#2f6fb8] transition"
                />
                {/* Indicateurs */}
                {loadingSuggestions && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <div className="w-4 h-4 border-2 border-[#2f6fb8] border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
                {selectedCompany && !loadingSuggestions && (
                  <button type="button" onClick={resetCompany} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#777683] hover:text-[#191c1e]">
                    <span className="material-symbols-outlined text-[18px]">close</span>
                  </button>
                )}

                {/* Dropdown suggestions */}
                {suggestions.length > 0 && !selectedCompany && (
                  <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white rounded-xl border border-[#eceef0] shadow-xl overflow-hidden">
                    {suggestions.map((s, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => selectCompany(s)}
                        className="w-full flex items-start gap-3 px-4 py-3 hover:bg-[#f7f9fb] transition-colors text-left border-b border-[#f2f4f6] last:border-0"
                      >
                        <span className="material-symbols-outlined text-[18px] text-[#2f6fb8] flex-shrink-0 mt-0.5" style={{ fontVariationSettings: "'FILL' 1" }}>
                          store
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-[#191c1e] truncate">{s.companyName}</p>
                          <p className="text-xs text-[#777683] truncate">
                            {[s.ville, s.activite].filter(Boolean).join(" · ")}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Confirmation société sélectionnée */}
              {selectedCompany && (
                <div className="flex items-center gap-2 bg-[#d5e3fc]/40 border border-[#d5e3fc] rounded-xl px-4 py-2.5">
                  <span className="material-symbols-outlined text-[18px] text-[#2f6fb8]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-black text-[#2f6fb8] uppercase tracking-wider">Société trouvée</p>
                    <p className="text-sm font-bold text-[#191c1e] truncate">{selectedCompany.companyName}</p>
                    {selectedCompany.ville && (
                      <p className="text-xs text-[#777683]">{selectedCompany.ville}{selectedCompany.siret ? ` · SIRET ${selectedCompany.siret}` : ""}</p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Prénom du gérant */}
            <div className="space-y-1.5">
              <label className="block text-xs font-black uppercase tracking-widest text-[#777683]">
                Prénom du gérant
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-[18px] text-[#777683]">
                  person
                </span>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="ex : Jean"
                  required
                  disabled={status === "loading"}
                  className="w-full pl-11 pr-4 py-3.5 rounded-xl border border-[#eceef0] bg-[#f7f9fb] text-[#191c1e] text-sm placeholder:text-[#b0b3ba] focus:outline-none focus:ring-2 focus:ring-[#2f6fb8]/30 focus:border-[#2f6fb8] transition"
                />
              </div>
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <label className="block text-xs font-black uppercase tracking-widest text-[#777683]">
                Adresse email professionnelle
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-[18px] text-[#777683]">
                  mail
                </span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="gerant@masociete.fr"
                  required
                  disabled={status === "loading"}
                  className="w-full pl-11 pr-4 py-3.5 rounded-xl border border-[#eceef0] bg-[#f7f9fb] text-[#191c1e] text-sm placeholder:text-[#b0b3ba] focus:outline-none focus:ring-2 focus:ring-[#2f6fb8]/30 focus:border-[#2f6fb8] transition"
                />
              </div>
              <p className="text-[11px] text-[#b0b3ba]">
                Utilisez cette même adresse pour créer votre compte — le rabais sera appliqué automatiquement.
              </p>
            </div>

            {status === "error" && (
              <div className="flex items-center gap-3 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm font-semibold">
                <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>error</span>
                {errorMsg}
              </div>
            )}

            <button
              type="submit"
              disabled={status === "loading" || !companyQuery.trim() || !firstName.trim() || !email.trim()}
              className="w-full flex items-center justify-center gap-2 bg-[#fbbf24] text-[#1a1b25] font-black py-4 rounded-full hover:bg-[#f59e0b] active:scale-95 transition disabled:opacity-60 disabled:cursor-not-allowed text-sm"
            >
              {status === "loading" ? (
                <>
                  <span className="w-4 h-4 border-2 border-[#1a1b25]/30 border-t-[#1a1b25] rounded-full animate-spin" />
                  Réservation en cours…
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[18px]">star</span>
                  Réserver ma place parmi les 50 premiers
                </>
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-[#b0b3ba]">
          Aucun paiement. Aucun engagement. Juste votre place réservée.
        </p>
      </div>
    </div>
  );
}
