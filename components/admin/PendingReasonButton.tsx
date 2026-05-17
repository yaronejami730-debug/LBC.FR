"use client";

import { useState } from "react";

type Flag = { code: string; severity?: string; message: string };

type Props = {
  title: string;
  adminNote: string | null;
  flagsJson: string;
  riskScore: number;
  riskDecision: string | null;
  reviewPriority: number;
};

const DECISION_META: Record<string, { label: string; color: string; explain: string }> = {
  block: {
    label: "Bloquée",
    color: "text-[#ba1a1a] bg-[#ffdad6]",
    explain: "Risque très élevé — l'annonce a été bloquée automatiquement.",
  },
  review: {
    label: "Vérification requise",
    color: "text-amber-700 bg-amber-100",
    explain: "Risque modéré — une vérification humaine est demandée avant publication.",
  },
  shadow: {
    label: "Dépriorisée",
    color: "text-orange-700 bg-orange-100",
    explain: "Risque léger — l'annonce est visible mais moins mise en avant.",
  },
  allow: {
    label: "Autorisée",
    color: "text-emerald-700 bg-emerald-100",
    explain: "Aucun risque significatif détecté par le moteur.",
  },
};

function severityStyle(sev?: string): string {
  switch (sev) {
    case "critical":
      return "text-[#ba1a1a] bg-[#ffdad6]";
    case "major":
      return "text-amber-700 bg-amber-100";
    case "medium":
      return "text-orange-700 bg-orange-100";
    default:
      return "text-[#515f74] bg-[#eceef0]";
  }
}

/** Couleur de la jauge de risque selon le score 0–100. */
function riskColor(score: number): string {
  if (score >= 80) return "#ba1a1a";
  if (score >= 60) return "#d97706";
  if (score >= 30) return "#ea580c";
  return "#16a34a";
}

export default function PendingReasonButton({
  title,
  adminNote,
  flagsJson,
  riskScore,
  riskDecision,
  reviewPriority,
}: Props) {
  const [open, setOpen] = useState(false);

  const flags: Flag[] = (() => {
    try {
      const parsed = JSON.parse(flagsJson || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  })();

  const decision = DECISION_META[riskDecision ?? ""] ?? null;
  const hasContent = flags.length > 0 || Boolean(adminNote);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#e1e0ff] text-[#2f6fb8] hover:bg-[#d5d3ff] transition-colors uppercase tracking-wide"
      >
        <span className="material-symbols-outlined text-[12px]">help</span>
        Pourquoi&nbsp;?
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-white rounded-2xl border border-[#eceef0] w-full max-w-lg max-h-[85vh] overflow-y-auto shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* En-tête */}
            <div className="flex items-start justify-between px-6 py-4 border-b border-[#eceef0]">
              <div className="min-w-0">
                <h3 className="font-bold text-[#191c1e]">Pourquoi en attente&nbsp;?</h3>
                <p className="text-xs text-[#777683] mt-0.5 line-clamp-1">{title}</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-[#777683] hover:text-[#191c1e] flex-shrink-0"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="px-6 py-4 space-y-4">
              {/* Score de risque */}
              <div className="flex items-center gap-4">
                <div className="flex flex-col items-center">
                  <span
                    className="text-3xl font-extrabold font-headline leading-none"
                    style={{ color: riskColor(riskScore) }}
                  >
                    {riskScore}
                  </span>
                  <span className="text-[9px] text-[#777683] uppercase tracking-widest mt-0.5">
                    Risque
                  </span>
                </div>
                <div className="flex-1">
                  {decision && (
                    <span
                      className={`inline-flex text-[11px] font-bold px-2.5 py-1 rounded-full ${decision.color}`}
                    >
                      {decision.label}
                    </span>
                  )}
                  <p className="text-xs text-[#464652] mt-1.5">
                    {decision?.explain ??
                      "L'annonce est en attente d'une vérification manuelle."}
                  </p>
                  {reviewPriority > 0 && (
                    <p className="text-[10px] text-[#777683] mt-1">
                      Priorité de file&nbsp;: {reviewPriority}
                    </p>
                  )}
                </div>
              </div>

              {/* Jauge */}
              <div className="h-2 rounded-full bg-[#eceef0] overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${Math.min(100, riskScore)}%`, background: riskColor(riskScore) }}
                />
              </div>

              {/* Signaux détectés */}
              {flags.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[#777683] mb-2">
                    Signaux détectés ({flags.length})
                  </p>
                  <ul className="space-y-1.5">
                    {flags.map((f, i) => (
                      <li key={`${f.code}-${i}`} className="flex items-start gap-2">
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide flex-shrink-0 ${severityStyle(
                            f.severity,
                          )}`}
                        >
                          {f.severity ?? "info"}
                        </span>
                        <span className="text-xs text-[#464652]">{f.message}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Note de modération brute */}
              {adminNote && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[#777683] mb-2">
                    Détail technique
                  </p>
                  <pre className="text-[10px] leading-relaxed text-[#515f74] bg-[#f7f9fb] border border-[#eceef0] rounded-xl p-3 whitespace-pre-wrap break-words font-mono">
                    {adminNote}
                  </pre>
                </div>
              )}

              {!hasContent && (
                <p className="text-xs text-[#777683] italic">
                  Aucun détail enregistré — vérification manuelle de routine.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
