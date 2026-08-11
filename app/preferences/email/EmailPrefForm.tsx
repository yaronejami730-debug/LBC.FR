"use client";

import { useState } from "react";
import { ToggleField } from "@/components/ui/Toggle";

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
        <ToggleField
          checked={consent}
          onChange={update}
          loading={saving}
          icon="mail"
          label="E-mails promotionnels"
          description="Nouveautés, offres et actualités Deal&Co"
          title={consent ? "Désactiver" : "Activer"}
          className="px-4 py-4"
        />
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
