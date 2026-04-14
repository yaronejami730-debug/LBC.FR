"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function UpgradePro() {
  const [siret, setSiret] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [checking, setChecking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  async function handleSiretChange(value: string) {
    const clean = value.replace(/\s/g, "").slice(0, 14);
    setSiret(clean);
    setCompanyName("");
    setError("");

    if (clean.length === 14) {
      setChecking(true);
      try {
        const res = await fetch(`/api/siret?q=${clean}`);
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? "SIRET invalide");
        } else {
          setCompanyName(data.companyName ?? "");
        }
      } catch {
        setError("Impossible de vérifier le SIRET");
      } finally {
        setChecking(false);
      }
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!companyName) return;
    setSaving(true);
    setError("");
    const res = await fetch("/api/profile/upgrade-pro", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ siret, companyName }),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Erreur");
    } else {
      router.refresh();
    }
  }

  return (
    <div className="bg-white rounded-2xl p-6 shadow-[0_4px_24px_rgba(21,21,125,0.06)] mb-8">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-full bg-orange-50 flex items-center justify-center">
          <span className="material-symbols-outlined text-orange-500">store</span>
        </div>
        <div>
          <h3 className="font-extrabold text-on-surface font-['Manrope']">Passer en compte Pro</h3>
          <p className="text-outline text-xs mt-0.5">Affichez le badge Pro sur vos annonces</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-bold text-primary tracking-tight mb-1.5">
            NUMÉRO SIRET
          </label>
          <div className="relative">
            <input
              value={siret}
              onChange={(e) => handleSiretChange(e.target.value)}
              type="text"
              inputMode="numeric"
              maxLength={14}
              placeholder="14 chiffres"
              className="w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-on-surface placeholder:text-outline/60 focus:ring-2 focus:ring-primary outline-none pr-10"
            />
            {checking && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            )}
            {companyName && !checking && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <span className="material-symbols-outlined text-green-500 text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
              </div>
            )}
          </div>
        </div>

        {companyName && (
          <div className="bg-orange-50 border border-orange-100 rounded-xl px-4 py-3 flex items-center gap-3">
            <span className="material-symbols-outlined text-orange-500 text-[20px]">store</span>
            <div>
              <p className="text-[10px] font-bold text-orange-500 uppercase tracking-wider">Entreprise trouvée</p>
              <p className="text-on-surface font-bold text-sm">{companyName}</p>
            </div>
          </div>
        )}

        {error && (
          <p className="text-error text-sm font-medium bg-error-container px-4 py-3 rounded-xl">{error}</p>
        )}

        <button
          type="submit"
          disabled={!companyName || saving}
          className="w-full bg-orange-500 text-white font-bold py-3 rounded-full shadow-lg shadow-orange-500/20 active:scale-95 transition-all disabled:opacity-40 flex items-center justify-center gap-2"
        >
          <span className="material-symbols-outlined text-[18px]">store</span>
          {saving ? "Activation..." : "Activer le compte Pro"}
        </button>
      </form>
    </div>
  );
}
