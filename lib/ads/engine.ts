/**
 * Moteur de sélection publicitaire.
 *
 * Un seul moteur pour le site et pour l'application : le client envoie un
 * contexte — emplacement, ville, catégorie, plateforme — et reçoit une
 * publicité accompagnée d'un jeton. Aucune règle de ciblage ne descend dans le
 * client, sans quoi le web et le mobile finiraient par facturer deux choses
 * différentes.
 *
 * Chaque appel est une **enchère** (`lib/ads/auction.ts`) : les campagnes
 * éligibles se présentent avec leur plafond et leur score qualité, une seule
 * est servie, et le prix qu'elle paiera est décidé ici, côté serveur, puis
 * scellé dans le jeton. Le navigateur transporte ce prix sans pouvoir le lire
 * ni le modifier — c'est la garantie qu'un clic ne coûtera jamais autre chose
 * que ce que l'enchère a décidé.
 *
 * Le jeton est ce qui sépare une régie d'un compteur : sans lui, n'importe qui
 * peut appeler la route de tracking en boucle et vider le budget d'un
 * annonceur. Signé, à durée courte, lié à un affichage précis.
 */
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { distanceKm } from "@/lib/geo/distance";
import { resolveLocation } from "@/lib/geo/communes";
import { normalizeToken } from "@/lib/seo/city";
import { isPlacement, type PlacementKey } from "./placements";
import { floorsOf, legacyBidCents, pricing, spentToday, startOfDayParis } from "./billing";
import { affinity, buildIntentProfile, type IntentProfile } from "./audience";
import { smartSuggestionsEnabled } from "./settings";
import { categoryIdFromListing } from "@/lib/recommendations/category-interest";
import { runAuction, type AuctionCandidate, type BillingModel } from "./auction";
import { objectiveMultiplier, performanceSnapshot } from "./performance";
import { recordAuction } from "./auction-stats";

const SECRET = process.env.AUTH_SECRET;
if (!SECRET) throw new Error("AUTH_SECRET missing");

/** Une minute : le temps qu'une publicité s'affiche, pas davantage. */
const TOKEN_LIFETIME_SECONDS = 60;

/**
 * Trente minutes pour le jeton d'un affichage web.
 *
 * Une impression se mesure dans la seconde, mais le reste du parcours prend le
 * temps qu'il prend : on lit une page, on revient, on clique, puis on appelle
 * le vendeur dix minutes plus tard. Un jeton d'une minute perdrait ces clics et
 * toutes les conversions — et l'annonceur ne verrait jamais ce que sa campagne
 * a réellement produit.
 *
 * Ce que cette durée n'ouvre pas : la fabrication d'impressions en boucle. La
 * déduplication porte l'affichage de page, et l'anti-fraude plafonne le nombre
 * d'affichages d'un même créatif pour une même session.
 */
const CLICK_TOKEN_LIFETIME_SECONDS = 1800;

/**
 * Trente jours pour l'e-mail.
 *
 * Un message n'est pas une page : il est ouvert le soir, le lendemain, parfois
 * trois semaines plus tard. Un jeton d'une minute ferait tomber toutes ces
 * ouvertures — et l'annonceur ne verrait jamais l'inventaire qu'il a payé.
 */
const EMAIL_TOKEN_LIFETIME_SECONDS = 30 * 24 * 3600;

export type AdRequestContext = {
  placement: PlacementKey;
  /** Ville du visiteur, telle qu'il l'a choisie ou telle que résolue. */
  city?: string | null;
  category?: string | null;
  platform: "WEB" | "MOBILE" | "EMAIL";
  /** Compte connecté : ouvre l'accès à ses intérêts catégoriels déjà calculés. */
  userId?: string | null;
  /** Catégories récemment parcourues, remontées par le navigateur. */
  recentCategories?: string[];
  /** Mots-clés de la visite entrante (`utm_term`, requête d'arrivée). */
  landingKeywords?: string[];
  /** Créatifs déjà affichés sur cette page : à éviter si autre chose existe. */
  excludeAdIds?: string[];
  /** Tranche d'âge déclarée du visiteur, quand elle est réellement connue. */
  ageRange?: string | null;
};

