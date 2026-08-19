import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireActiveAdvertiser } from "@/lib/ads/advertiser-auth";
import { CAMPAIGN_STATUSES } from "@/lib/ads/placements";
import { advertiserStats, variation } from "@/lib/ads/stats";
import PerformanceChart from "./PerformanceChart";
import PlacementBreakdown from "./PlacementBreakdown";
import AdvertiserShell, { COLORS } from "./AdvertiserShell";

export const dynamic = "force-dynamic";

const euros = (cents: number) =>
  (cents / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });

const STATUS_TONE: Record<string, { bg: string; fg: string }> = {
  ACTIVE: { bg: "#DCFCE7", fg: "#15803D" },
  SCHEDULED: { bg: "#DCE8FF", fg: "#1D4ED8" },
  PENDING_REVIEW: { bg: "#FEF3C7", fg: "#B45309" },
  REJECTED: { bg: "#FEE2E2", fg: "#B91C1C" },
  DRAFT: { bg: "#F1F5FC", fg: "#64748B" },
  PAUSED: { bg: "#F1F5FC", fg: "#64748B" },
  PAUSED_BUDGET: { bg: "#FEF3C7", fg: "#B45309" },
  PAUSED_INSUFFICIENT_FUNDS: { bg: "#FEE2E2", fg: "#B91C1C" },
  ENDED: { bg: "#F1F5FC", fg: "#64748B" },
  ARCHIVED: { bg: "#F1F5FC", fg: "#94A3B8" },
};

/**
 * Tableau de bord annonceur.
 *
 * Les indicateurs sont calculés sur les événements réels — jamais de valeur
 * décorative. Tant qu'aucune campagne n'a tourné, les cartes affichent zéro et
 * l'écran le dit franchement : un « +18,4 % » inventé décrédibilise tout le
 * reste dès la première vérification.
 */
