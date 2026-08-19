/**
 * Enregistrement des événements publicitaires.
 *
 * Le chemin d'un euro dépensé passe entièrement par ce fichier :
 *
 *     jeton signé → déduplication → visibilité → anti-fraude → écriture →
 *     facturation → portefeuille
 *
 * Chaque étape peut arrêter la suivante, et aucune ne peut être court-circuitée
 * par le navigateur. Le client sait dire « j'ai vu cette publicité » ; c'est le
 * serveur qui dit « cet événement est valide, il vaut 63 centimes, et voici la
 * ligne de portefeuille correspondante ».
 *
 * Quatre protections, et elles ne font pas le même travail :
 *
 *  - **le jeton** prouve que l'événement vient d'une publicité réellement
 *    servie par le moteur, et transporte le prix décidé par l'enchère. Sans
 *    lui, une boucle sur la route de tracking vide le budget d'un annonceur ;
 *  - **l'empreinte de déduplication** empêche de compter deux fois le même
 *    affichage. Elle porte l'affichage de page : scroller vers un encart, puis
 *    ailleurs, puis revenir ne facture qu'une fois — mais deux encarts
 *    réellement visibles sur la même page comptent bien pour deux ;
 *  - **la mesure de visibilité** est revalidée serveur : une publicité chargée
 *    n'est pas une publicité vue ;
 *  - **l'anti-fraude** écarte ce qui est authentique mais non humain.
 */
import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { verifyAdToken, type AdToken } from "./engine";
import { chargeEvent } from "./billing";
import { billableCost } from "./auction";
import { assessViewability } from "./viewability";
import { assessEvent, type ValidationStatus } from "./fraud";

export type EventType =
  | "LOAD"
  | "RENDER"
  | "VIEWABLE_IMPRESSION"
  | "CLICK"
  | "CONVERSION";

export const EVENT_TYPES: EventType[] = [
  "LOAD",
  "RENDER",
  "VIEWABLE_IMPRESSION",
  "CLICK",
  "CONVERSION",
];

export function isEventType(value: unknown): value is EventType {
  return typeof value === "string" && (EVENT_TYPES as string[]).includes(value);
}

/**
 * La campagne est-elle exonérée de facturation ?
 *
 * Deux niveaux, une seule conséquence : l'exonération du compte entier, posée
 * sur l'annonceur, et celle d'une campagne précise, posée par la régie avant le
 * lancement. La campagne est diffusée et mesurée normalement — seul le débit
 * est suspendu, et l'annonceur le sait avant de lancer.
 *
 * Relu ici et non porté par le jeton : la régie doit pouvoir rétablir la
 * facturation à midi et que cela prenne effet à midi, pas à l'expiration des
 * jetons déjà distribués.
 */
const exemptCache = new Map<string, { at: number; exempt: boolean }>();
const EXEMPT_TTL_MS = 30_000;

async function isBillingExempt(campaignId: string): Promise<boolean> {
  const cached = exemptCache.get(campaignId);
  if (cached && Date.now() - cached.at < EXEMPT_TTL_MS) return cached.exempt;

  const row = await prisma.adCampaign
    .findUnique({
      where: { id: campaignId },
      select: {
        billingExemptAt: true,
        advertiser: { select: { billingDisabledAt: true } },
      },
    })
    .catch(() => null);

  const exempt = Boolean(row?.billingExemptAt) || Boolean(row?.advertiser.billingDisabledAt);
  exemptCache.set(campaignId, { at: Date.now(), exempt });
  return exempt;
}

/** Purge — appelée quand la régie active ou coupe une exonération. */
export function invalidateExemptCache(campaignId?: string): void {
  if (campaignId) exemptCache.delete(campaignId);
  else exemptCache.clear();
}

/**
 * Pseudonymisation de l'identifiant d'affichage.
 *
 * Le client envoie une valeur éphémère de son cru ; on n'en conserve qu'une
 * empreinte. Suffisant pour dédupliquer et repérer une cadence anormale,
 * inutilisable pour reconstituer une navigation.
 */
export function sessionHashOf(sessionId: string): string {
  return createHash("sha256").update(`ad-session|${sessionId}`).digest("base64url").slice(0, 32);
}

/**
 * Empreinte stable d'un événement.
 *
 * L'unité n'est pas la page mais **l'encart d'une page** : deux publicités
 * réellement visibles en même temps produisent deux impressions, c'est le
 * comportement attendu. En revanche le même encart, sur le même affichage de
 * page, ne compte qu'une fois quoi qu'il arrive au scroll.
 *
 * Sans identifiant d'affichage de page — pixel d'e-mail, ancien client — on
 * retombe sur la minute tronquée : moins fin, mais toujours borné.
 */
function dedupKey(input: {
  type: EventType;
  adId: string;
  placement: string;
  sessionHash: string;
  pageViewId: string | null;
  at: Date;
}): string {
  const scope = input.pageViewId ?? `minute:${Math.floor(input.at.getTime() / 60_000)}`;
  return createHash("sha256")
    .update(`${input.type}|${input.adId}|${input.placement}|${input.sessionHash}|${scope}`)
    .digest("base64url")
    .slice(0, 40);
}

