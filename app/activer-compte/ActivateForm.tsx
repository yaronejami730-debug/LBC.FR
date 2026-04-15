"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";

type Step = "password" | "siret";
type SuggestionResult = { siren: string; siret: string; nom_raison_sociale?: string; nom_complet?: string };

export default function ActivateForm({
  token,
  needsSiret = false,
}: {
  token: string;
  needsSiret?: boolean;
}) {
  const router = useRouter();

  // ── Step 1 : mot de passe ─────────────────────────────────────────────────
  const [step, setStep] = useState<Step>("password");
  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pwLoading, setPwLoading] = useState(false);
  const [pwError, setPwError] = useState("");

  // ── Step 2 : SIRET ────────────────────────────────────────────────────────
  const [query, setQuery] = useState("");
  const [siret, setSiret] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [suggestions, setSuggestions] = useState<SuggestionResult[]>([]);
  const [siretStatus, setSiretStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [siretMsg, setSiretMsg] = useState("");
  const [siretLoading, setSiretLoading] = useState(false);
  const [siretError, setSiretError] = useState("");
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Step 1 handler ────────────────────────────────────────────────────────
  async function handlePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwError("");
    if (password.length < 8) return setPwError("Le mot de passe doit contenir au moins 8 caractères.");
    if (password !== confirm) return setPwError("Les mots de passe ne correspondent pas.");

    setPwLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) return setPwError(data.error ?? "Une erreur est survenue.");

      if (needsSiret && data.needsSiret && data.userId) {
        setUserId(data.userId);
        setStep("siret");
      } else {
        router.push("/login?activated=1");
      }
    } catch {
      setPwError("Une erreur est survenue. Réessayez.");
    } finally {
      setPwLoading(false);
    }
  }

  // ── SIRET search autocomplete ─────────────────────────────────────────────
  function handleQueryChange(val: string) {
    setQuery(val);
    setSuggestions([]);
    setSiret("");
    setCompanyName("");
    setSiretStatus("idle");
    setSiretMsg("");
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (val.trim().length < 3) return;
    setSiretStatus("loading");
    searchTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://recherche-entreprises.api.gouv.fr/search?q=${encodeURIComponent(val.trim())}&page=1&per_page=6`
        );
        const data = await res.json();
        const results: SuggestionResult[] = (data?.results ?? []).map((r: any) => ({
          siren: r.siren,
          siret: r.siege?.siret ?? "",
          nom_raison_sociale: r.nom_raison_sociale,
          nom_complet: r.nom_complet,
        }));
        setSuggestions(results);
        setSiretStatus("idle");
      } catch {
        setSiretStatus("error");
        setSiretMsg("Impossible de contacter l'annuaire des entreprises");
      }
    }, 400);
  }

  function selectSuggestion(s: SuggestionResult) {
    const name = s.nom_raison_sociale || s.nom_complet || "";
    setSiret(s.siret);
    setCompanyName(name);
    setQuery(name);
    setSuggestions([]);
    setSiretStatus("ok");
    setSiretMsg(`✓ SIRET ${s.siret}`);
  }

  // ── Step 2 handler ────────────────────────────────────────────────────────
  async function handleSiret(e: React.FormEvent) {
    e.preventDefault();
    setSiretError("");
    if (!siret) return setSiretError("Veuillez sélectionner votre entreprise.");
    setSiretLoading(true);
    try {
      const res = await fetch("/api/auth/set-siret", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, siret, companyName }),
      });
      const data = await res.json();
      if (!res.ok) return setSiretError(data.error ?? "Une erreur est survenue.");
      router.push("/login?activated=1");
    } catch {
      setSiretError("Une erreur est survenue. Réessayez.");
    } finally {
      setSiretLoading(false);
    }
  }

  // ── Render step 1 ─────────────────────────────────────────────────────────
  if (step === "password") {
    return (
      <form onSubmit={handlePassword} className="space-y-4">
        <div>
          <label className="block text-sm font-semibold text-on-surface mb-1.5">Nouveau mot de passe</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="8 caractères minimum"
            required
            minLength={8}
            className="w-full px-4 py-3 rounded-2xl border border-outline-variant/30 bg-white text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-on-surface mb-1.5">Confirmer le mot de passe</label>
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Répétez votre mot de passe"
            required
            className="w-full px-4 py-3 rounded-2xl border border-outline-variant/30 bg-white text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
          />
        </div>
        {pwError && (
          <p className="text-red-600 text-sm font-medium bg-red-50 px-4 py-3 rounded-xl">{pwError}</p>
        )}
        {needsSiret && (
          <p className="text-xs text-outline bg-primary/5 px-3 py-2 rounded-xl flex items-center gap-2">
            <span className="material-symbols-outlined text-[14px] text-primary">info</span>
            Étape suivante : renseigner votre numéro SIRET
          </p>
        )}
        <button
          type="submit"
          disabled={pwLoading}
          className="w-full py-3.5 bg-primary text-white rounded-2xl font-bold text-sm hover:bg-primary/90 transition-all disabled:opacity-60 shadow-md shadow-primary/20 active:scale-95"
        >
          {pwLoading ? "Enregistrement…" : needsSiret ? "Continuer →" : "Créer mon mot de passe"}
        </button>
      </form>
    );
  }

  // ── Render step 2 (SIRET) ────────────────────────────────────────────────
  return (
    <form onSubmit={handleSiret} className="space-y-4">
      <div className="flex items-center gap-2 bg-primary/5 px-4 py-3 rounded-xl mb-2">
        <span className="material-symbols-outlined text-primary text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>business_center</span>
        <p className="text-sm text-on-surface">
          En tant que <strong>professionnel</strong>, votre numéro SIRET est requis pour valider votre compte.
        </p>
      </div>

      <div>
        <label className="block text-sm font-semibold text-on-surface mb-1.5">
          Recherchez votre entreprise <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            placeholder="Nom de société ou numéro SIRET…"
            className="w-full px-4 py-3 rounded-2xl border border-outline-variant/30 bg-white text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all pr-10"
            autoComplete="off"
          />
          {siretStatus === "loading" && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          )}
          {siretStatus === "ok" && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-emerald-500 text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
          )}

          {/* Dropdown suggestions */}
          {suggestions.length > 0 && (
            <ul className="absolute z-50 w-full mt-1 bg-white border border-[#eceef0] rounded-2xl shadow-lg overflow-hidden">
              {suggestions.map((s) => (
                <li key={s.siret || s.siren}>
                  <button
                    type="button"
                    onClick={() => selectSuggestion(s)}
                    className="w-full text-left px-4 py-3 hover:bg-primary/5 transition-colors border-b border-[#f2f4f6] last:border-0"
                  >
                    <p className="text-sm font-semibold text-on-surface truncate">
                      {s.nom_raison_sociale || s.nom_complet}
                    </p>
                    {s.siret && (
                      <p className="text-xs text-outline font-mono mt-0.5">SIRET {s.siret}</p>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        {siretMsg && (
          <p className={`text-xs mt-1.5 font-medium ${siretStatus === "ok" ? "text-emerald-600" : "text-red-500"}`}>
            {siretMsg}
          </p>
        )}
        <p className="text-[10px] text-outline mt-1.5">
          Tapez le nom de votre société ou votre numéro SIRET (14 chiffres)
        </p>
      </div>

      {siretError && (
        <p className="text-red-600 text-sm font-medium bg-red-50 px-4 py-3 rounded-xl">{siretError}</p>
      )}

      <button
        type="submit"
        disabled={siretLoading || !siret}
        className="w-full py-3.5 bg-primary text-white rounded-2xl font-bold text-sm hover:bg-primary/90 transition-all disabled:opacity-60 shadow-md shadow-primary/20 active:scale-95"
      >
        {siretLoading ? "Enregistrement…" : "Valider et accéder à mon compte"}
      </button>
    </form>
  );
}