export type ServedAd = {
  adId: string;
  campaignId: string;
  title: string;
  description: string;
  imageUrl: string;
  imageUrlWide: string | null;
  ctaLabel: string;
  destinationUrl: string | null;
  listingId: string | null;
  placement: PlacementKey;
  /** À renvoyer tel quel sur `/api/ads/event`. */
  token: string;
};

// ── Jeton d'affichage ───────────────────────────────────────────────────────

type TokenPayload = {
  adId: string;
  campaignId: string;
  placement: string;
  citySlug: string | null;
  platform: string;
  /** Enchère qui a produit cet affichage. */
  auctionId: string;
  /** Prix décidé par l'enchère, en centimes. Jamais recalculé côté client. */
  priceCents: number;
  /** Plafond consenti par l'annonceur, conservé pour la traçabilité. */
  bidCents: number;
  model: BillingModel;
  qualityScore: number;
  adRank: number;
  exp: number;
};

export type AdToken = TokenPayload;

export function signAdToken(
  payload: Omit<TokenPayload, "exp">,
  lifetimeSeconds = TOKEN_LIFETIME_SECONDS,
): string {
  const body = {
    ...payload,
    exp: Math.floor(Date.now() / 1000) + lifetimeSeconds,
  };
  const encoded = Buffer.from(JSON.stringify(body)).toString("base64url");
  const sig = createHmac("sha256", SECRET!).update(encoded).digest("base64url");
  return `${encoded}.${sig}`;
}

