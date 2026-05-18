"use client";

import { useState, useTransition } from "react";
import {
  runExternalSourceSync,
  toggleExternalSource,
  deleteExternalSource,
} from "@/app/admin/actions";

type Result = { created: number; deduped: number; failed: number; total: number; details?: string[] };

type Source = {
  id: string;
  label: string;
  kind: string;
  url: string;
  domain: string | null;
  agencySlug: string | null;
  active: boolean;
  lastSyncedAt: Date | null;
  lastResult: string | null;
  ownerEmail: string;
  ownerName: string;
};

function parseResult(raw: string | null): Result | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Result;
  } catch {
    return null;
  }
}

function fmtDate(d: Date | null): string {
  if (!d) return "jamais";
  return new Date(d).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
}

export default function ExternalSourceRow({ source }: { source: Source }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [liveResult, setLiveResult] = useState<Result | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  const result = liveResult ?? parseResult(source.lastResult);

  const onSync = () => {
    setError("");
    setLiveResult(null);
    startTransition(async () => {
      try {
        const r = await runExternalSourceSync(source.id);
        setLiveResult(r);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur");
      }
    });
  };

  const onToggle = () => {
    startTransition(async () => {
      try {
        await toggleExternalSource(source.id, !source.active);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur");
      }
    });
  };

  const onDelete = () => {
    if (!confirm(`Supprimer la source "${source.label}" ?`)) return;
    startTransition(async () => {
      try {
        await deleteExternalSource(source.id);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur");
      }
    });
  };

  return (
    <div className="bg-white border border-[#eceef0] rounded-2xl p-5 space-y-3">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-[#191c1e] line-clamp-1">{source.label}</h3>
            <span
              className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${
                source.active
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-[#eceef0] text-[#777683]"
              }`}
            >
              {source.active ? "actif" : "désactivé"}
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-[#e1e0ff] text-[#2f6fb8]">
              {source.kind}
            </span>
            {source.agencySlug && (
              <span
                className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#f7f9fb] text-[#515f74] border border-[#eceef0]"
                title="Slug d'agence — scope unique du scraper"
              >
                /{source.agencySlug}
              </span>
            )}
          </div>
          <a
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-[#2f6fb8] hover:underline line-clamp-1 mt-1"
          >
            {source.url}
          </a>
          <p className="text-[11px] text-[#777683] mt-1">
            Propriétaire : <strong>{source.ownerName}</strong> · {source.ownerEmail}
            {source.domain && <> · domaine <strong>{source.domain}</strong></>}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={onSync}
            disabled={isPending || !source.active}
            className="inline-flex items-center gap-1.5 bg-[#2f6fb8] text-white text-xs font-bold px-3 py-2 rounded-xl hover:bg-[#255a96] disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[16px]">sync</span>
            {isPending ? "Sync…" : "Synchroniser"}
          </button>
          <button
            type="button"
            onClick={onToggle}
            disabled={isPending}
            title={source.active ? "Désactiver" : "Activer"}
            className="w-9 h-9 flex items-center justify-center rounded-xl text-[#464652] hover:bg-[#f7f9fb] border border-[#eceef0]"
          >
            <span className="material-symbols-outlined text-[18px]">
              {source.active ? "pause" : "play_arrow"}
            </span>
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={isPending}
            title="Supprimer"
            className="w-9 h-9 flex items-center justify-center rounded-xl text-[#ba1a1a] hover:bg-[#ffdad6] border border-[#eceef0]"
          >
            <span className="material-symbols-outlined text-[18px]">delete</span>
          </button>
        </div>
      </div>

      {/* Dernière sync */}
      <div className="flex items-center gap-3 text-xs text-[#777683] border-t border-[#f2f4f6] pt-3">
        <span>
          Dernière sync : <strong className="text-[#191c1e]">{fmtDate(source.lastSyncedAt)}</strong>
        </span>
        {result && (
          <>
            <span className="text-emerald-700">+{result.created} créées</span>
            <span>= {result.deduped} déjà</span>
            {result.failed > 0 && <span className="text-[#ba1a1a]">{result.failed} échecs</span>}
            <span>· {result.total} total</span>
            {result.details && result.details.length > 0 && (
              <button
                type="button"
                onClick={() => setShowDetails((s) => !s)}
                className="ml-auto text-[#2f6fb8] hover:underline"
              >
                {showDetails ? "Masquer" : "Détails"}
              </button>
            )}
          </>
        )}
      </div>

      {showDetails && result?.details && (
        <pre className="text-[10px] leading-relaxed text-[#515f74] bg-[#f7f9fb] border border-[#eceef0] rounded-xl p-3 whitespace-pre-wrap font-mono max-h-64 overflow-y-auto">
          {result.details.join("\n")}
        </pre>
      )}

      {error && (
        <p className="text-xs text-[#ba1a1a] bg-[#ffdad6] rounded-xl px-3 py-2">{error}</p>
      )}
    </div>
  );
}
