/**
 * Détection de fraude publicitaire.
 *
 * Une régie qui facture tout ce qu'on lui envoie se fait vider en une nuit :
 * une boucle sur la route de clic, un script qui recharge une page, un robot
 * d'indexation mal élevé, et l'annonceur paie pour du trafic qui n'a jamais
 * regardé sa publicité. Le jeton signé empêche de fabriquer un événement à
 * partir de rien ; ce module s'occupe du reste — les événements authentiques
 * mais non humains, ou humains mais comptés plusieurs fois.
 *
 * Trois verdicts, et la nuance importe :
 *
 *  - `VALID` — l'événement compte et se facture ;
 *  - `INVALID` — l'événement est certainement non humain ou impossible. Il est
 *    **conservé**, jamais facturé, et affiché à l'annonceur comme écarté. Le
 *    supprimer rendrait impossible d'expliquer un écart entre ce qu'il voit
 *    passer et ce qu'il paie ;
 *  - `FRAUD_REVIEW` — l'événement est suspect sans être impossible. Il n'est
 *    pas facturé non plus, mais il attend un œil humain plutôt qu'un jugement
 *    définitif. Un commercial qui montre la campagne de son client à cinq
 *    personnes n'est pas un fraudeur.
 *
 * Le principe de base : **dans le doute, on ne facture pas**. Un événement
 * légitime écarté coûte quelques centimes à la régie ; un événement frauduleux
 * facturé coûte la confiance de l'annonceur.
 */
import { prisma } from "@/lib/prisma";

export type ValidationStatus = "VALID" | "PENDING" | "INVALID" | "FRAUD_REVIEW";

export type FraudVerdict = { status: ValidationStatus; reason?: string };

const VALID: FraudVerdict = { status: "VALID" };

/**
 * Robots déclarés.
 *
 * On ne cherche pas à démasquer qui se cache : un agent qui s'annonce comme un
 * robot est pris au mot, et c'est déjà l'essentiel du trafic automatique. Les
 * autres sont attrapés par les règles de cadence.
 */
const BOT_UA =
  /(bot|crawler|spider|crawling|headless|phantom|puppeteer|playwright|selenium|curl|wget|python-requests|axios|scrapy|monitoring|pingdom|lighthouse|gtmetrix)/i;

export function isBotUserAgent(userAgent: string | null | undefined): boolean {
  if (!userAgent) return true; // Pas d'agent du tout : rien d'humain ne fait ça.
  if (userAgent.length < 12) return true;
  return BOT_UA.test(userAgent);
}

// ── Seuils ──────────────────────────────────────────────────────────────────

/** Deux clics sur la même publicité à moins d'une seconde : c'est un rebond. */
export const DOUBLE_CLICK_MS = 1500;
/** Clics d'une même session sur une heure, tous créatifs confondus. */
export const MAX_CLICKS_PER_SESSION_HOUR = 8;
/** Clics d'une même session sur **un même créatif**, sur une heure. */
export const MAX_CLICKS_PER_AD_HOUR = 3;
/** Impressions visibles d'un même créatif pour une même session, sur une heure. */
export const MAX_VIEWABLES_PER_AD_HOUR = 20;

export type SignalCounts = {
  /** Millisecondes depuis le dernier clic de la session sur ce créatif. */
  msSinceLastClickSameAd: number | null;
  clicksSessionLastHour: number;
  clicksSameAdLastHour: number;
  viewablesSameAdLastHour: number;
  /** La publicité a-t-elle été chargée ou rendue sur cette page ? */
  hasRenderOnPageView: boolean;
};

/**
 * Décide à partir de signaux déjà mesurés.
 *
 * Fonction pure, volontairement : c'est la seule façon de tester une règle
 * anti-fraude sans monter une base et sans attendre qu'un vrai fraudeur passe.
 */
