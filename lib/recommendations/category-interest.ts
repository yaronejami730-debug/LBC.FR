/**
 * Intérêt catégoriel d'un compte — ce qui l'intéresse, déduit de ses actes.
 *
 * L'échelle des signaux suit une idée simple : plus un geste coûte, plus il
 * dit quelque chose. Publier une annonce demande des photos, un prix, du
 * temps ; ouvrir une annonce demande un clic ; recevoir un email ne demande
 * rien du tout.
 *
 *   publication  Il connaît le marché, il y est déjà.
 *   alerte       Il a demandé à être prévenu. Une intention écrite.
 *   favori       Il a mis de côté. Une intention silencieuse.
 *   consultation Répétée, c'est un intérêt ; isolée, c'est du hasard.
 *   clic email   Confirme que nos envois sur cette catégorie servent.
 *   ignoré       Signal *négatif* : des emails envoyés, jamais ouverts. Le
 *                compte a répondu, même sans cliquer « se désabonner ».
 *
 * `categoryId` est l'identifiant du catalogue (`lib/categories.ts`), jamais le
 * libellé affiché : renommer « Maison » en « Maison & Jardin » ne doit pas
 * remettre à zéro l'intérêt de 40 000 comptes.
 */

import { prisma } from "@/lib/prisma";
import { CATEGORIES, getCategoryByLabel } from "@/lib/categories";
import { RECO_CONFIG, recencyFactor, RECO_EMAIL_TYPE } from "./config";

const VALID_CATEGORY_IDS = new Set(CATEGORIES.map((c) => c.id));

/**
 * Traduit ce qui est stocké sur l'annonce (`Listing.category`, un libellé) vers
 * l'identifiant de catalogue. Rend `null` pour une valeur inconnue plutôt que
 * d'inventer une catégorie fantôme dans les statistiques.
 */
export function categoryIdFromListing(value: string | null | undefined): string | null {
  if (!value) return null;
  if (VALID_CATEGORY_IDS.has(value)) return value;
  return getCategoryByLabel(value)?.id ?? null;
}

type InterestAccumulator = {
  publishedCount: number;
  favoriteCount: number;
  viewCount: number;
  searchCount: number;
  emailClickCount: number;
  ignoredEmailCount: number;
  lastActivityAt: Date;
};

function emptyAccumulator(at: Date): InterestAccumulator {
  return {
    publishedCount: 0,
    favoriteCount: 0,
    viewCount: 0,
    searchCount: 0,
    emailClickCount: 0,
    ignoredEmailCount: 0,
    lastActivityAt: at,
  };
}

/**
 * Score d'intérêt sur 100.
 *
 * Les consultations sont comptées par paliers plutôt que linéairement : entre
 * une et deux vues il n'y a rien à conclure, entre deux et huit il y a une
 * habitude. Une addition proportionnelle donnerait le même poids aux deux
 * moitiés de cet écart, ce qui serait faux.
 */
export function interestScore(acc: InterestAccumulator, now = new Date()): number {
  const published = acc.publishedCount > 0 ? 40 : 0;
  const searches = Math.min(20, acc.searchCount * 12);
  const favorites = Math.min(20, acc.favoriteCount * 7);
  const views =
    acc.viewCount >= 8 ? 25 : acc.viewCount >= 4 ? 18 : acc.viewCount >= 2 ? 10 : acc.viewCount === 1 ? 5 : 0;
  const clicks = Math.min(10, acc.emailClickCount * 5);
  const ignored = Math.min(25, acc.ignoredEmailCount * 8);

  const positive = Math.min(100, published + searches + favorites + views + clicks);
  const fresh = recencyFactor(acc.lastActivityAt, RECO_CONFIG.interestHalfLifeDays, now);

  // La pénalité s'applique *après* la décote temporelle : trois emails ignorés
  // le mois dernier doivent peser sur un intérêt lui aussi récent, pas effacer
  // un intérêt ancien qui ne valait déjà plus grand-chose.
  return Math.max(0, Math.min(100, Math.round(positive * fresh) - ignored));
}

export type CategoryInterestResult = {
  userId: string;
  categories: number;
  top: { categoryId: string; score: number }[];
};