export default async function AdvertiserDashboardPage() {
  const advertiser = await requireActiveAdvertiser();
  if (!advertiser) redirect("/annonceur/connexion");
  if (advertiser.mustChangePassword) redirect("/annonceur/mot-de-passe");

  // Les chiffres viennent des agrégats, jamais des événements bruts : sur une
  // campagne qui tourne, c'est la différence entre quatre lignes lues et
  // plusieurs centaines de milliers.
  const [campaigns, stats, apercuListing] = await Promise.all([
    prisma.adCampaign.findMany({
      where: { advertiserId: advertiser.id },
      orderBy: { createdAt: "desc" },
      take: 6,
      select: {
        id: true,
        name: true,
        status: true,
        spentCents: true,
        totalBudgetCents: true,
        qualityScore: true,
        maxBidCents: true,
        billingModel: true,
        billingExemptAt: true,
      },
    }),
    advertiserStats(advertiser.id, 30),
    // Une annonce en ligne, uniquement pour l'aperçu de l'encart de fiche
    // annonce : cet emplacement n'a pas d'URL fixe, il vit sur des annonces.
    prisma.listing.findFirst({
      where: { status: "APPROVED", deletedAt: null },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    }),
  ]);

  const { totals, previous, series, cities, placements } = stats;

  // Diffusable = solde moins ce que les campagnes en cours ont déjà engagé.
  // Afficher le seul solde laisserait croire qu'une nouvelle campagne peut
  // consommer un argent déjà promis à une autre.
  const availableCents = Math.max(0, advertiser.balanceCents - advertiser.reservedCents);

  const kpis = [
    {
      label: "Dépenses",
      value: euros(totals.costCents),
      icon: "payments",
      delta: variation(totals.costCents, previous.costCents),
    },
    {
      label: "Impressions visibles",
      value: totals.impressions.toLocaleString("fr-FR"),
      icon: "visibility",
      delta: variation(totals.impressions, previous.impressions),
    },
    {
      label: "Clics",
      value: totals.clicks.toLocaleString("fr-FR"),
      icon: "ads_click",
      delta: variation(totals.clicks, previous.clicks),
    },
    {
      label: "Taux de clic",
      value: totals.ctr === null ? "—" : `${totals.ctr.toFixed(2).replace(".", ",")} %`,
      icon: "trending_up",
      delta: null,
    },
    {
      label: "Coût par clic",
      value: totals.cpcCents === null ? "—" : euros(totals.cpcCents),
      icon: "sell",
      delta: null,
    },
  ];

  // Second rang d'indicateurs : ce que la mesure de visibilité et l'enchère
  // ajoutent. Ils ne remplacent pas les premiers, ils les expliquent — « peu
  // d'impressions » et « peu d'enchères gagnées » n'appellent pas la même
  // décision.
  const engineKpis = [
    {
      label: "Publicités chargées",
      value: totals.loads.toLocaleString("fr-FR"),
      hint: "Envoyées au navigateur, facturées seulement si elles atteignent l'écran.",
    },
    {
      label: "Taux de visibilité",
      value:
        totals.viewabilityRate === null
          ? "—"
          : `${totals.viewabilityRate.toFixed(0)} %`,
      hint: "Part des publicités chargées réellement vues : la moitié du bloc, une seconde.",
    },
    {
      label: "Enchères gagnées",
      value:
        totals.winRate === null
          ? "—"
          : `${totals.winRate.toFixed(0)} % (${totals.auctionWins.toLocaleString("fr-FR")})`,
      hint: `Sur ${totals.auctionEntries.toLocaleString("fr-FR")} enchères disputées. Un taux bas signale une enchère trop basse, pas un manque de trafic.`,
    },
    {
      label: "Conversions",
      value: totals.conversions.toLocaleString("fr-FR"),
      hint:
        totals.costPerConversionCents === null
          ? "Appels, e-mails, messages et rendez-vous attribués à vos publicités."
          : `Soit ${euros(totals.costPerConversionCents)} par contact obtenu.`,
    },
    {
      label: "Événements écartés",
      value: totals.invalidEvents.toLocaleString("fr-FR"),
      hint: "Robots, doubles clics, affichages jamais vus. Comptés, jamais facturés.",
    },
  ];

  const card = "rounded-[18px] bg-white p-[18px]";
  const cardStyle = { border: `1px solid ${COLORS.line}` };

  return (
    <AdvertiserShell
      title="Tableau de bord"
      subtitle={`Bonjour ${advertiser.firstName}, voici où en sont vos campagnes.`}
      advertiserName={advertiser.company || `${advertiser.firstName} ${advertiser.lastName}`}
      contactName={`${advertiser.firstName} ${advertiser.lastName}`}
      current="/annonceur"
      action={{ href: "/annonceur/campagnes/nouvelle", label: "Nouvelle campagne" }}
    >
      <div className="flex flex-col gap-5">
        <section className="grid gap-4 grid-cols-2 lg:grid-cols-5">
          {kpis.map((k) => (
            <div key={k.label} className={card} style={cardStyle}>
              <div className="flex items-center justify-between">
                <span className="text-[11.5px] font-bold uppercase tracking-wide" style={{ color: COLORS.muted }}>
                  {k.label}
                </span>
                <span className="material-symbols-outlined text-[17px]" style={{ color: COLORS.muted }}>
                  {k.icon}
                </span>
              </div>
              <p className="mt-2 text-[26px] font-extrabold tabular-nums leading-none">{k.value}</p>
              {/* La variation n'apparaît que si la période précédente existe :
                  « +100 % » à partir de zéro ne veut rien dire. */}
              {k.delta !== null && (
                <p
                  className="mt-1 text-[12px] font-bold tabular-nums"
                  style={{ color: k.delta >= 0 ? "#15803D" : COLORS.red }}
                >
                  {k.delta >= 0 ? "+" : ""}
                  {k.delta.toFixed(1).replace(".", ",")} % sur 30 jours
                </p>
              )}
            </div>
          ))}
        </section>

        <section className="grid gap-4 grid-cols-2 lg:grid-cols-5">
          {engineKpis.map((k) => (
            <div key={k.label} className={card} style={cardStyle}>
              <span
                className="text-[11.5px] font-bold uppercase tracking-wide"
                style={{ color: COLORS.muted }}
              >
                {k.label}
              </span>
              <p className="mt-2 text-[22px] font-extrabold tabular-nums leading-none">{k.value}</p>
              <p className="mt-1.5 text-[11.5px] leading-snug" style={{ color: COLORS.muted }}>
                {k.hint}
              </p>
            </div>
          ))}
        </section>

        {totals.impressions === 0 && (
          <p
            className="rounded-[18px] px-4 py-3 text-[13px] font-semibold"
            style={{ background: COLORS.tint, color: COLORS.soft }}
          >
            Aucune diffusion pour l&apos;instant : ces chiffres se rempliront dès qu&apos;une
            campagne sera validée et servie. Rien n&apos;est simulé ici.
          </p>
        )}

        <section className={card} style={cardStyle}>
          <PerformanceChart series={series} />
        </section>

        {/* Sans cette ligne, un annonceur en gratuité lit « 0,00 € » partout
            et en conclut que le comptage est cassé. Ce n'est pas le comptage :
            c'est la facturation qui est volontairement coupée sur son compte. */}
        {advertiser.billingDisabledAt && totals.impressions > 0 && (
          <p
            className="rounded-[18px] px-4 py-3 text-[13px] font-semibold"
            style={{ background: "#DCFCE7", color: "#15803D" }}
          >
            Diffusion offerte sur votre compte depuis le{" "}
            {advertiser.billingDisabledAt.toLocaleDateString("fr-FR")} : impressions et clics sont
            comptés normalement, mais rien ne vous est facturé. C&apos;est pourquoi la dépense et le
            coût par clic restent à zéro.
          </p>
        )}

        <PlacementBreakdown
          rows={placements}
          totalImpressions={totals.impressions}
          listingHref={apercuListing ? `/annonce/${apercuListing.id}` : null}
        />

        {cities.length > 0 && (
          <section className={`${card} p-0 overflow-hidden`} style={cardStyle}>
            <div className="px-[18px] py-4" style={{ borderBottom: `1px solid ${COLORS.line}` }}>
              <h2 className="font-extrabold text-[15px]">Répartition géographique</h2>
              <p className="text-[12.5px]" style={{ color: COLORS.muted }}>
                Où vos publicités ont été vues, sur 30 jours.
              </p>
            </div>
            <ul className="divide-y" style={{ borderColor: COLORS.line }}>
              {cities.map((c) => {
                const share = totals.impressions > 0 ? (c.impressions / totals.impressions) * 100 : 0;
                return (
                  <li key={c.citySlug || "inconnue"} className="px-[18px] py-3 flex items-center gap-4">
                    <span className="w-40 shrink-0 font-bold text-[13.5px] capitalize truncate">
                      {c.citySlug ? c.citySlug.replace(/-/g, " ") : "Commune inconnue"}
                    </span>
                    <span className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: COLORS.tint }}>
                      <span
                        className="block h-full rounded-full"
                        style={{ width: `${share}%`, background: COLORS.blueLight }}
                      />
                    </span>
                    <span className="w-28 shrink-0 text-right text-[12.5px] tabular-nums" style={{ color: COLORS.muted }}>
                      {c.impressions.toLocaleString("fr-FR")} vues
                    </span>
                    <span className="w-20 shrink-0 text-right text-[12.5px] tabular-nums font-bold">
                      {c.clicks.toLocaleString("fr-FR")} clics
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        <section className={`${card} p-0 overflow-hidden`} style={cardStyle}>
          <div className="flex items-center justify-between px-[18px] py-4" style={{ borderBottom: `1px solid ${COLORS.line}` }}>
            <h2 className="font-extrabold text-[15px]">Mes campagnes</h2>
            <Link href="/annonceur/campagnes" className="text-[12.5px] font-bold" style={{ color: COLORS.blue }}>
              Voir tout
            </Link>
          </div>

          {campaigns.length === 0 ? (
            <div className="px-[18px] py-12 text-center">
              <span className="material-symbols-outlined text-[30px]" style={{ color: COLORS.muted }}>
                campaign
              </span>
              <p className="mt-2 font-extrabold">Aucune campagne</p>
              <p className="mt-1 text-[13px] max-w-sm mx-auto" style={{ color: COLORS.muted }}>
                Choisissez votre objectif, la zone où diffuser et votre budget. Vous verrez votre
                publicité avant de la lancer.
              </p>
              <Link
                href="/annonceur/campagnes/nouvelle"
                className="mt-4 inline-block rounded-xl px-5 py-2.5 text-[13px] font-bold text-white"
                style={{ background: `linear-gradient(135deg, ${COLORS.blue}, ${COLORS.blueLight})` }}
              >
                Créer ma première campagne
              </Link>
            </div>
          ) : (
            <ul className="divide-y" style={{ borderColor: COLORS.line }}>
              {campaigns.map((c) => {
                const tone = STATUS_TONE[c.status] ?? STATUS_TONE.DRAFT;
                const pct = c.totalBudgetCents
                  ? Math.min(100, Math.round((c.spentCents / c.totalBudgetCents) * 100))
                  : 0;
                return (
                  <li key={c.id} className="px-[18px] py-3.5 flex items-center gap-4">
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-[14px] truncate">{c.name}</p>
                      {/* Barre de consommation : un budget se lit en un coup
                          d'œil, pas en comparant deux nombres. */}
                      <div className="mt-1.5 h-1.5 w-full max-w-[220px] rounded-full overflow-hidden" style={{ background: COLORS.tint }}>
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${COLORS.blueLight}, ${COLORS.blue})` }}
                        />
                      </div>
                      <p className="mt-1 text-[11.5px] tabular-nums" style={{ color: COLORS.muted }}>
                        {euros(c.spentCents)} sur {euros(c.totalBudgetCents)}
                        {c.maxBidCents > 0 && (
                          <>
                            {" · "}
                            enchère max. {euros(c.maxBidCents)}
                            {c.billingModel === "CPM" ? " / 1 000 vues" : " / clic"}
                          </>
                        )}
                        {" · "}
                        {/* Le score qualité est affiché parce qu'il décide du rang :
                            le cacher reviendrait à faire subir un classement dont
                            l'annonceur ne peut rien faire. */}
                        qualité {c.qualityScore}/100
                        {c.billingExemptAt && " · offerte"}
                      </p>
                    </div>
                    <span
                      className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold"
                      style={{ background: tone.bg, color: tone.fg }}
                    >
                      {CAMPAIGN_STATUSES[c.status as keyof typeof CAMPAIGN_STATUSES] ?? c.status}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          <div className={card} style={cardStyle}>
            <p className="text-[11.5px] font-bold uppercase tracking-wide" style={{ color: COLORS.muted }}>
              Solde disponible
            </p>
            <p className="mt-1.5 text-[26px] font-extrabold tabular-nums">{euros(availableCents)}</p>
            <p className="mt-1 text-[12.5px] tabular-nums" style={{ color: COLORS.muted }}>
              {euros(advertiser.balanceCents)} au portefeuille, dont{" "}
              {euros(advertiser.reservedCents)} déjà engagés par vos campagnes en cours.
            </p>
          </div>
          <div className={card} style={cardStyle}>
            <p className="text-[11.5px] font-bold uppercase tracking-wide" style={{ color: COLORS.muted }}>
              Identifiant de connexion
            </p>
            <p className="mt-1.5 font-mono font-bold text-[15px] select-all">{advertiser.loginId}</p>
            <p className="mt-1 text-[12.5px]" style={{ color: COLORS.muted }}>
              À conserver : c&apos;est lui qui ouvre cet espace.
            </p>
          </div>
        </section>
      </div>
    </AdvertiserShell>
  );
}
