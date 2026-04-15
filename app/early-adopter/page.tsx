"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";

type SiretMode = "siret" | "siren";

export default function EarlyAdopterPage() {
  const [siretValue, setSiretValue] = useState("");
  const [siretMode, setSiretMode] = useState<SiretMode>("siret");
  const [companyName, setCompanyName] = useState("");
  const [companyVille, setCompanyVille] = useState("");
  const [checkingId, setCheckingId] = useState(false);
  const [idError, setIdError] = useState("");

  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");

  const [status, setStatus] = useState<"idle" | "loading" | "success" | "full" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [position, setPosition] = useState<number | null>(null);

  const expectedLength = siretMode === "siret" ? 14 : 9;

  async function handleIdChange(value: string) {
    const clean = value.replace(/\s/g, "").replace(/\D/g, "").slice(0, expectedLength);
    setSiretValue(clean);
    setCompanyName("");
    setCompanyVille("");
    setIdError("");

    if (clean.length === expectedLength) {
      setCheckingId(true);
      try {
        const res = await fetch(`/api/siret?q=${clean}`);
        const data = await res.json();
        if (!res.ok) {
          setIdError(data.error ?? (siretMode === "siret" ? "SIRET invalide" : "SIREN invalide"));
        } else {
          setCompanyName(data.companyName ?? "");
          if (!data.companyName) setIdError("Nom d'entreprise introuvable");
        }
      } catch {
        setIdError("Impossible de vérifier le numéro");
      } finally {
        setCheckingId(false);
      }
    }
  }

  function reset() {
    setSiretValue("");
    setCompanyName("");
    setCompanyVille("");
    setIdError("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!companyName) { setIdError("Veuillez entrer un SIRET ou SIREN valide"); return; }

    setStatus("loading");
    setErrorMsg("");

    try {
      const res = await fetch("/api/early-adopter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName,
          siret: siretMode === "siret" ? siretValue : null,
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

  // ── Succès ───────────────────────────────────────────────────────────────────
  if (status === "success") {
    return (
      <div className="min-h-screen bg-[#f7f9fb] flex items-center justify-center px-4 py-16">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="w-20 h-20 rounded-full bg-[#fbbf24]/20 flex items-center justify-center mx-auto text-4xl">
            🎯
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-[#191c1e]">Vous êtes pré-inscrit !</h1>
            {position && (
              <p className="text-[#2f6fb8] font-black text-lg mt-1">Place n°{position} / 50</p>
            )}
            <p className="text-[#777683] text-sm mt-3 leading-relaxed">
              Bienvenue parmi nos <strong className="text-[#191c1e]">premiers partenaires professionnels</strong>.
              Dès votre inscription sur Deal&nbsp;&amp;&nbsp;Co avec cette adresse email,
              vous bénéficierez automatiquement de{" "}
              <strong className="text-[#191c1e]">−50% pendant 3 ans</strong> sur vos espaces publicitaires.
            </p>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4 text-left space-y-1">
            <p className="text-xs font-black uppercase tracking-wider text-amber-700">⚠️ Étape suivante</p>
            <p className="text-sm text-amber-900">
              Créez votre compte avec <strong>exactement cette adresse email</strong> pour activer votre réduction automatiquement.
            </p>
          </div>
          <Link
            href="/register"
            className="inline-block bg-[#2f6fb8] text-white font-bold px-8 py-4 rounded-full hover:bg-[#2563a8] transition-all"
          >
            Créer mon compte maintenant →
          </Link>
          <p className="text-xs text-[#b0b3ba]">Un email de confirmation vous a été envoyé.</p>
        </div>
      </div>
    );
  }

  // ── Complet ──────────────────────────────────────────────────────────────────
  if (status === "full") {
    return (
      <div className="min-h-screen bg-[#f7f9fb] flex items-center justify-center px-4 py-16">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="text-5xl">😕</div>
          <h1 className="text-2xl font-extrabold text-[#191c1e]">Les 50 places sont complètes</h1>
          <p className="text-[#777683] text-sm">
            Toutes les places fondateurs sont prises. Créez quand même votre compte — la plateforme reste
            100% gratuite pour publier vos annonces.
          </p>
          <Link href="/register" className="inline-block bg-[#2f6fb8] text-white font-bold px-8 py-4 rounded-full">
            Créer mon compte
          </Link>
        </div>
      </div>
    );
  }

  // ── Formulaire ───────────────────────────────────────────────────────────────
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
            −50% sur vos publicités<br />pendant&nbsp;3&nbsp;ans
          </h1>
          <p className="text-[#777683] text-sm leading-relaxed">
            Deal&nbsp;&amp;&nbsp;Co est la marketplace locale{" "}
            <strong className="text-[#191c1e]">100% gratuite</strong> pour publier vos annonces.
            Notre modèle : nous nous rémunérons via des{" "}
            <strong className="text-[#191c1e]">espaces publicitaires</strong>.
            En rejoignant nos 50 premiers partenaires pros, vous obtenez{" "}
            <strong className="text-[#191c1e]">−50% pendant 3 ans</strong> sur vos forfaits pub.
          </p>
        </div>

        {/* Avantages */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { icon: "money_off", label: "Annonces\ngratuites", color: "text-emerald-600 bg-emerald-50" },
            { icon: "campaign", label: "Pub −50%\npendant 3 ans", color: "text-[#2f6fb8] bg-[#2f6fb8]/10" },
            { icon: "verified", label: "Badge Pro\nvérifié", color: "text-amber-600 bg-amber-50" },
          ].map(({ icon, label, color }) => (
            <div key={icon} className="bg-white rounded-2xl border border-[#eceef0] p-4 text-center space-y-2">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center mx-auto ${color}`}>
                <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                  {icon}
                </span>
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

            {/* SIRET / SIREN */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-black uppercase tracking-widest text-[#777683]">
                  {siretMode === "siret" ? "Numéro SIRET" : "Numéro SIREN"}
                </label>
                <button
                  type="button"
                  onClick={() => { setSiretMode(siretMode === "siret" ? "siren" : "siret"); reset(); }}
                  className="text-[11px] text-[#2f6fb8] font-bold hover:underline"
                >
                  Utiliser le {siretMode === "siret" ? "SIREN (9 chiffres)" : "SIRET (14 chiffres)"}
                </button>
              </div>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-[18px] text-[#777683]">
                  store
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={siretValue}
                  onChange={(e) => handleIdChange(e.target.value)}
                  placeholder={siretMode === "siret" ? "14 chiffres" : "9 chiffres"}
                  maxLength={expectedLength}
                  required
                  disabled={status === "loading"}
                  className="w-full pl-11 pr-10 py-3.5 rounded-xl border border-[#eceef0] bg-[#f7f9fb] text-[#191c1e] text-sm placeholder:text-[#b0b3ba] focus:outline-none focus:ring-2 focus:ring-[#2f6fb8]/30 focus:border-[#2f6fb8] transition font-mono tracking-wider"
                />
                {checkingId && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <div className="w-4 h-4 border-2 border-[#2f6fb8] border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
                {companyName && !checkingId && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <span className="material-symbols-outlined text-[20px] text-emerald-500" style={{ fontVariationSettings: "'FILL' 1" }}>
                      check_circle
                    </span>
                  </div>
                )}
              </div>

              {/* Résultat trouvé */}
              {companyName && (
                <div className="flex items-center gap-3 bg-[#d5e3fc]/40 border border-[#d5e3fc] rounded-xl px-4 py-3">
                  <span className="material-symbols-outlined text-[18px] text-[#2f6fb8] flex-shrink-0" style={{ fontVariationSettings: "'FILL' 1" }}>
                    store
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-black text-[#2f6fb8] uppercase tracking-wider">Société trouvée</p>
                    <p className="text-sm font-bold text-[#191c1e] truncate">{companyName}</p>
                    {companyVille && <p className="text-xs text-[#777683]">{companyVille}</p>}
                  </div>
                  <button type="button" onClick={reset} className="text-[#777683] hover:text-[#191c1e] flex-shrink-0">
                    <span className="material-symbols-outlined text-[18px]">close</span>
                  </button>
                </div>
              )}

              {idError && (
                <p className="text-red-600 text-xs font-semibold flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">error</span>
                  {idError}
                </p>
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
                Utilisez cette même adresse pour créer votre compte — la réduction sera appliquée automatiquement.
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
              disabled={status === "loading" || !companyName || !firstName.trim() || !email.trim() || checkingId}
              className="w-full flex items-center justify-center gap-2 bg-[#fbbf24] text-[#1a1b25] font-black py-4 rounded-full hover:bg-[#f59e0b] active:scale-95 transition disabled:opacity-50 disabled:cursor-not-allowed text-sm"
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
