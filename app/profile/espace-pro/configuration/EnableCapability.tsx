"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Déverrouillage d'une section de configuration.
 *
 * Le bouton dit ce qu'il ouvre, pas « activer la capacité staff » : le
 * professionnel décide d'avoir une équipe, il n'active pas un drapeau.
 */
export default function EnableCapability({
  capability,
  establishmentId,
  labels,
  alsoEnables = [],
}: {
  capability: string;
  establishmentId: string;
  /** Noms lisibles des capacités manquantes, déjà traduits côté serveur. */
  labels: string[];
  /** Capacités que l'activation entraînera avec elle. */
  alsoEnables?: string[];
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function enable() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/pro-profile/capabilities", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ capability, enabled: true, establishmentId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Activation impossible");
        return;
      }
      router.refresh();
    } catch {
      setError("Erreur réseau, réessayez");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-3">
      <p className="text-xs text-outline">
        Nécessite : <span className="font-semibold">{labels.join(", ")}</span>
        {alsoEnables.length > 0 && <> — activera aussi {alsoEnables.join(", ").toLowerCase()}</>}
      </p>
      <button
        type="button"
        onClick={enable}
        disabled={saving}
        title={`Activer ${labels.join(", ").toLowerCase()}`}
        className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary/90 disabled:opacity-50"
      >
        <span className="material-symbols-outlined text-[18px]">
          {saving ? "progress_activity" : "lock_open"}
        </span>
        {saving ? "Activation…" : "Activer"}
      </button>
      {error && <p className="mt-2 text-xs font-medium text-red-600">{error}</p>}
    </div>
  );
}
