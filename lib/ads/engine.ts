/**
 * Moteur de sélection publicitaire.
 *
 * Un seul moteur pour le site et pour l'application : le client envoie un
 * contexte — emplacement, ville, catégorie, plateforme — et reçoit une
 * publicité accompagnée d'un jeton d'impression. Aucune règle de ciblage ne
 * descend dans le client, sans quoi le web et le mobile finiraient par
 * facturer deux choses différentes.
 *
 * Le jeton est ce qui sépare une régie d'un compteur : sans lui, n'importe qui
 * peut appeler la route de tracking en boucle et vider le budget d'un
 * annonceur. Signé, à usage unique, valable une minute.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { distanceKm } from "@/lib/geo/distance";
import { resolveLocation } from "@/lib/geo/communes";
import { normalizeToken } from "@/lib/seo/city";
import { isPlacement, type PlacementKey } from "./placements";
import { pricing, withinDailyBudget } from "./billing";
import { affinity, buildIntentProfile, type IntentProfile } from "./audience";
import { smartSuggestionsEnabled } from "./settings";
import { categoryIdFromListing } from "@/lib/recommendations/category-interest";

const SECRET = process.env.AUTH_SECRET;
if (!SECRET) throw new Error("AUTH_SECRET missing");

/** Une minute : le temps qu'une publicité s'affiche, pas davantage. */
const TOKEN_LIFETIME_SECONDS = 60;

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
  /** À renvoyer tel quel sur `/api/ads/impression` puis `/api/ads/click`. */
  token: string;
};

// ── Jeton d'impression ──────────────────────────────────────────────────────

type TokenPayload = {
  adId: string;
  campaignId: string;
  placement: string;
  citySlug: string | null;
  platform: string;
  exp: number;
};

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
 * Deux exigences qui semblent s'opposer : chaque emplacement doit montrer autre
 * chose que son voisin — sinon la même bannière occupe la page entière et
 * lasse en deux visites — mais un même emplacement ne doit pas changer de
 * publicité à chaque re-rendu, sans quoi l'impression déjà comptée ne
 * correspond plus à ce qui est affiché.
 *
 * La graine résout les deux : elle contient l'emplacement, donc deux encarts
 * d'une même page divergent ; et une tranche de cinq minutes, donc l'affichage
 * est stable le temps d'une visite, puis tourne.
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

/**
 * Tirage sans remise, pondéré.
 *
 * Le poids est le budget quotidien : un annonceur qui engage dix fois plus
 * qu'un autre est servi dix fois plus souvent. C'est la règle la plus simple
 * qui reste défendable devant les deux — proportionnelle à ce que chacun met,
 * sans qu'un gros budget écrase totalement un petit.
 */
function weightedOrder<T>(items: T[], weightOf: (item: T) => number, rand: () => number): T[] {
  const pool = items.map((item) => ({ item, weight: Math.max(1, weightOf(item)) }));
  const out: T[] = [];

  while (pool.length > 0) {
    const total = pool.reduce((sum, row) => sum + row.weight, 0);
    let ticket = rand() * total;
    let index = pool.length - 1;
    for (let i = 0; i < pool.length; i++) {
      ticket -= pool[i].weight;
      if (ticket <= 0) {
        index = i;
        break;
      }
    }
    out.push(pool[index].item);
    pool.splice(index, 1);
  }

  return out;
}

// ── Sélection ───────────────────────────────────────────────────────────────

