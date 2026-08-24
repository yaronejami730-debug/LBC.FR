"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Bouton de captation immédiate.
 *
 * Il sert à prouver la chaîne, pas à la remplacer : le cron passe tout seul
 * toutes les heures. Ce bouton permet de publier un article chez le média,
 * d'appuyer, et de le voir arriver — la seule vérification qui ne demande pas
 * d'attendre.
 */
export default function FeedStatus() {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "running" | "done" | "error">("idle");
  const [result, setResult] = useState<string | null>(null);

  async function run() {
    setState("running");
    setResult(null);
    try {
      const res = await fetch("/api/admin/news-ingest", { method: "POST" });
      const data = (await res.json()) as {
        ok?: boolean;
        created?: number;
        updated?: number;
        durationMs?: number;
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);

      setState(data.ok ? "done" : "error");
      setResult(
        `${data.created ?? 0} nouveau(x), ${data.updated ?? 0} mis à jour, en ${Math.round(
          (data.durationMs ?? 0) / 1000,
        )} s${data.ok ? "" : " — au moins un flux n'a pas répondu"}`,
      );
      // Rafraîchir la page rend visibles les heures qui viennent de bouger :
      // c'est cette avancée qui constitue la preuve.
      router.refresh();
    } catch (e) {
      setState("error");
      setResult((e as Error).message);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={run}
        disabled={state === "running"}
        className="rounded-lg bg-[#2f6fb8] px-4 py-2 text-sm font-semibold text-white transition-opacity disabled:opacity-60"
      >
        {state === "running" ? "Captation en cours…" : "Capter maintenant"}
      </button>
      {result && (
        <span className={`text-sm ${state === "error" ? "text-red-600" : "text-slate-600"}`}>
          {result}
        </span>
      )}
    </div>
  );
}
