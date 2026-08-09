import { LEVEL_COLORS, levelFor, levelLabel, type TrustLevel } from "@/lib/moderation/trust-profile";

/**
 * Jauge de score de confiance.
 *
 * Le chiffre seul ne se lit pas : 61/100 ne dit pas si c'est bon. La barre et
 * la couleur donnent la lecture immédiate, le libellé lève l'ambiguïté pour
 * qui ne distingue pas l'orange du rouge.
 */
export function TrustGauge({
  score,
  size = "md",
  showLabel = true,
}: {
  score: number;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
}) {
  const level = levelFor(score);
  const colors = LEVEL_COLORS[level];
  const label = levelLabel(level);

  if (size === "sm") {
    return (
      <span className="inline-flex items-center gap-2 min-w-0">
        <span className="w-16 h-1.5 rounded-full bg-slate-200 overflow-hidden shrink-0">
          <span className={`block h-full rounded-full ${colors.bar}`} style={{ width: `${score}%` }} />
        </span>
        <span className={`text-xs font-bold tabular-nums ${colors.text}`}>{score}</span>
      </span>
    );
  }

  const numberClass = size === "lg" ? "text-4xl" : "text-2xl";

  return (
    <div className="min-w-0">
      <div className="flex items-baseline gap-2">
        <span className={`${numberClass} font-extrabold tabular-nums ${colors.text} font-headline`}>
          {score}
        </span>
        <span className="text-sm text-slate-400 font-medium">/ 100</span>
      </div>
      <div className="mt-2 h-2 rounded-full bg-slate-200 overflow-hidden">
        <div
          className={`h-full rounded-full ${colors.bar} transition-all`}
          style={{ width: `${score}%` }}
        />
      </div>
      {showLabel && (
        <p className={`mt-1.5 text-xs font-bold ${colors.text}`}>{label}</p>
      )}
    </div>
  );
}

/** Pastille compacte — pour les tableaux et les en-têtes de ligne. */
export function TrustBadge({ score }: { score: number }) {
  const level: TrustLevel = levelFor(score);
  const colors = LEVEL_COLORS[level];
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold ${colors.bg} ${colors.text}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${colors.dot}`} />
      {score} · {levelLabel(level)}
    </span>
  );
}
