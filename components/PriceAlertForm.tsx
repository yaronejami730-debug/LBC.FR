"use client";

import { useState } from "react";

/**
 * Alerte sur une page de cote.
 *
 * Elle s'affiche quand la cote existe mais que le stock est vide — le cas
 * exact qu'une page de cote est faite pour servir. La page a répondu à la
 * question posée (« combien ça vaut ») ; elle n'a simplement rien à vendre
 * aujourd'hui. Renvoyer le visiteur sur une grille vide gâche la visite dans
 * les deux sens : lui repart sans rien, et nous perdons l'information la plus
 * précieuse du moment — quelqu'un cherche ce modèle et nous ne l'avons pas.
 *
 * L'inscription est donc enregistrée avec la demande en toutes lettres, ce qui
 * en fait un signal de demande directement exploitable côté recrutement
 * vendeurs, et non une simple adresse de plus.
 */
export default function PriceAlertForm({ label, query }: { label: string; query: string }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (status === "loading") return;
    setStatus("loading");
    setError("");
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, query, source: "prix" }),
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
      <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 text-center">
        <span
          className="material-symbols-outlined text-3xl text-emerald-600 mb-2 block"
          style={{ fontVariationSettings: "'FILL' 1" }}
        >
          check_circle
        </span>
        <p className="font-bold text-emerald-900">C&apos;est noté</p>
        <p className="text-sm text-emerald-800/80 mt-1">
          Vous serez prévenu dès qu&apos;un(e) {label} sera mis(e) en ligne.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-surface-container rounded-2xl p-6">
      <p className="text-base font-bold text-on-surface mb-1">
        Aucun(e) {label} en ligne pour le moment
      </p>
      <p className="text-sm text-outline mb-4">
        Soyez prévenu dès qu&apos;un(e) {label} est mis(e) en vente. Vous connaissez
        déjà le prix du marché — vous saurez tout de suite si l&apos;annonce vaut le coup.
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