export function verifyAdToken(token: string): TokenPayload | null {
  const [encoded, sig] = token.split(".");
  if (!encoded || !sig) return null;

  const expected = createHmac("sha256", SECRET!).update(encoded).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as TokenPayload;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

// ── Rotation ────────────────────────────────────────────────────────────────

/**
 * Tirage reproductible, semé par l'emplacement et le quart d'heure.
 *
 * L'enchère décide qui est servi ; il reste à choisir *quel visuel* d'une même
 * campagne, et à départager deux rangs identiques. La graine contient
 * l'emplacement — deux encarts d'une page divergent — et une tranche de cinq
 * minutes — un même encart reste stable le temps d'une visite.
 */
function seed(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function rotationSlot(): number {
  return Math.floor(Date.now() / (5 * 60_000));
}

/** Générateur déterministe (mulberry32), suffisant pour répartir un inventaire. */
function seededRandom(s: number): () => number {
  let a = s;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let x = Math.imul(a ^ (a >>> 15), 1 | a);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Inventaire servable ─────────────────────────────────────────────────────

type CachedAd = {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  imageUrlWide: string | null;
  ctaLabel: string;
  destinationUrl: string | null;
  listingId: string | null;
  qualityScore: number;
};

type CachedCampaign = {
  id: string;
  advertiserId: string;
  objective: string;
  /** Solde de l'annonceur au moment du chargement du cache. */
  balanceCents: number;
  suspended: boolean;
  /** Diffusion offerte : ni solde requis, ni débit. */
  billingDisabled: boolean;
  dailyBudgetCents: number;
  totalBudgetCents: number;
  spentCents: number;
  maxBidCents: number;
  billingModel: BillingModel;
  categories: string[];
  audienceAges: string[];
  smartTargeting: boolean;
  placements: string[];
  zones: { lat: number; lng: number; radiusKm: number; citySlug: string }[];
  ads: CachedAd[];
};

let cache: { at: number; campaigns: CachedCampaign[] } | null = null;
/** 30 s : assez court pour qu'une campagne suspendue disparaisse vite, assez
 *  long pour qu'un pic de trafic ne se traduise pas en pic de requêtes. */
const CACHE_MS = 30_000;

async function servableCampaigns(): Promise<CachedCampaign[]> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.campaigns;

  const now = new Date();
  const rows = await prisma.adCampaign.findMany({
    where: {
      status: "ACTIVE",
      startAt: { lte: now },
      endAt: { gte: now },
      ads: { some: { isActive: true } },
    },
    select: {
      id: true,
      advertiserId: true,
      objective: true,
      advertiser: { select: { balanceCents: true, suspendedAt: true, billingDisabledAt: true } },
      billingExemptAt: true,
      dailyBudgetCents: true,
      totalBudgetCents: true,
      spentCents: true,
      maxBidCents: true,
      billingModel: true,
      categories: true,
      audienceAges: true,
      smartTargeting: true,
      placements: { select: { placement: true } },
      zones: { select: { lat: true, lng: true, radiusKm: true, citySlug: true } },
      ads: {
        where: { isActive: true },
        select: {
          id: true,
          title: true,
          description: true,
          imageUrl: true,
          imageUrlWide: true,
          ctaLabel: true,
          destinationUrl: true,
          listingId: true,
          qualityScore: true,
        },
      },
    },
    take: 500,
  });

  const campaigns: CachedCampaign[] = rows.map((c) => ({
    id: c.id,
    advertiserId: c.advertiserId,
    objective: c.objective,
    balanceCents: c.advertiser.balanceCents,
    suspended: Boolean(c.advertiser.suspendedAt),
    // Deux exonérations, une seule conséquence : la campagne est diffusée sans
    // rien débiter. L'une couvre tout un compte, l'autre une campagne précise —
    // un lancement offert à un annonceur qui paie ses trois autres campagnes.
    billingDisabled: Boolean(c.advertiser.billingDisabledAt) || Boolean(c.billingExemptAt),
    dailyBudgetCents: c.dailyBudgetCents,
    totalBudgetCents: c.totalBudgetCents,
    spentCents: c.spentCents,
    maxBidCents: c.maxBidCents,
    billingModel: (c.billingModel === "CPM" ? "CPM" : "CPC") as BillingModel,
    categories: parseList(c.categories),
    audienceAges: parseList(c.audienceAges),
    smartTargeting: c.smartTargeting,
    placements: c.placements.map((p) => p.placement),
    zones: c.zones,
    ads: c.ads,
  }));

  cache = { at: Date.now(), campaigns };
  return campaigns;
}

/** Vide le cache — appelé après une décision de modération ou un arrêt budget. */
export function invalidateAdCache(): void {
  cache = null;
}

function parseList(raw: string): string[] {
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}

/**
 * La campagne couvre-t-elle l'endroit d'où vient le visiteur ?
 *
 * Sans zone, la campagne est nationale. Sans ville connue côté visiteur, une
 * campagne ciblée ne s'affiche pas : mieux vaut ne rien servir que facturer
 * une impression hors zone.
 */
function coversCity(
  campaign: CachedCampaign,
  city: { lat: number; lng: number; slug: string } | null,
): boolean {
  if (campaign.zones.length === 0) return true;
  if (!city) return false;

  return campaign.zones.some((z) =>
    z.radiusKm > 0
      ? distanceKm({ lat: z.lat, lng: z.lng }, { lat: city.lat, lng: city.lng }) <= z.radiusKm
      : z.citySlug === city.slug,
  );
}

/**
 * L'âge du visiteur entre-t-il dans la cible ?
 *
 * Une campagne sans tranche visée touche tout le monde. Une campagne qui en a
 * choisi une n'est **pas** écartée quand l'âge est inconnu : Deal&Co ne demande
 * pas de date de naissance, et refuser de servir faute d'une donnée qu'on ne
 * collecte pas viderait l'inventaire. La tranche affine quand elle est connue,
 * elle ne prétend pas à une précision qui n'existe pas.
 */
function matchesAge(campaign: CachedCampaign, ageRange: string | null | undefined): boolean {
  if (campaign.audienceAges.length === 0) return true;
  if (!ageRange) return true;
  return campaign.audienceAges.includes(ageRange);
}

// ── Sélection ───────────────────────────────────────────────────────────────

/**
 * Choisit la publicité à servir, et le prix qu'elle paiera.
 *
 * L'ordre des contrôles n'est pas indifférent : tout ce qui écarte une campagne
 * sans requête (statut, emplacement, zone, budget total) passe avant ce qui
 * coûte une lecture (dépense du jour), et l'enchère ne voit que des candidats
 * réellement servables. Faire l'inverse reviendrait à classer des campagnes
 * pour découvrir ensuite qu'aucune n'avait le droit d'être là.
 */
export async function selectAd(ctx: AdRequestContext): Promise<ServedAd | null> {
  if (!isPlacement(ctx.placement)) return null;

  // Emplacement fermé depuis l'administration : il cesse d'être servi, sinon
  // « fermer à la vente » ne ferait que retirer une case dans un formulaire
  // pendant que les campagnes déjà créées continueraient de tourner.
  const grid = await pricing();
  const gridRow = grid.get(ctx.placement);
  if (gridRow?.isOpen === false) return null;
  const floors = floorsOf(gridRow);

  // Une seule résolution par requête : `resolveLocation` couvre les 35 000
  // communes et retombe sur le département si le libellé est approximatif.
  const resolved = ctx.city ? resolveLocation(ctx.city) : null;
  const city = resolved
    ? { lat: resolved.lat, lng: resolved.lng, slug: normalizeToken(resolved.city) }
    : null;

  const contextCategoryId = ctx.category ? categoryIdFromListing(ctx.category) : null;
  const rand = seededRandom(seed(`${ctx.placement}|${rotationSlot()}`));
  const excluded = new Set(ctx.excludeAdIds ?? []);

  const campaigns = await servableCampaigns();

  // ── Éligibilité ──────────────────────────────────────────────────────────
  const eligible = campaigns.filter((c) => {
    if (!c.placements.includes(ctx.placement)) return false;
    // Compte suspendu : on ne sert pas quelqu'un dont l'accès a été coupé.
    if (c.suspended) return false;
    // Portefeuille vide : on ne sert pas à crédit — sauf gratuité déclarée, où
    // le solde ne veut plus rien dire tant qu'elle dure.
    if (!c.billingDisabled && c.balanceCents <= 0) return false;
    // Budget total épuisé : la campagne ne doit plus rien coûter à personne.
    if (c.spentCents >= c.totalBudgetCents) return false;
    // Comparaison sur l'identifiant de catalogue : le contexte arrive tantôt en
    // libellé (« Véhicules », tel qu'il est stocké sur l'annonce), tantôt en
    // identifiant (« vehicules », tel qu'il circule dans les URLs).
    if (c.categories.length > 0 && contextCategoryId) {
      const targeted = c.categories.map((v) => categoryIdFromListing(v) ?? v);
      if (!targeted.includes(contextCategoryId)) return false;
    }
    if (!matchesAge(c, ctx.ageRange)) return false;
    if (!coversCity(c, city)) return false;
    return c.ads.length > 0;
  });

  if (eligible.length === 0) return null;

  // ── Plafond du jour ──────────────────────────────────────────────────────
  // Une seule agrégation pour tous les candidats : une requête par campagne
  // multipliait le coût d'un affichage par le nombre d'annonceurs actifs.
  const withinDay = await filterByDailyBudget(eligible);
  if (withinDay.length === 0) return null;

  // ── Enchère ──────────────────────────────────────────────────────────────
  const perf = await performanceSnapshot();
  const smart = await smartSuggestionsEnabled();
  const profile: IntentProfile | null =
    smart && withinDay.some((c) => c.smartTargeting)
      ? await buildIntentProfile({
          userId: ctx.userId,
          contextCategory: ctx.category,
          recentCategories: ctx.recentCategories,
          landingKeywords: ctx.landingKeywords,
        })
      : null;

  const candidates: (AuctionCandidate & { campaign: CachedCampaign; ad: CachedAd })[] = [];

  for (const campaign of withinDay) {
    // Un créatif par campagne : c'est la campagne qui enchérit, pas chacun de
    // ses visuels. On présente le meilleur que la page n'a pas déjà montré —
    // sinon un annonceur seul à l'enchère verrait le même encart deux fois.
    const unseen = campaign.ads.filter((a) => !excluded.has(a.id));
    const pool = unseen.length > 0 ? unseen : campaign.ads;
    const best = pickCreative(pool, rand);
    if (!best) continue;

    const bid =
      campaign.maxBidCents > 0
        ? campaign.maxBidCents
        : legacyBidCents(campaign.billingModel, gridRow);

    // Pertinence : l'intention du visiteur quand la diffusion suggérée est
    // active, et l'objectif de la campagne dans tous les cas. Les deux
    // multiplient, aucun ne remplace l'enchère.
    const intent = profile && campaign.smartTargeting ? 0.7 + affinity(campaign.categories, profile) * 0.6 : 1;
    const objective = objectiveMultiplier({
      objective: campaign.objective,
      placement: ctx.placement,
      campaignId: campaign.id,
      snapshot: perf,
    });
    // Un créatif déjà à l'écran sur cette page passe derrière, sans être exclu :
    // l'interdire viderait la page quand un seul annonceur est en lice.
    const freshness = unseen.length > 0 ? 1 : 0.75;

    candidates.push({
      campaignId: campaign.id,
      adId: best.id,
      maxBidCents: bid,
      qualityScore: best.qualityScore,
      billingModel: campaign.billingModel,
      relevance: intent * objective * freshness,
      observedCtr: perf.byAd.get(best.id)?.ctr ?? null,
      campaign,
      ad: best,
    });
  }

  if (candidates.length === 0) return null;

  const result = runAuction(candidates, floors, { baselineCtr: perf.baselineCtr });

  // Compteurs d'enchères : ce qui permettra de dire à un annonceur qu'il perd
  // parce que son plafond est bas, et non parce que le trafic a baissé.
  recordAuction({
    placement: ctx.placement,
    entrants: candidates.map((c) => ({ campaignId: c.campaignId })),
    winner: result ? { campaignId: result.winner.campaignId, adRank: result.adRank } : null,
  });

  if (!result) return null;

  const won = candidates.find((c) => c.adId === result.winner.adId)!;
  const ad = won.ad;

  return {
    adId: ad.id,
    campaignId: won.campaignId,
    title: ad.title,
    description: ad.description,
    imageUrl: ad.imageUrl,
    imageUrlWide: ad.imageUrlWide,
    ctaLabel: ad.ctaLabel,
    destinationUrl: ad.destinationUrl,
    listingId: ad.listingId,
    placement: ctx.placement,
    token: signAdToken(
      {
        adId: ad.id,
        campaignId: won.campaignId,
        placement: ctx.placement,
        citySlug: city?.slug ?? null,
        platform: ctx.platform,
        auctionId: result.auctionId,
        priceCents: result.priceCents,
        bidCents: won.maxBidCents,
        model: won.billingModel,
        qualityScore: ad.qualityScore,
        adRank: Math.round(result.adRank * 100) / 100,
      },
      ctx.platform === "EMAIL" ? EMAIL_TOKEN_LIFETIME_SECONDS : CLICK_TOKEN_LIFETIME_SECONDS,
    ),
  };
}

/**
 * Meilleur créatif d'une campagne : le mieux noté, à égalité près.
 *
 * Le tirage ne départage que les scores identiques — ce qui est le cas normal
 * d'une campagne neuve, dont tous les visuels partent à 70. Sans lui, le
 * premier créatif enregistré prendrait toute la diffusion et les autres ne
 * seraient jamais évalués.
 */
function pickCreative(pool: CachedAd[], rand: () => number): CachedAd | null {
  if (pool.length === 0) return null;
  const best = Math.max(...pool.map((a) => a.qualityScore));
  const top = pool.filter((a) => a.qualityScore === best);
  return top[Math.floor(rand() * top.length) % top.length];
}

/**
 * Écarte les campagnes ayant consommé leur plafond du jour.
 *
 * Vérifié au moment de servir, pas seulement à l'écriture de l'événement :
 * c'est ce qui empêche de dépasser le plafond au lieu de le constater. Les
 * campagnes offertes ne sont pas concernées — sans débit, il n'y a pas de
 * plafond à tenir.
 */
async function filterByDailyBudget(campaigns: CachedCampaign[]): Promise<CachedCampaign[]> {
  const billable = campaigns.filter((c) => !c.billingDisabled);
  if (billable.length === 0) return campaigns;

  const spend = await prisma.adEvent.groupBy({
    by: ["campaignId"],
    where: {
      campaignId: { in: billable.map((c) => c.id) },
      billingStatus: "BILLED",
      createdAt: { gte: startOfDayParis() },
    },
    _sum: { costCents: true },
  });

  const spentByCampaign = new Map(spend.map((s) => [s.campaignId, s._sum.costCents ?? 0]));
  return campaigns.filter(
    (c) => c.billingDisabled || (spentByCampaign.get(c.id) ?? 0) < c.dailyBudgetCents,
  );
}

/** Identifiant d'affichage de page, quand le client n'en fournit pas. */
export function newPageViewId(): string {
  return randomUUID();
}

/** Ré-export : la dépense du jour est lue au même endroit par tout le monde. */
export { spentToday };
