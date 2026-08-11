"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";

// Modale lourde (~720 L) chargée à la demande seulement quand l'utilisateur
// soumet le formulaire — évite ~70 KB JS sur le bundle initial /register.
const ConsentModal = dynamic(() => import("./ConsentModal"), { ssr: false });

type AccountType = "particulier" | "pro";

export default function RegisterPage() {
  const router = useRouter();
  const [accountType, setAccountType] = useState<AccountType>("particulier");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [siret, setSiret] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [checkingSiret, setCheckingSiret] = useState(false);
  const [siretError, setSiretError] = useState("");
  const [showConsentModal, setShowConsentModal] = useState(false);
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

  function handleSubmitClick(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();
    if (!firstName.trim() || !lastName.trim()) {
      setError("Veuillez renseigner votre prénom et votre nom.");
      return;
    }
    if (accountType === "pro" && !companyName) {
      setError("Veuillez entrer un SIRET valide.");
      return;
    }
    if (password.length < 8) {
      setError("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }

    // Ouvre le modal de consentement — la soumission réelle se fait dans onAccept
    setShowConsentModal(true);
  }

  /**
   * Adresse déjà connue comme membre d'une équipe professionnelle.
   *
   * On ne crée rien tant que la personne n'a pas dit oui : découvrir l'agenda
   * d'un salon dans son espace personnel sans l'avoir demandé serait à la fois
   * inquiétant et incompréhensible.
   */
  const [membershipPrompt, setMembershipPrompt] = useState<{
    notice: string;
    memberships: { role: string | null; establishmentName: string; city: string | null }[];
    marketingConsent: boolean;
  } | null>(null);

  async function submitRegistration(marketingConsent: boolean, confirmMembership = false) {
    setShowConsentModal(false);
    setMembershipPrompt(null);
    setLoading(true);
    setError("");

    const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();

    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: fullName,
        email,
        password,
        marketingConsent,
        ...(confirmMembership ? { confirmMembership: true } : {}),
        ...(accountType === "pro" ? { isPro: true, siret, companyName } : {}),
      }),
    });

    setLoading(false);

    if (!res.ok) {
      const data = await res.json();
      if (data.code === "PRO_MEMBER_EXISTS") {
        setMembershipPrompt({
          notice: data.notice ?? "",
          memberships: data.memberships ?? [],
          marketingConsent,
        });
        return;
      }
      setError(data.error || "Échec de l'inscription");
    } else {
      router.push(`/verifier-email?email=${encodeURIComponent(email)}`);
    }
  }

  const canSubmit =
    !loading &&
    firstName.trim().length >= 2 &&
    lastName.trim().length >= 2 &&
    email.includes("@") &&
    password.length >= 8 &&
    !(accountType === "pro" && (!companyName || checkingSiret));

  return (
    <>
      {membershipPrompt && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
          <div className="w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl bg-white p-6">
            <h2 className="text-lg font-extrabold font-['Manrope']">
              Vous êtes déjà membre d&apos;une équipe
            </h2>
            <p className="mt-2 text-sm text-on-surface-variant leading-relaxed">
              {membershipPrompt.notice}
            </p>
            <ul className="mt-3 space-y-1">
              {membershipPrompt.memberships.map((m, i) => (
                <li key={i} className="flex items-center gap-2 text-sm">
                  <span className="material-symbols-outlined text-[18px] text-[#2f6fb8]">
                    storefront
                  </span>
                  <span>
                    <strong>{m.establishmentName}</strong>
                    {m.role ? ` · ${m.role}` : ""}
                    {m.city ? ` · ${m.city}` : ""}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-sm font-semibold">
              Voulez-vous créer un compte personnel avec cette adresse ?
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => submitRegistration(membershipPrompt.marketingConsent, true)}
                className="rounded-full bg-[#2f6fb8] px-5 py-2.5 text-sm font-bold text-white"
              >
                Oui, créer mon compte
              </button>
              <button
                type="button"
                onClick={() => setMembershipPrompt(null)}
                className="rounded-full border border-slate-200 px-5 py-2.5 text-sm font-bold text-[#464652]"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      {showConsentModal && (
        <ConsentModal
          onAccept={submitRegistration}
          onClose={() => setShowConsentModal(false)}
        />
      )}

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

            <form onSubmit={handleSubmitClick} className="space-y-5">
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
                  {/* Dit dès l'inscription ce qui attend le compte : le badge
                      pro n'est plus délivré sur la seule saisie d'un SIRET. */}
                  <p className="text-outline text-[11px] leading-relaxed bg-surface-container-low rounded-xl px-3 py-2">
                    Après inscription, une vérification d&apos;identité est demandée depuis votre
                    profil (pièce d&apos;identité + Kbis ou avis SIRENE). Le badge professionnel
                    s&apos;active une fois le compte validé, sous 24 à 48&nbsp;h.
                  </p>
                </div>
              )}

              {/* Prénom + Nom — deux champs séparés */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className="block text-sm font-bold text-primary tracking-tight">PRÉNOM</label>
                  <input
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    type="text"
                    required
                    autoComplete="given-name"
                    className="w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-on-surface placeholder:text-outline/60 focus:ring-2 focus:ring-primary outline-none"
                    placeholder="Prénom"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-bold text-primary tracking-tight">NOM</label>
                  <input
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    type="text"
                    required
                    autoComplete="family-name"
                    className="w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-on-surface placeholder:text-outline/60 focus:ring-2 focus:ring-primary outline-none"
                    placeholder="Nom"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-bold text-primary tracking-tight">EMAIL</label>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  required
                  autoComplete="email"
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
                  minLength={8}
                  autoComplete="new-password"
                  className="w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-on-surface placeholder:text-outline/60 focus:ring-2 focus:ring-primary outline-none"
                  placeholder="Min. 8 caractères"
                />
              </div>

              {error && (
                <p className="text-error text-sm font-medium bg-error-container px-4 py-3 rounded-xl">{error}</p>
              )}

              {/* Note consentement */}
              <p className="text-xs text-outline text-center leading-relaxed">
                En cliquant sur « Créer mon compte », vous serez invité à lire et accepter nos{" "}
                <Link href="/cgu" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-medium">CGU</Link>
                {" "}et notre{" "}
                <Link href="/confidentialite" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-medium">Politique de confidentialité</Link>.
              </p>

              <button
                type="submit"
                disabled={!canSubmit}
                className="w-full bg-gradient-to-r from-primary to-primary-container text-white font-bold py-4 rounded-full shadow-[0_8px_24px_rgba(21,21,125,0.2)] active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Création en cours…
                  </span>
                ) : "Créer mon compte"}
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
    </>
  );
}
