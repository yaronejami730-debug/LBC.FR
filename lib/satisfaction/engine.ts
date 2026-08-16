/**
 * Décide qui reçoit une demande d'avis, quand, et surtout : qui n'en reçoit pas.
 *
 * Le mécanisme central est le **délai entre la décision et l'envoi**. Atteindre
 * le seuil ne déclenche rien : cela ouvre une campagne `PENDING` dont l'envoi
 * est daté vingt-quatre heures plus tard. Pendant ce temps, toute nouvelle
 * activité du compte retombe sur la campagne déjà ouverte au lieu d'en créer une
 * autre — l'index unique partiel y veille en base, pas seulement dans ce code.
 *
 * Un vendeur qui met dix annonces en ligne le même matin reçoit donc un email,
 * et un seul, le lendemain. Sans compteur à maintenir, sans file à purger.
 *
 * Le second garde-fou est le silence de quatre-vingt-dix jours après tout envoi,
 * partagé par les deux déclencheurs : c'est lui qui empêche l'activité de venir
 * doubler une sollicitation périodique reçue la veille.
 */

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isEmailAllowed } from "@/lib/notifications/preferences";
import {
  SATISFACTION_CONFIG,
  OPEN_STATUSES,
  periodicDelayDays,
  type SatisfactionTrigger,
} from "./config";
import { getSatisfactionSettings, type SatisfactionSettings } from "./settings";

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;

export type Ineligibility =
  | "CAMPAIGN_OPEN"
  | "COOLDOWN"
  | "UNSUBSCRIBED"
  | "ACCOUNT_INELIGIBLE"
  | "ACCOUNT_TOO_YOUNG"
  | "THRESHOLD_NOT_MET"
  | "PERIODIC_NOT_DUE"
  | "DISABLED";

export type Eligibility =
  | { eligible: true; activityCount?: number }
  | { eligible: false; reason: Ineligibility };

/**
 * Le compte peut-il être sollicité, et pour ce motif ?
 *
 * Une seule fonction pour les deux déclencheurs : les règles anti-spam sont
 * communes, et les écrire deux fois garantirait qu'elles divergent le jour où
 * l'une des deux est modifiée.
 */
export async function isUserEligibleForSatisfaction(
  userId: string,
  trigger: SatisfactionTrigger,
  now = new Date(),
  /** Réglages du passage en cours. Relus si absents. */
  settings?: SatisfactionSettings,
): Promise<Eligibility> {
  const cfg = settings ?? (await getSatisfactionSettings());

  if (!cfg.enabled) return { eligible: false, reason: "DISABLED" };
  if (trigger === "PERIODIC" && !cfg.periodicEnabled) {
    return { eligible: false, reason: "DISABLED" };
  }
  if (trigger === "ACTIVITY" && !cfg.activityEnabled) {
    return { eligible: false, reason: "DISABLED" };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      role: true,
      emailVerified: true,
      bannedAt: true,
      restrictedAt: true,
      createdAt: true,
    },
  });

  if (
    !user ||
    !user.email ||
    user.role !== "USER" ||
    !user.emailVerified ||
    user.bannedAt ||
    user.restrictedAt
  ) {
    return { eligible: false, reason: "ACCOUNT_INELIGIBLE" };
  }

  const ageDays = (now.getTime() - user.createdAt.getTime()) / DAY_MS;
  if (ageDays < SATISFACTION_CONFIG.minAccountAgeDays) {
    return { eligible: false, reason: "ACCOUNT_TOO_YOUNG" };
  }

  // Une campagne déjà ouverte absorbe la nouvelle raison de solliciter : c'est
  // exactement le comportement voulu pour une rafale d'annonces.
  const open = await prisma.satisfactionCampaign.findFirst({
    where: { userId, status: { in: OPEN_STATUSES } },
    select: { id: true },
  });
  if (open) return { eligible: false, reason: "CAMPAIGN_OPEN" };

  const lastSent = await prisma.satisfactionCampaign.findFirst({
    where: { userId, sentAt: { not: null } },
    orderBy: { sentAt: "desc" },
    select: { sentAt: true },
  });

  if (lastSent?.sentAt) {
    const sinceDays = (now.getTime() - lastSent.sentAt.getTime()) / DAY_MS;
    // Le silence vaut pour les deux déclencheurs. C'est lui qui empêche une
    // salve d'annonces de doubler une sollicitation périodique de la veille.
    if (sinceDays < cfg.cooldownDays) {
      return { eligible: false, reason: "COOLDOWN" };
    }
    if (trigger === "PERIODIC" && sinceDays < periodicDelayDays(userId, cfg)) {
      return { eligible: false, reason: "PERIODIC_NOT_DUE" };
    }
  } else if (trigger === "PERIODIC") {
    // Jamais sollicité : on attend tout de même la durée périodique depuis
    // l'inscription, pour ne pas écrire au bout de quinze jours.
    if (ageDays < periodicDelayDays(userId, cfg)) {
      return { eligible: false, reason: "PERIODIC_NOT_DUE" };
    }
  }

  if (trigger === "ACTIVITY") {
    const count = await publishedListingCount(userId, lastSent?.sentAt ?? user.createdAt);
    if (count < cfg.activityThreshold) {
      return { eligible: false, reason: "THRESHOLD_NOT_MET" };
    }
    // Le consentement se vérifie en dernier : inutile d'interroger les
    // préférences d'un compte qui n'aurait rien reçu de toute façon.
    if (!(await isEmailAllowed(userId, "personalized").catch(() => true))) {
      return { eligible: false, reason: "UNSUBSCRIBED" };
    }
    return { eligible: true, activityCount: count };
  }

  if (!(await isEmailAllowed(userId, "personalized").catch(() => true))) {
    return { eligible: false, reason: "UNSUBSCRIBED" };
  }

  return { eligible: true };
}

