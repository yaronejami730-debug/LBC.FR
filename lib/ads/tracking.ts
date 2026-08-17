/**
 * Enregistrement des événements publicitaires.
 *
 * Deux protections, et elles ne font pas le même travail :
 *
 *  - **le jeton** prouve que l'événement vient d'une publicité réellement
 *    servie par le moteur. Sans lui, une boucle sur la route de tracking vide
 *    le budget d'un annonceur en quelques secondes ;
 *  - **l'empreinte de déduplication** empêche de compter deux fois le même
 *    affichage. Un visiteur qui rafraîchit, un composant qui se remonte, une
 *    requête rejouée par le réseau : c'est le même événement, il ne se facture
 *    qu'une fois.
 *
 * L'empreinte porte la minute : deux impressions du même créatif au même
 * endroit dans la même minute sont considérées identiques. C'est volontaire —
 * personne ne voit deux fois une bannière en soixante secondes, mais un
 * script, si.
 */
import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { verifyAdToken } from "./engine";
import { chargeEvent, eventCost, pricing } from "./billing";

/**
 * La campagne appartient-elle à un annonceur en gratuité ?
 *
 * Lecture par campagne, mise en cache très court : la question se pose à chaque
 * événement, et la réponse ne change qu'au moment où quelqu'un clique sur
 * « réactiver le portefeuille ».
 */
const freeCache = new Map<string, { at: number; free: boolean }>();
const FREE_TTL_MS = 30_000;

async function isBillingDisabled(campaignId: string): Promise<boolean> {
  const cached = freeCache.get(campaignId);
  if (cached && Date.now() - cached.at < FREE_TTL_MS) return cached.free;

  const row = await prisma.adCampaign
    .findUnique({
      where: { id: campaignId },
      select: { advertiser: { select: { billingDisabledAt: true } } },
    })
    .catch(() => null);

  const free = Boolean(row?.advertiser.billingDisabledAt);
  freeCache.set(campaignId, { at: Date.now(), free });
  return free;
}

export type EventType = "IMPRESSION" | "CLICK" | "CONVERSION";

/** Empreinte stable d'un événement. */
function dedupKey(input: {
  type: EventType;
  adId: string;
  placement: string;
  sessionId: string;
  at: Date;
}): string {
  // Minute tronquée : la granularité de la déduplication.
  const minute = Math.floor(input.at.getTime() / 60_000);
  return createHash("sha256")
    .update(`${input.type}|${input.adId}|${input.placement}|${input.sessionId}|${minute}`)
    .digest("base64url")
    .slice(0, 40);
}

export type RecordResult = { recorded: boolean; duplicate: boolean; destination?: string | null };

/**
 * Écrit un événement à partir du jeton remis lors de la sélection.
 *
 * Renvoie `duplicate: true` sans écrire quand l'empreinte existe déjà — la
 * base tranche, aucune lecture préalable n'est nécessaire, donc aucune fenêtre
 * de concurrence entre deux requêtes simultanées.
 */
export async function recordAdEvent(input: {
  type: EventType;
  token: string;
  /** Identifiant d'affichage fourni par le client : anonyme, éphémère. */
  sessionId: string;
}): Promise<RecordResult> {
  const payload = verifyAdToken(input.token);
  if (!payload) return { recorded: false, duplicate: false };

  // Prix du jour pour cet emplacement. Un événement non facturable — une
  // impression sur une campagne au clic — s'enregistre quand même : il compte
  // dans les statistiques, pas dans la facture.
  const grid = await pricing();
  // Gratuité déclarée : l'événement compte dans les statistiques — l'annonceur
  // doit voir ce que sa campagne produit — mais il ne coûte rien. On enregistre
  // donc un coût nul plutôt que de sauter l'écriture.
  const free = await isBillingDisabled(payload.campaignId);
  const costCents = free ? 0 : eventCost(input.type, grid.get(payload.placement));

  const at = new Date();
  const key = dedupKey({
    type: input.type,
    adId: payload.adId,
    placement: payload.placement,
    sessionId: input.sessionId,
    at,
  });

  try {
    await prisma.adEvent.create({
      data: {
        type: input.type,
        campaignId: payload.campaignId,
        adId: payload.adId,
        placement: payload.placement,
        // Commune, jamais coordonnées : le ciblage n'a pas besoin de plus, donc
        // on ne conserve pas plus.
        citySlug: payload.citySlug,
        platform: payload.platform,
        dedupKey: key,
        costCents,
      },
    });
  } catch {
    // Contrainte d'unicité : déjà compté, donc déjà facturé.
    return { recorded: false, duplicate: true };
  }

  // Imputation après écriture : on ne facture que ce qui a survécu à la
  // déduplication.
  await chargeEvent({ campaignId: payload.campaignId, costCents });

  return { recorded: true, duplicate: false };
}

/**
 * Destination d'un clic, relue côté serveur.
 *
 * Le client ne dit jamais où il va : il donne son jeton, le serveur retrouve
 * le créatif et renvoie l'URL enregistrée. Sans cela, un lien fabriqué
 * enverrait les visiteurs de Deal&Co n'importe où sous couvert de publicité.
 */
export async function clickDestination(token: string): Promise<string | null> {
  const payload = verifyAdToken(token);
  if (!payload) return null;

  const ad = await prisma.ad.findUnique({
    where: { id: payload.adId },
    select: { destinationUrl: true, listingId: true },
  });
  if (!ad) return null;

  if (ad.listingId) return `/annonce/${ad.listingId}`;
  return ad.destinationUrl;
}