/** Campagnes servables, mises en cache très court pour ne pas requêter à chaque affichage. */
type CachedCampaign = {
  id: string;
  /** Solde de l'annonceur au moment du chargement du cache. */
  balanceCents: number;
  suspended: boolean;
  /** Diffusion offerte : ni solde requis, ni débit. */
  billingDisabled: boolean;
  dailyBudgetCents: number;
  totalBudgetCents: number;
  spentCents: number;
  categories: string[];
  smartTargeting: boolean;
  placements: string[];
  zones: { lat: number; lng: number; radiusKm: number; citySlug: string }[];
  ads: {
    id: string;
    title: string;
    description: string;
    imageUrl: string;
    imageUrlWide: string | null;
    ctaLabel: string;
    destinationUrl: string | null;
    listingId: string | null;
  }[];
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
      advertiser: { select: { balanceCents: true, suspendedAt: true, billingDisabledAt: true } },
      dailyBudgetCents: true,
      totalBudgetCents: true,
      spentCents: true,
      categories: true,
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
        },
      },
    },
    take: 500,
  });

  const campaigns: CachedCampaign[] = rows.map((c) => ({
    id: c.id,
    balanceCents: c.advertiser.balanceCents,
    suspended: Boolean(c.advertiser.suspendedAt),
    billingDisabled: Boolean(c.advertiser.billingDisabledAt),
    dailyBudgetCents: c.dailyBudgetCents,
    totalBudgetCents: c.totalBudgetCents,
    spentCents: c.spentCents,
    categories: parseList(c.categories),
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
function coversCity(campaign: CachedCampaign, city: { lat: number; lng: number; slug: string } | null): boolean {
  if (campaign.zones.length === 0) return true;
  if (!city) return false;

  return campaign.zones.some((z) =>
    z.radiusKm > 0
      ? distanceKm({ lat: z.lat, lng: z.lng }, { lat: city.lat, lng: city.lng }) <= z.radiusKm
      : z.citySlug === city.slug,
  );
}

/**
 * Choisit la publicité à servir.
 *
 * Classement volontairement simple tant qu'il n'y a pas d'historique : à
 * éligibilité égale, on répartit au hasard plutôt que de toujours servir la
 * même — sinon la première campagne créée consommerait tout l'inventaire.
 * Le classement par performance viendra avec les données de la phase 4.
 */
/**
 * Ordre de passage des campagnes éligibles.
 *
 * Ce n'est plus un tirage au sort. Deux critères, dans cet ordre :
 *
 *  - **le budget engagé**, qui donne la part de voix. Un annonceur qui met dix
 *    fois plus est servi dix fois plus souvent. C'est la seule règle qu'on
 *    puisse défendre devant les deux à la fois ;
 *  - **la pertinence**, quand la diffusion suggérée est active : la campagne
 *    dont les univers collent à l'intention du visiteur remonte. Elle ne rafle
 *    pas tout pour autant — le rang budgétaire pèse encore trois dixièmes,
 *    sinon un petit annonceur bien ciblé occuperait tout l'inventaire.
 *
 * Une campagne qui n'a pas coché la diffusion suggérée n'est pas pénalisée :
 * elle reçoit une pertinence moyenne. Ne pas cocher une case n'est pas une
 * faute.
 */
async function rankCampaigns(
  eligible: CachedCampaign[],
  ctx: AdRequestContext,
  rand: () => number,
): Promise<CachedCampaign[]> {
  // Part de voix proportionnelle au budget du jour, tirage semé par
  // l'emplacement : deux encarts d'une même page ne tombent pas sur la même
  // campagne, et un gros budget passe plus souvent sans écraser les autres.
  const ordered = weightedOrder(eligible, (c) => c.dailyBudgetCents, rand);

  const smart = await smartSuggestionsEnabled();
  if (!smart || !eligible.some((c) => c.smartTargeting)) return ordered;

  const profile: IntentProfile = await buildIntentProfile({
    userId: ctx.userId,
    contextCategory: ctx.category,
    recentCategories: ctx.recentCategories,
    landingKeywords: ctx.landingKeywords,
  });

  // La pertinence reclasse, le budget garde son mot à dire : le rang issu du
  // tirage pondéré entre dans le score, sinon la campagne la mieux ciblée
  // raflerait tout l'inventaire quel que soit son engagement.
  return ordered
    .map((c, rank) => ({
      campaign: c,
      score:
        (c.smartTargeting ? affinity(c.categories, profile) : 0.45) * 0.7 +
        (1 - rank / Math.max(ordered.length, 1)) * 0.3,
    }))
    .sort((a, b) => b.score - a.score)
    .map((row) => row.campaign);
}

export async function selectAd(ctx: AdRequestContext): Promise<ServedAd | null> {
  if (!isPlacement(ctx.placement)) return null;

  // Emplacement fermé depuis l'administration : il cesse d'être servi, sinon
  // « fermer à la vente » ne ferait que retirer une case dans un formulaire
  // pendant que les campagnes déjà créées continueraient de tourner.
  const grid = await pricing();
  if (grid.get(ctx.placement)?.isOpen === false) return null;

  // Une seule résolution par requête : `resolveLocation` couvre les 35 000
  // communes et retombe sur le département si le libellé est approximatif.
  const resolved = ctx.city ? resolveLocation(ctx.city) : null;
  const city = resolved
    ? { lat: resolved.lat, lng: resolved.lng, slug: normalizeToken(resolved.city) }
    : null;

  const contextCategoryId = ctx.category ? categoryIdFromListing(ctx.category) : null;

  // Graine : l'emplacement et la tranche de cinq minutes. Deux encarts d'une
  // même page divergent, un même encart reste stable le temps de la visite.
  const rand = seededRandom(seed(`${ctx.placement}|${rotationSlot()}`));

  const excluded = new Set(ctx.excludeAdIds ?? []);

  const campaigns = await servableCampaigns();
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
    // identifiant (« vehicules », tel qu'il circule dans les URLs). Comparer les
    // chaînes brutes faisait échouer un ciblage pourtant correct.
    if (c.categories.length > 0 && contextCategoryId) {
      const targeted = c.categories.map((v) => categoryIdFromListing(v) ?? v);
      if (!targeted.includes(contextCategoryId)) return false;
    }
    if (!coversCity(c, city)) return false;
    return c.ads.length > 0;
  });

  if (eligible.length === 0) return null;

  // Les campagnes dont tous les créatifs sont déjà à l'écran passent en
  // dernier : on ne les interdit pas — avec un seul annonceur, les interdire
  // viderait la page — mais tout le reste passe avant.
  const fresh = eligible.filter((c) => c.ads.some((a) => !excluded.has(a.id)));
  const stale = eligible.filter((c) => !fresh.includes(c));

  const ordered = [
    ...(await rankCampaigns(fresh, ctx, rand)),
    ...(await rankCampaigns(stale, ctx, rand)),
  ];

  // Plafond du jour : vérifié ici, sinon on le constaterait au lieu de
  // l'appliquer. Une seule agrégation, sur la campagne retenue.
  const shuffled = ordered;
  let campaign: CachedCampaign | null = null;
  for (const candidate of shuffled) {
    if (await withinDailyBudget(candidate)) {
      campaign = candidate;
      break;
    }
  }
  if (!campaign) return null;
  // Créatif : d'abord ceux que la page n'a pas déjà montrés, et un choix semé
  // par l'emplacement — un annonceur qui fournit trois visuels en voit trois
  // tourner, au lieu du même partout.
  const unseen = campaign.ads.filter((a) => !excluded.has(a.id));
  const pool = unseen.length > 0 ? unseen : campaign.ads;
  const ad = pool[Math.floor(rand() * pool.length) % pool.length];

  return {
    adId: ad.id,
    campaignId: campaign.id,
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
        campaignId: campaign.id,
        placement: ctx.placement,
        citySlug: city?.slug ?? null,
        platform: ctx.platform,
      },
      ctx.platform === "EMAIL" ? EMAIL_TOKEN_LIFETIME_SECONDS : TOKEN_LIFETIME_SECONDS,
    ),
  };
}
