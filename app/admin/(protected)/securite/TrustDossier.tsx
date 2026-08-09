import { buildTrustProfile, LEVEL_COLORS } from "@/lib/moderation/trust-profile";
import { TrustGauge } from "./TrustGauge";

/**
 * Dossier de confiance affiché dans la fiche d'un compte.
 *
 * Remplace les chiffres bruts (spamScore, riskScore, flagsJson) par ce qu'ils
 * signifient. Un modérateur n'a pas à savoir qu'un `imageDupCount` existe : il
 * a besoin de lire « photos déjà vues ailleurs sur le site : 3 annonces », de
 * vérifier, et de décider.
 *
 * Le score est affiché avec sa décomposition, jamais seul. C'est ce qui le
 * rend contestable — et un score de modération qu'on ne peut pas contester
 * finit par être appliqué sans réflexion.
 */
export async function TrustDossier({ userId }: { userId: string }) {
  const profile = await buildTrustProfile(userId);
  if (!profile) return null;

  const colors = LEVEL_COLORS[profile.level];
  const positives = profile.signals.filter((s) => s.delta > 0);
  const negatives = profile.signals.filter((s) => s.delta < 0);

  const FAMILY_LABELS: Record<string, string> = {
    identite: "Identité",
    contenu: "Contenu",
    moderation: "Modération",
    comportement: "Comportement",
  };

  return (
    <section className="bg-white rounded-2xl border border-[#eceef0] overflow-hidden">
      <div className="px-6 py-4 border-b border-[#eceef0] flex items-center justify-between gap-4">
        <h2 className="font-bold text-[#191c1e]">Score de confiance</h2>
        <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${colors.bg} ${colors.text}`}>
          {profile.levelLabel}
        </span>
      </div>

      <div className="p-6 grid gap-6 lg:grid-cols-[220px_1fr]">
        <div>
          <TrustGauge score={profile.score} size="lg" />
          <dl className="mt-5 space-y-1.5 text-xs">
            <Stat label="Annonces" value={`${profile.stats.listings}`} />
            <Stat label="En ligne" value={`${profile.stats.approved}`} />
            <Stat label="Refusées" value={`${profile.stats.rejected}`} />
            <Stat label="Retirées" value={`${profile.stats.removed}`} />
            <Stat label="Signalements" value={`${profile.stats.reports}`} />
            <Stat
              label="Qualité moyenne"
              value={profile.stats.avgQuality === null ? "—" : `${profile.stats.avgQuality}/100`}
            />
            <Stat label="Ancienneté" value={`${profile.stats.accountAgeDays} j`} />
          </dl>
        </div>

        <div className="min-w-0 space-y-5">
          {negatives.length > 0 && (
            <div>
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-rose-700 mb-2">
                Ce qui pèse contre
              </h3>
              <ul className="space-y-1.5">
                {negatives.map((s) => (
                  <SignalRow key={s.key} signal={s} familyLabel={FAMILY_LABELS[s.family]} />
                ))}
              </ul>
            </div>
          )}

          {positives.length > 0 && (
            <div>
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 mb-2">
                Ce qui joue en faveur
              </h3>
              <ul className="space-y-1.5">
                {positives.map((s) => (
                  <SignalRow key={s.key} signal={s} familyLabel={FAMILY_LABELS[s.family]} />
                ))}
              </ul>
            </div>
          )}

          {profile.signals.length === 0 && (
            <p className="text-sm text-slate-400">
              Compte neutre : aucun signal, ni favorable ni défavorable.
            </p>
          )}

          <p className="text-[11px] text-slate-400 border-t border-[#f2f4f6] pt-3">
            Ce score est une aide à la modération. Il classe les dossiers, il n'en tranche aucun :
            la décision reste celle du modérateur.
          </p>
        </div>
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-bold text-slate-800 tabular-nums">{value}</dd>
    </div>
  );
}

function SignalRow({
  signal,
  familyLabel,
}: {
  signal: { label: string; delta: number; detail?: string };
  familyLabel: string;
}) {
  const negative = signal.delta < 0;
  return (
    <li className="flex items-start gap-3">
      <span
        className={`shrink-0 w-11 text-center text-[11px] font-extrabold tabular-nums px-1.5 py-0.5 rounded-md ${
          negative ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"
        }`}
      >
        {signal.delta > 0 ? `+${signal.delta}` : signal.delta}
      </span>
      <span className="min-w-0 flex-1">
        <span className="text-sm text-slate-700">{signal.label}</span>
        {signal.detail && <span className="text-xs text-slate-400"> — {signal.detail}</span>}
      </span>
      <span className="shrink-0 text-[10px] uppercase tracking-wider text-slate-300 font-bold">
        {familyLabel}
      </span>
    </li>
  );
}