/** Reconstruit l'intérêt catégoriel d'un compte et le persiste. */
export async function refreshUserCategoryInterest(
  userId: string,
  now = new Date(),
): Promise<CategoryInterestResult> {
  const acc = new Map<string, InterestAccumulator>();
  const bump = (
    categoryValue: string | null | undefined,
    at: Date,
    apply: (a: InterestAccumulator) => void,
  ) => {
    const id = categoryIdFromListing(categoryValue);
    if (!id) return;
    const entry = acc.get(id) ?? emptyAccumulator(at);
    apply(entry);
    if (at > entry.lastActivityAt) entry.lastActivityAt = at;
    acc.set(id, entry);
  };

  // ── Publications ────────────────────────────────────────────────────────
  const published = await prisma.listing.findMany({
    where: { userId, deletedAt: null },
    select: { category: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  for (const l of published) bump(l.category, l.createdAt, (a) => void a.publishedCount++);

  // ── Favoris ─────────────────────────────────────────────────────────────
  const favorites = await prisma.favorite.findMany({
    where: { userId },
    select: { createdAt: true, listing: { select: { category: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  for (const f of favorites) bump(f.listing?.category, f.createdAt, (a) => void a.favoriteCount++);

  // ── Alertes enregistrées ────────────────────────────────────────────────
  const searches = await prisma.savedSearch.findMany({
    where: { userId },
    select: { filters: true, updatedAt: true },
    take: 50,
  });
  for (const s of searches) {
    try {
      const filters = JSON.parse(s.filters) as { category?: string };
      bump(filters.category, s.updatedAt, (a) => void a.searchCount++);
    } catch {
      /* filtres illisibles — ignorés */
    }
  }

  // ── Consultations ───────────────────────────────────────────────────────
  const viewSince = new Date(now.getTime() - RECO_CONFIG.viewHistoryDays * 86_400_000);
  const events = await prisma.userEvent.findMany({
    where: { userId, kind: "listing_view", createdAt: { gte: viewSince } },
    select: { meta: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take: 400,
  });

  const views: { id: string; at: Date }[] = [];
  for (const e of events) {
    if (!e.meta) continue;
    try {
      const meta = JSON.parse(e.meta) as { listingId?: string; category?: string };
      // Certains événements portent déjà la catégorie : autant s'épargner une
      // jointure quand l'information est là.
      if (meta.category) bump(meta.category, e.createdAt, (a) => void a.viewCount++);
      else if (meta.listingId) views.push({ id: meta.listingId, at: e.createdAt });
    } catch {
      /* meta illisible — ignorée */
    }
  }
  if (views.length > 0) {
    const unique = [...new Set(views.map((v) => v.id))].slice(0, 300);
    const rows = await prisma.listing.findMany({
      where: { id: { in: unique } },
      select: { id: true, category: true },
    });
    const categoryById = new Map(rows.map((r) => [r.id, r.category]));
    for (const v of views) bump(categoryById.get(v.id), v.at, (a) => void a.viewCount++);
  }

  // ── Retours sur nos propres envois ──────────────────────────────────────
  const sentRecos = await prisma.listingRecommendationLog.findMany({
    where: { userId, sentAt: { not: null } },
    select: {
      sentAt: true,
      openedAt: true,
      clickedAt: true,
      listing: { select: { category: true } },
    },
    orderBy: { sentAt: "desc" },
    take: 300,
  });
  for (const r of sentRecos) {
    const at = r.sentAt ?? now;
    if (r.clickedAt) bump(r.listing?.category, at, (a) => void a.emailClickCount++);
    else if (!r.openedAt) bump(r.listing?.category, at, (a) => void a.ignoredEmailCount++);
  }

  // ── Persistance ─────────────────────────────────────────────────────────
  const scored = [...acc.entries()]
    .map(([categoryId, entry]) => ({ categoryId, entry, score: interestScore(entry, now) }))
    .filter((s) => s.score > 0);

  await prisma.$transaction([
    prisma.userCategoryInterest.deleteMany({
      where: { userId, categoryId: { notIn: scored.map((s) => s.categoryId) } },
    }),
    ...scored.map(({ categoryId, entry, score }) =>
      prisma.userCategoryInterest.upsert({
        where: { userId_categoryId: { userId, categoryId } },
        create: {
          userId,
          categoryId,
          score,
          publishedCount: entry.publishedCount,
          favoriteCount: entry.favoriteCount,
          viewCount: entry.viewCount,
          searchCount: entry.searchCount,
          emailClickCount: entry.emailClickCount,
          ignoredEmailCount: entry.ignoredEmailCount,
          lastActivityAt: entry.lastActivityAt,
          computedAt: now,
        },
        update: {
          score,
          publishedCount: entry.publishedCount,
          favoriteCount: entry.favoriteCount,
          viewCount: entry.viewCount,
          searchCount: entry.searchCount,
          emailClickCount: entry.emailClickCount,
          ignoredEmailCount: entry.ignoredEmailCount,
          lastActivityAt: entry.lastActivityAt,
          computedAt: now,
        },
      }),
    ),
  ]);

  return {
    userId,
    categories: scored.length,
    top: scored
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map((s) => ({ categoryId: s.categoryId, score: s.score })),
  };
}

/** Le type d'email dont les retours nourrissent le signal négatif. */
export const FEEDBACK_EMAIL_TYPE = RECO_EMAIL_TYPE;
