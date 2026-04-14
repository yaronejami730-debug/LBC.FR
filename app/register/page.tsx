"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type AccountType = "particulier" | "pro";

export default function RegisterPage() {
  const router = useRouter();
  const [accountType, setAccountType] = useState<AccountType>("particulier");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [siret, setSiret] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [checkingSiret, setCheckingSiret] = useState(false);
  const [siretError, setSiretError] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSiretChange(value: string) {
    const clean = value.replace(/\s/g, "").slice(0, 14);
    setSiret(clean);
    setCompanyName("");
    setSiretError("");

    if (clean.length === 14) {
      setCheckingSiret(true);
      try {
        const res = await fetch(`/api/siret?q=${clean}`);
        const data = await res.json();
        if (!res.ok) {
          setSiretError(data.error ?? "SIRET invalide");
        } else {
          setCompanyName(data.companyName ?? "");
          if (!data.companyName) setSiretError("Nom d'entreprise introuvable");
        }
      } catch {
        setSiretError("Impossible de vérifier le SIRET");
      } finally {
        setCheckingSiret(false);
      }
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (accountType === "pro" && !companyName) {
      setError("Veuillez entrer un SIRET valide");
      return;
    }
    setLoading(true);
    setError("");
    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        email,
        password,
        ...(accountType === "pro" ? { isPro: true, siret, companyName } : {}),
      }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Échec de l'inscription");
    } else {
      router.push("/login");
    }
  }

  return (
    <div className="bg-surface text-on-surface min-h-screen flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <img src="/logo.png" alt="Deal & Co" className="h-16 w-auto mx-auto mb-2" />
          <p className="text-on-surface-variant">Créez votre compte</p>
        </div>

        <div className="bg-surface-container-lowest rounded-3xl p-8 shadow-[0_16px_32px_rgba(21,21,125,0.06)]">

          {/* Toggle Particulier / Pro */}
          <div className="flex bg-surface-container-low rounded-2xl p-1 mb-6">
            <button
              type="button"
              onClick={() => { setAccountType("particulier"); setSiret(""); setCompanyName(""); setSiretError(""); }}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all ${
                accountType === "particulier"
                  ? "bg-white text-primary shadow-sm"
                  : "text-outline hover:text-on-surface"
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">person</span>
              Particulier
            </button>
            <button
              type="button"
              onClick={() => setAccountType("pro")}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all ${
                accountType === "pro"
                  ? "bg-white text-primary shadow-sm"
                  : "text-outline hover:text-on-surface"
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">store</span>
              Professionnel
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* SIRET — uniquement si Pro */}
            {accountType === "pro" && (
              <div className="space-y-2">
                <label className="block text-sm font-bold text-primary tracking-tight">NUMÉRO SIRET</label>
                <div className="relative">
                  <input
                    value={siret}
                    onChange={(e) => handleSiretChange(e.target.value)}
                    type="text"
                    inputMode="numeric"
                    maxLength={14}
                    required
                    className="w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-on-surface placeholder:text-outline/60 focus:ring-2 focus:ring-primary outline-none pr-10"
                    placeholder="14 chiffres"
                  />
                  {checkingSiret && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                  {companyName && !checkingSiret && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <span className="material-symbols-outlined text-green-500 text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                    </div>
                  )}
                </div>
                {companyName && (
                  <div className="bg-[#d5e3fc]/40 border border-[#d5e3fc] rounded-xl px-4 py-3 flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-[18px]">store</span>
                    <div>
                      <p className="text-[10px] font-bold text-primary uppercase tracking-wider">Entreprise trouvée</p>
                      <p className="font-bold text-on-surface text-sm">{companyName}</p>
                    </div>
                  </div>
                )}
                {siretError && (
                  <p className="text-error text-xs font-medium">{siretError}</p>
                )}
              </div>
            )}

            <div className="space-y-2">
              <label className="block text-sm font-bold text-primary tracking-tight">
                {accountType === "pro" ? "NOM DU RESPONSABLE" : "NOM"}
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                type="text"
                required
                className="w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-on-surface placeholder:text-outline/60 focus:ring-2 focus:ring-primary outline-none"
                placeholder={accountType === "pro" ? "Prénom Nom" : "Votre nom complet"}
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-bold text-primary tracking-tight">EMAIL</label>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                required
                className="w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-on-surface placeholder:text-outline/60 focus:ring-2 focus:ring-primary outline-none"
                placeholder="vous@exemple.com"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-bold text-primary tracking-tight">MOT DE PASSE</label>
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                required
                minLength={6}
                className="w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-on-surface placeholder:text-outline/60 focus:ring-2 focus:ring-primary outline-none"
                placeholder="Min. 6 caractères"
              />
            </div>

            {error && (
              <p className="text-error text-sm font-medium bg-error-container px-4 py-3 rounded-xl">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading || (accountType === "pro" && (!companyName || checkingSiret))}
              className="w-full bg-gradient-to-r from-primary to-primary-container text-white font-bold py-4 rounded-full shadow-[0_8px_24px_rgba(21,21,125,0.2)] active:scale-95 transition-all disabled:opacity-70"
            >
              {loading ? "Création en cours…" : "Créer mon compte"}
            </button>
          </form>

          <p className="text-center mt-6 text-sm text-on-surface-variant">
            Déjà un compte ?{" "}
            <Link href="/login" className="text-primary font-bold hover:underline">
              Se connecter
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