export type RecordInput = {
  type: EventType;
  token: string;
  /** Identifiant d'affichage fourni par le client : anonyme, éphémère. */
  sessionId: string;
  /** Identifiant d'affichage de page, une valeur par chargement. */
  pageViewId?: string | null;
  /** Mesure de visibilité, pour une impression visible. */
  viewportPct?: number | null;
  visibleMs?: number | null;
  userAgent?: string | null;
  /** Nature de la conversion : PHONE | EMAIL | MESSAGE | FORM | BOOKING. */
  conversionType?: string | null;
};

export type RecordResult = {
  recorded: boolean;
  duplicate: boolean;
  /** Statut retenu — l'annonceur voit ce qui a été écarté et pourquoi. */
  status?: ValidationStatus;
  reason?: string;
  /** Montant réellement facturé, en centimes. */
  costCents?: number;
  destination?: string | null;
};

/**
 * Écrit un événement à partir du jeton remis lors de la sélection.
 *
 * Renvoie `duplicate: true` sans écrire quand l'empreinte existe déjà — la
 * base tranche, aucune lecture préalable n'est nécessaire, donc aucune fenêtre
 * de concurrence entre deux requêtes simultanées.
 */
export async function recordAdEvent(input: RecordInput): Promise<RecordResult> {
  const payload = verifyAdToken(input.token);
  if (!payload) return { recorded: false, duplicate: false, reason: "Jeton invalide ou expiré." };

  const at = new Date();
  const sessionHash = sessionHashOf(input.sessionId);
  const pageViewId = input.pageViewId ? String(input.pageViewId).slice(0, 64) : null;

  // ── Visibilité ───────────────────────────────────────────────────────────
  let status: ValidationStatus = "VALID";
  let reason: string | undefined;
  let viewportPct: number | null = null;
  let visibleMs: number | null = null;

  if (input.type === "VIEWABLE_IMPRESSION") {
    const verdict = assessViewability({
      viewportPct: Number(input.viewportPct ?? 0),
      visibleMs: Number(input.visibleMs ?? 0),
    });
    viewportPct = verdict.viewportPct;
    visibleMs = verdict.visibleMs;
    if (!verdict.viewable) {
      // Conservé, jamais facturé : c'est ce qui permet de montrer à
      // l'annonceur la part de son inventaire qui n'atteint pas l'écran, au
      // lieu de la faire disparaître.
      status = "INVALID";
      reason = verdict.reason;
    }
  }

  // ── Anti-fraude ──────────────────────────────────────────────────────────
  if (status === "VALID") {
    const verdict = await assessEvent({
      type: input.type,
      adId: payload.adId,
      pageViewId,
      sessionHash,
      userAgent: input.userAgent,
      at,
      platform: payload.platform,
    });
    status = verdict.status;
    reason = verdict.reason;
  }

  // ── Prix ─────────────────────────────────────────────────────────────────
  // Le prix vient du jeton, donc de l'enchère, donc du serveur. L'exonération
  // est relue en base pour qu'une décision de la régie prenne effet tout de
  // suite. Un événement écarté ne coûte rien, par construction.
  const exempt = await isBillingExempt(payload.campaignId);
  const costCents =
    status === "VALID" && !exempt
      ? billableCost(input.type, payload.model ?? "CPC", payload.priceCents ?? 0)
      : 0;

  const key = dedupKey({
    type: input.type,
    adId: payload.adId,
    placement: payload.placement,
    sessionHash,
    pageViewId,
    at,
  });

  let event: { id: string };
  try {
    event = await prisma.adEvent.create({
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
        costCents: 0,
        viewportPct,
        visibleMs,
        pageViewId,
        sessionHash,
        validationStatus: status,
        invalidReason: reason ?? null,
        billingStatus: "NONE",
        auctionId: payload.auctionId ?? null,
        bidCents: payload.bidCents ?? null,
        priceCents: payload.priceCents ?? null,
        qualityScore: payload.qualityScore ?? null,
        adRank: payload.adRank ?? null,
        conversionType: input.conversionType ? String(input.conversionType).slice(0, 20) : null,
      },
      select: { id: true },
    });
  } catch {
    // Contrainte d'unicité : déjà compté, donc déjà facturé si facturable.
    return { recorded: false, duplicate: true, status, reason: "Événement déjà enregistré." };
  }

  if (costCents <= 0) {
    return { recorded: true, duplicate: false, status, reason, costCents: 0 };
  }

  // Imputation après écriture : on ne facture que ce qui a survécu à la
  // déduplication **et** aux contrôles. `chargeEvent` inscrit le coût sur
  // l'événement, débite le portefeuille une seule fois grâce à sa clé
  // d'idempotence, et arrête la campagne si un plafond est atteint.
  await chargeEvent({ campaignId: payload.campaignId, adEventId: event.id, costCents });

  return { recorded: true, duplicate: false, status, reason, costCents };
}

/**
 * Destination d'un clic, relue côté serveur.
 *
 * Le client ne dit jamais où il va : il donne son jeton, le serveur retrouve
 * le créatif et renvoie l'URL enregistrée. Sans cela, un lien fabriqué
 * enverrait les visiteurs de Deal&Co n'importe où sous couvert de publicité.
 */
export async function clickDestination(token: string): Promise<string | null> {
  const payload: AdToken | null = verifyAdToken(token);
  if (!payload) return null;

  const ad = await prisma.ad.findUnique({
    where: { id: payload.adId },
    select: { destinationUrl: true, listingId: true },
  });
  if (!ad) return null;

  if (ad.listingId) return `/annonce/${ad.listingId}`;
  return ad.destinationUrl;
}
