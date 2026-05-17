"use client";

import { useState } from "react";
import Link from "next/link";

export default function AcceptTermsForm({
  userId,
  initialMarketing,
}: {
  userId: string;
  initialMarketing: boolean;
}) {
  const [acceptCGU, setAcceptCGU] = useState(false);
  const [acceptPrivacy, setAcceptPrivacy] = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(initialMarketing);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!acceptCGU || !acceptPrivacy) {
      setError("Vous devez accepter les CGU et la politique de confidentialité.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/accept-terms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, marketingConsent }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Une erreur est survenue.");
      }
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="text-center py-2">
        <span className="material-symbols-outlined text-5xl text-green-500 block mb-3">task_alt</span>
        <p className="text-on-surface font-semibold mb-1">Merci, c'est enregistré.</p>
        <p className="text-outline text-sm mb-5">
          Votre acceptation a bien été prise en compte.
        </p>
        <Link
          href="/"
          className="inline-block bg-primary text-white font-semibold text-sm px-6 py-3 rounded-full"
        >
          Aller à l'accueil
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={acceptCGU}
          onChange={(e) => setAcceptCGU(e.target.checked)}
          className="mt-0.5 w-4 h-4 accent-primary"
        />
        <span className="text-sm text-on-surface">
          J'accepte les{" "}
          <Link href="/cgu" target="_blank" className="text-primary font-semibold hover:underline">
            Conditions Générales d'Utilisation
          </Link>
          .
        </span>
      </label>

      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={acceptPrivacy}
          onChange={(e) => setAcceptPrivacy(e.target.checked)}
          className="mt-0.5 w-4 h-4 accent-primary"
        />
        <span className="text-sm text-on-surface">
          J'accepte la{" "}
          <Link
            href="/confidentialite"
            target="_blank"
            className="text-primary font-semibold hover:underline"
          >
            Politique de Confidentialité
          </Link>
          .
        </span>
      </label>

      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={marketingConsent}
          onChange={(e) => setMarketingConsent(e.target.checked)}
          className="mt-0.5 w-4 h-4 accent-primary"
        />
        <span className="text-sm text-outline">
          J'accepte de recevoir les actualités et bons plans de Deal &amp; Co (facultatif).
        </span>
      </label>

      {error && <p className="text-red-500 text-sm">{error}</p>}

      <button
        type="submit"
        disabled={loading || !acceptCGU || !acceptPrivacy}
        className="w-full bg-primary text-white font-semibold text-sm py-3 rounded-full disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? "Enregistrement…" : "Accepter et continuer"}
      </button>
    </form>
  );
}
