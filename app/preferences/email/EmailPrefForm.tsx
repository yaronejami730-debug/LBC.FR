"use client";

import { useState } from "react";

export default function EmailPrefForm({
  token,
  initialConsent,
  name,
}: {
  token: string;
  initialConsent: boolean;
  name: string;
}) {
  const [consent, setConsent] = useState(initialConsent);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState("");

  async function update(next: boolean) {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/preferences/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, marketingConsent: next }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Erreur lors de l'enregistrement.");
        return;
      }
      setConsent(data.marketingConsent);
      setSavedAt(Date.now());
    } catch {
      setError("Erreur réseau. Réessayez.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <p className="text-sm text-on-surface mb-5">
        Bonjour <strong>{name}</strong>, choisissez ce que vous souhaitez recevoir par email.
      </p>

      <div className="rounded-2xl border border-surface-container bg-surface-container-lowest divide-y divide-surface-container">
        <div className="px-4 py-4 flex items-center gap-3">
          <span className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-primary text-[18px]">mail</span>
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-on-surface">E-mails promotionnels</p>
            <p className="text-xs text-outline mt-0.5">
              Nouveautés, offres et actualités Deal&amp;Co
            </p>
          </div>
          <button
            onClick={() => update(!consent)}
            disabled={saving}
            aria-label={consent ? "Désactiver" : "Activer"}
            className={`relative w-11 h-6 rounded-full transition-colors duration-200 flex-shrink-0 ${
              consent ? "bg-primary" : "bg-outline/30"
            } ${saving ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${
                consent ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>
      </div>

      <div className="mt-4 min-h-[24px] text-center">
        {error && <p className="text-xs text-red-600 font-medium">{error}</p>}
        {!error && savedAt && (
          <p className="text-xs text-emerald-600 font-medium flex items-center justify-center gap-1">
            <span className="material-symbols-outlined text-[14px]">check_circle</span>
            Préférence enregistrée
          </p>
        )}
      </div>

      <div className="mt-5 rounded-2xl bg-primary/[0.04] border border-primary/10 px-4 py-3">
        <p className="text-xs text-on-surface-variant leading-relaxed">
          Les e-mails transactionnels (sécurité du compte, messages reçus, alertes d'annonces que vous suivez) continuent d'être envoyés indépendamment de ce réglage.
        </p>
      </div>
    </div>
  );
}
