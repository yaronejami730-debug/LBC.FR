"use client";

import { useState } from "react";

type Props = {
  citySlug?: string;
  cityName?: string;
  categoryId?: string;
  categoryLabel?: string;
  subcategorySlug?: string;
  subcategoryLabel?: string;
  source?: string;
};

export default function WaitlistForm({
  citySlug,
  cityName,
  categoryId,
  categoryLabel,
  subcategorySlug,
  subcategoryLabel,
  source,
}: Props) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [error, setError] = useState("");

  const segment = subcategoryLabel ?? categoryLabel;
  const placeLabel = cityName ? ` à ${cityName}` : " près de chez vous";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (status === "loading") return;
    setStatus("loading");
    setError("");
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          citySlug,
          categoryId,
          subcategorySlug,
          source: source ?? "empty-state",
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Erreur, réessayez");
        setStatus("error");
        return;
      }
      setStatus("success");
      setEmail("");
    } catch {
      setError("Erreur réseau, réessayez");
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 text-center">
        <span className="material-symbols-outlined text-3xl text-emerald-600 mb-2 block" style={{ fontVariationSettings: "'FILL' 1" }}>
          check_circle
        </span>
        <p className="font-bold text-emerald-900">Inscription confirmée</p>
        <p className="text-sm text-emerald-800/80 mt-1">
          Vous serez prévenu dès qu&apos;une annonce {segment ? segment.toLowerCase() : ""}{placeLabel} sera publiée.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-surface-container rounded-2xl p-5">
      <p className="text-sm font-bold text-on-surface mb-1">
        Pas encore prêt à publier ?
      </p>
      <p className="text-sm text-outline mb-4">
        Recevez un email dès qu&apos;une annonce {segment ? segment.toLowerCase() : ""}{placeLabel} est publiée.
      </p>
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="votre@email.fr"
          className="flex-1 px-4 py-2.5 rounded-full border border-outline-variant/30 text-sm focus:outline-none focus:border-primary"
          disabled={status === "loading"}
        />
        <button
          type="submit"
          disabled={status === "loading"}
          className="px-6 py-2.5 bg-primary text-white rounded-full font-semibold text-sm shadow-md disabled:opacity-60 active:scale-95 transition-transform"
        >
          {status === "loading" ? "..." : "M'alerter"}
        </button>
      </div>
      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
      <p className="text-[11px] text-outline mt-3">
        Pas de spam. Désinscription en un clic depuis n&apos;importe quel email reçu.
      </p>
    </form>
  );
}
