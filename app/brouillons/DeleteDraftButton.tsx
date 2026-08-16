"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Suppression volontaire du brouillon.
 *
 * Confirmation en deux temps dans le bouton lui-même : le brouillon n'est pas
 * récupérable après coup, et une `confirm()` native n'est pas lisible sur
 * mobile.
 */
export default function DeleteDraftButton() {
  const router = useRouter();
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function remove() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/drafts", { method: "DELETE" });
      if (!res.ok) throw new Error();
      router.refresh();
    } catch {
      setError("Suppression impossible — réessayez.");
      setArmed(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      {armed ? (
        <>
          <button type="button" onClick={remove} disabled={busy}
            className="rounded-full bg-red-500 px-5 py-3 text-sm font-bold text-white disabled:opacity-50">
            {busy ? "Suppression…" : "Confirmer la suppression"}
          </button>
          <button type="button" onClick={() => setArmed(false)} disabled={busy}
            className="text-sm font-semibold text-outline">
            Annuler
          </button>
        </>
      ) : (
        <button type="button" onClick={() => setArmed(true)}
          className="rounded-full border border-slate-200 px-5 py-3 text-sm font-semibold text-outline transition-colors hover:border-red-300 hover:text-red-500">
          Supprimer le brouillon
        </button>
      )}
      {error && <span className="text-sm font-medium text-red-500">{error}</span>}
    </div>
  );
}