/**
 * Annonces réellement publiées depuis une date.
 *
 * La source de vérité est la table `Listing`, pas un journal d'événements. Un
 * journal peut manquer une ligne — un envoi de tracking perdu, une exception
 * avalée — et le compte serait faux sans que personne ne le voie. Les annonces,
 * elles, sont la réalité que l'on cherche à mesurer.
 *
 * Sont exclus, conformément à ce qu'on veut compter — de vraies mises en
 * ligne : les brouillons (qui vivent dans `Draft`, pas ici), les annonces
 * supprimées, celles que la modération a refusées ou retirées, et celles qui
 * attendent encore d'être publiées.
 */
export async function publishedListingCount(userId: string, since: Date): Promise<number> {
  return prisma.listing.count({
    where: {
      userId,
      createdAt: { gte: since },
      deletedAt: null,
      status: "APPROVED",
    },
  });
}

export type OpenResult =
  | { created: true; campaignId: string; sendAfter: Date }
  | { created: false; reason: Ineligibility | "RACE" };

/**
 * Ouvre une campagne, ou explique pourquoi elle ne l'a pas été.
 *
 * L'insertion peut échouer sur l'index unique partiel si une autre exécution a
 * ouvert une campagne entre la vérification et l'écriture. Ce n'est pas une
 * erreur : c'est le mécanisme anti-doublon qui fonctionne. On le signale comme
 * `RACE` et on passe au compte suivant.
 */
export async function openCampaign(
  userId: string,
  trigger: SatisfactionTrigger,
  now = new Date(),
  settings?: SatisfactionSettings,
): Promise<OpenResult> {
  const cfg = settings ?? (await getSatisfactionSettings());
  const check = await isUserEligibleForSatisfaction(userId, trigger, now, cfg);
  if (!check.eligible) return { created: false, reason: check.reason };

  // Le délai de regroupement s'applique aux deux déclencheurs. Pour l'activité
  // il absorbe la rafale ; pour le périodique il étale les envois sur la
  // journée au lieu de les grouper à l'heure du planificateur.
  const sendAfter = new Date(now.getTime() + cfg.burstWindowHours * HOUR_MS);

  try {
    const campaign = await prisma.satisfactionCampaign.create({
      data: {
        userId,
        trigger,
        status: "PENDING",
        activityCount: check.activityCount ?? null,
        sendAfter,
      },
      select: { id: true },
    });
    return { created: true, campaignId: campaign.id, sendAfter };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { created: false, reason: "RACE" };
    }
    throw err;
  }
}

/**
 * Campagnes dont la fenêtre de regroupement est close.
 *
 * `sendAfter` passé signifie que plus rien ne viendra s'y ajouter : ce qui
 * devait être regroupé l'est.
 */
export async function dueCampaigns(limit: number, now = new Date()) {
  return prisma.satisfactionCampaign.findMany({
    where: { status: "PENDING", sendAfter: { lte: now } },
    orderBy: { sendAfter: "asc" },
    take: limit,
    select: {
      id: true,
      userId: true,
      trigger: true,
      activityCount: true,
      attempts: true,
      user: { select: { id: true, email: true, name: true, firstName: true } },
    },
  });
}

export { SATISFACTION_CONFIG };
