import { prisma } from "@/lib/prisma";
import { getSatisfactionSettings } from "@/lib/satisfaction/settings";
import SettingsForm from "./SettingsForm";

export const metadata = { title: "Satisfaction — Administration" };
export const dynamic = "force-dynamic";

const DAY_MS = 86_400_000;

function percent(part: number, total: number): string {
  if (total === 0) return "—";
  return `${Math.round((part / total) * 100)} %`;
}

/**
 * Ce que les utilisateurs pensent de la plateforme, et à quel rythme on le leur
 * demande.
 *
 * L'écran s'ouvre sur les verbatims, pas sur les moyennes. Une note de 3,8 sur 5
 * ne dit pas quoi corriger ; « la recherche ne trouve rien quand je fais une
 * faute de frappe » si. Les chiffres servent à mesurer la collecte elle-même —
 * combien partent, combien reviennent — pas à résumer les avis.
 */
export default async function SatisfactionAdminPage() {
  const now = new Date();
  const last30 = new Date(now.getTime() - 30 * DAY_MS);

  const [
    settings,
    sent,
    opened,
    responses,
    pending,
    failed,
    recentSent,
    ratings,
    npsRows,
    verbatims,
  ] = await Promise.all([
    getSatisfactionSettings(),
    prisma.satisfactionCampaign.count({ where: { status: "SENT" } }),
    prisma.satisfactionCampaign.count({ where: { openedAt: { not: null } } }),
    prisma.satisfactionResponse.count(),
    prisma.satisfactionCampaign.count({ where: { status: { in: ["PENDING", "SCHEDULED"] } } }),
    prisma.satisfactionCampaign.count({ where: { status: "FAILED" } }),
    prisma.satisfactionCampaign.count({ where: { status: "SENT", sentAt: { gte: last30 } } }),
    prisma.satisfactionResponse.groupBy({
      by: ["rating"],
      _count: { _all: true },
      orderBy: { rating: "desc" },
    }),
    prisma.satisfactionResponse.findMany({
      where: { nps: { not: null } },
      select: { nps: true },
    }),
    prisma.satisfactionResponse.findMany({
      orderBy: { createdAt: "desc" },
      take: 40,
      select: {
        id: true,
        rating: true,
        nps: true,
        likes: true,
        improvements: true,
        wishedFeature: true,
        createdAt: true,
      },
    }),
  ]);

  const totalRatings = ratings.reduce((sum, r) => sum + r._count._all, 0);
  const average =
    totalRatings > 0
      ? ratings.reduce((sum, r) => sum + r.rating * r._count._all, 0) / totalRatings
      : null;

  // Net Promoter Score : promoteurs (9-10) moins détracteurs (0-6), en points
  // de pourcentage. Les passifs (7-8) comptent dans le total mais pas dans
  // l'écart — c'est la définition, et elle est volontairement sévère.
  const promoters = npsRows.filter((r) => (r.nps ?? 0) >= 9).length;
  const detractors = npsRows.filter((r) => (r.nps ?? 0) <= 6).length;
  const nps = npsRows.length > 0 ? Math.round(((promoters - detractors) / npsRows.length) * 100) : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-[#191c1e] font-headline">Satisfaction</h1>
        <p className="text-sm text-[#777683] mt-1">
          Sollicitations envoyées et retours reçus. Un compte n&apos;est jamais relancé avant{" "}
          {settings.cooldownDays} jours, quel qu&apos;en soit le motif.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Card label="Envoyés" value={String(sent)} hint={`${recentSent} sur 30 jours`} />
        <Card label="Ouverts" value={percent(opened, sent)} hint={`${opened} campagnes`} />
        <Card label="Réponses" value={percent(responses, sent)} hint={`${responses} avis`} />
        <Card
          label="Note moyenne"
          value={average ? `${average.toFixed(1)} / 5` : "—"}
          hint={totalRatings > 0 ? `${totalRatings} notes` : "aucune note"}
        />
        <Card
          label="Recommandation"
          value={nps === null ? "—" : `${nps > 0 ? "+" : ""}${nps}`}
          hint={npsRows.length > 0 ? `${npsRows.length} réponses` : "aucune réponse"}
        />
      </div>

      {(pending > 0 || failed > 0) && (
        <p className="text-sm text-[#777683]">
          {pending > 0 && `${pending} sollicitation${pending > 1 ? "s" : ""} en attente d'envoi. `}
          {failed > 0 && `${failed} en échec définitif.`}
        </p>
      )}

      {totalRatings > 0 && (
        <div className="bg-white border border-[#eceef0] rounded-xl p-5">
          <h2 className="font-bold text-[#191c1e] mb-4">Répartition des notes</h2>
          <div className="space-y-2">
            {[5, 4, 3, 2, 1].map((score) => {
              const count = ratings.find((r) => r.rating === score)?._count._all ?? 0;
              const share = totalRatings > 0 ? (count / totalRatings) * 100 : 0;
              return (
                <div key={score} className="flex items-center gap-3">
                  <span className="w-8 text-sm tabular-nums text-[#5a5b6e]">{score} ★</span>
                  <div className="flex-1 h-2.5 bg-[#f2f5f4] rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${score >= 4 ? "bg-[#1d6a58]" : score === 3 ? "bg-[#9a6118]" : "bg-[#99303a]"}`}
                      style={{ width: `${share}%` }}
                    />
                  </div>
                  <span className="w-16 text-right text-sm tabular-nums text-[#777683]">
                    {count} · {Math.round(share)} %
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <SettingsForm initial={settings} />

      <div className="bg-white border border-[#eceef0] rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[#eceef0]">
          <h2 className="font-bold text-[#191c1e]">Derniers retours</h2>
        </div>

        {verbatims.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-[#777683]">
            Aucune réponse pour l&apos;instant. La première campagne partira au prochain passage
            du planificateur.
          </p>
        ) : (
          <ul className="divide-y divide-[#eceef0]">
            {verbatims.map((v) => (
              <li key={v.id} className="px-5 py-4">
                <div className="flex items-center gap-3 mb-2">
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                      v.rating >= 4
                        ? "bg-[#e2efea] text-[#1d6a58]"
                        : v.rating === 3
                          ? "bg-[#f6ecdd] text-[#9a6118]"
                          : "bg-[#f7e5e6] text-[#99303a]"
                    }`}
                  >
                    {v.rating} / 5
                  </span>
                  {v.nps !== null && (
                    <span className="text-xs text-[#777683]">Recommandation {v.nps}/10</span>
                  )}
                  <span className="text-xs text-[#9ea4a9] ml-auto">
                    {v.createdAt.toLocaleDateString("fr-FR")}
                  </span>
                </div>

                {/* Les réponses libres sont affichées telles quelles. React
                    échappe le texte : un avis contenant du HTML s'affiche comme
                    du texte, il ne s'exécute pas. */}
                <div className="space-y-1.5 text-sm">
                  {v.likes && (
                    <p className="text-[#333f43]">
                      <span className="text-[#9ea4a9]">Aime : </span>
                      {v.likes}
                    </p>
                  )}
                  {v.improvements && (
                    <p className="text-[#333f43]">
                      <span className="text-[#9ea4a9]">À améliorer : </span>
                      {v.improvements}
                    </p>
                  )}
                  {v.wishedFeature && (
                    <p className="text-[#333f43]">
                      <span className="text-[#9ea4a9]">Souhaite : </span>
                      {v.wishedFeature}
                    </p>
                  )}
                  {!v.likes && !v.improvements && !v.wishedFeature && (
                    <p className="text-[#9ea4a9] italic">Note seule, sans commentaire.</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Card({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="bg-white border border-[#eceef0] rounded-xl p-4">
      <div className="text-xs uppercase text-[#5a5b6e] font-semibold tracking-wider">{label}</div>
      <div className="text-2xl font-extrabold text-[#191c1e] mt-1 tabular-nums">{value}</div>
      <div className="text-xs text-[#777683] mt-1">{hint}</div>
    </div>
  );
}