export function assessSignals(
  type: string,
  userAgent: string | null | undefined,
  counts: SignalCounts,
  options: { skipUserAgentCheck?: boolean } = {},
): FraudVerdict {
  // L'e-mail échappe au contrôle d'agent, et il le faut : une ouverture passe
  // par le proxy d'images de la messagerie, qui s'annonce comme un robot parce
  // qu'il en est un. Le refuser reviendrait à ne jamais compter une seule
  // ouverture — les autres règles, elles, continuent de s'appliquer.
  if (!options.skipUserAgentCheck && isBotUserAgent(userAgent)) {
    return { status: "INVALID", reason: "Agent automatisé." };
  }

  if (type === "CLICK") {
    // Un clic sans affichage sur la même page n'a pas pu être fait par un
    // humain : il n'y avait rien à cliquer. C'est la signature d'un appel
    // direct à la route de tracking.
    if (!counts.hasRenderOnPageView) {
      return { status: "INVALID", reason: "Clic sans affichage correspondant." };
    }
    if (counts.msSinceLastClickSameAd !== null && counts.msSinceLastClickSameAd < DOUBLE_CLICK_MS) {
      return { status: "INVALID", reason: "Double clic." };
    }
    if (counts.clicksSameAdLastHour >= MAX_CLICKS_PER_AD_HOUR) {
      return { status: "FRAUD_REVIEW", reason: "Clics répétés sur le même créatif." };
    }
    if (counts.clicksSessionLastHour >= MAX_CLICKS_PER_SESSION_HOUR) {
      return { status: "FRAUD_REVIEW", reason: "Cadence de clics anormale." };
    }
    return VALID;
  }

  if (type === "VIEWABLE_IMPRESSION") {
    // Vingt affichages du même créatif à la même session en une heure : ce
    // n'est plus de la navigation, c'est un rafraîchissement en boucle.
    if (counts.viewablesSameAdLastHour >= MAX_VIEWABLES_PER_AD_HOUR) {
      return { status: "FRAUD_REVIEW", reason: "Rafraîchissement anormal." };
    }
    return VALID;
  }

  return VALID;
}

/**
 * Rassemble les signaux en base, puis tranche.
 *
 * Deux requêtes au plus, et seulement pour les types d'événements qui coûtent
 * quelque chose : mesurer la fraude sur un `LOAD` reviendrait à payer une
 * requête pour protéger zéro centime.
 */
export async function assessEvent(input: {
  type: string;
  adId: string;
  pageViewId: string | null;
  sessionHash: string;
  userAgent: string | null | undefined;
  at: Date;
  /** WEB | MOBILE | EMAIL — l'e-mail ne se mesure pas comme une page. */
  platform?: string | null;
}): Promise<FraudVerdict> {
  const skipUserAgentCheck = input.platform === "EMAIL";

  if (input.type === "LOAD" || input.type === "RENDER") {
    return !skipUserAgentCheck && isBotUserAgent(input.userAgent)
      ? { status: "INVALID", reason: "Agent automatisé." }
      : VALID;
  }

  const hourAgo = new Date(input.at.getTime() - 3_600_000);

  if (input.type === "CLICK") {
    const [recent, lastClick, rendered] = await Promise.all([
      prisma.adEvent.findMany({
        where: {
          sessionHash: input.sessionHash,
          type: "CLICK",
          validationStatus: "VALID",
          createdAt: { gte: hourAgo },
        },
        select: { adId: true },
        take: 100,
      }),
      prisma.adEvent.findFirst({
        where: { sessionHash: input.sessionHash, adId: input.adId, type: "CLICK" },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      }),
      // L'affichage se cherche sur l'affichage de page, pas sur la session : un
      // clic doit venir de la page où la publicité était à l'écran, pas d'une
      // page ouverte dix minutes plus tôt dans un autre onglet.
      input.pageViewId
        ? prisma.adEvent.findFirst({
            where: {
              pageViewId: input.pageViewId,
              adId: input.adId,
              type: { in: ["RENDER", "LOAD", "VIEWABLE_IMPRESSION", "IMPRESSION"] },
            },
            select: { id: true },
          })
        : Promise.resolve(null),
    ]);

    return assessSignals(
      input.type,
      input.userAgent,
      {
      msSinceLastClickSameAd: lastClick ? input.at.getTime() - lastClick.createdAt.getTime() : null,
      clicksSessionLastHour: recent.length,
      clicksSameAdLastHour: recent.filter((r) => r.adId === input.adId).length,
      viewablesSameAdLastHour: 0,
      // Sans identifiant d'affichage de page — un pixel d'e-mail, une ancienne
      // version du client — on ne peut pas vérifier : on ne bloque pas sur une
      // information manquante, les autres règles restent en place.
      hasRenderOnPageView: input.pageViewId ? Boolean(rendered) : true,
      },
      { skipUserAgentCheck },
    );
  }

  const viewables = await prisma.adEvent.count({
    where: {
      sessionHash: input.sessionHash,
      adId: input.adId,
      type: { in: ["VIEWABLE_IMPRESSION", "IMPRESSION"] },
      validationStatus: "VALID",
      createdAt: { gte: hourAgo },
    },
  });

  return assessSignals(
    input.type,
    input.userAgent,
    {
      msSinceLastClickSameAd: null,
      clicksSessionLastHour: 0,
      clicksSameAdLastHour: 0,
      viewablesSameAdLastHour: viewables,
      hasRenderOnPageView: true,
    },
    { skipUserAgentCheck },
  );
}
