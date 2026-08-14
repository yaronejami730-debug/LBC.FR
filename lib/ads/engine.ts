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
import { withinDailyBudget } from "./billing";

const SECRET = process.env.AUTH_SECRET;
if (!SECRET) throw new Error("AUTH_SECRET missing");

/** Une minute : le temps qu'une publicité s'affiche, pas davantage. */
const TOKEN_LIFETIME_SECONDS = 60;

export type AdRequestContext = {
  placement: PlacementKey;
  /** Ville du visiteur, telle qu'il l'a choisie ou telle que résolue. */
  city?: string | null;
  category?: string | null;
  platform: "WEB" | "MOBILE";
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

export function signAdToken(payload: Omit<TokenPayload, "exp">): string {
  const body = {
    ...payload,
    exp: Math.floor(Date.now() / 1000) + TOKEN_LIFETIME_SECONDS,
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

// ── Sélection ───────────────────────────────────────────────────────────────

/** Campagnes servables, mises en cache très court pour ne pas requêter à chaque affichage. */
type CachedCampaign = {
  id: string;
  /** Solde de l'annonceur au moment du chargement du cache. */
  balanceCents: number;
  suspended: boolean;
  dailyBudgetCents: number;
  totalBudgetCents: number;
  spentCents: number;
  categories: string[];
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
      advertiser: { select: { balanceCents: true, suspendedAt: true } },
      dailyBudgetCents: true,
      totalBudgetCents: true,
      spentCents: true,
      categories: true,
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
    dailyBudgetCents: c.dailyBudgetCents,
    totalBudgetCents: c.totalBudgetCents,
    spentCents: c.spentCents,
    categories: parseList(c.categories),
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
export async function selectAd(ctx: AdRequestContext): Promise<ServedAd | null> {
  if (!isPlacement(ctx.placement)) return null;

  // Une seule résolution par requête : `resolveLocation` couvre les 35 000
  // communes et retombe sur le département si le libellé est approximatif.
  const resolved = ctx.city ? resolveLocation(ctx.city) : null;
  const city = resolved
    ? { lat: resolved.lat, lng: resolved.lng, slug: normalizeToken(resolved.city) }
    : null;

  const campaigns = await servableCampaigns();
  const eligible = campaigns.filter((c) => {
    if (!c.placements.includes(ctx.placement)) return false;
    // Portefeuille vide ou compte suspendu : on ne sert pas à crédit, et on ne
    // sert pas un annonceur dont l'accès a été coupé.
    if (c.suspended || c.balanceCents <= 0) return false;
    // Budget total épuisé : la campagne ne doit plus rien coûter à personne.
    if (c.spentCents >= c.totalBudgetCents) return false;
    if (c.categories.length > 0 && ctx.category && !c.categories.includes(ctx.category)) return false;
    if (!coversCity(c, city)) return false;
    return c.ads.length > 0;
  });

  if (eligible.length === 0) return null;

  // Plafond du jour : vérifié ici, sinon on le constaterait au lieu de
  // l'appliquer. Une seule agrégation, sur la campagne tirée au sort.
  const shuffled = [...eligible].sort(() => Math.random() - 0.5);
  let campaign: CachedCampaign | null = null;
  for (const candidate of shuffled) {
    if (await withinDailyBudget(candidate)) {
      campaign = candidate;
      break;
    }
  }
  if (!campaign) return null;
  const ad = campaign.ads[Math.floor(Math.random() * campaign.ads.length)];

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
    token: signAdToken({
      adId: ad.id,
      campaignId: campaign.id,
      placement: ctx.placement,
      citySlug: city?.slug ?? null,
      platform: ctx.platform,
    }),
  };
}
