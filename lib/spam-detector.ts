import { prisma } from "@/lib/prisma";

export type SpamSignal = {
  code: string;
  points: number;
  detail: string;
};

export type SpamReport = {
  userId: string;
  totalScore: number;
  signals: SpamSignal[];
  shouldPend: boolean;       // score ≥ 80 < 100: force new listing to PENDING
  shouldRestrict: boolean;   // score ≥ 100: restrict account + shadow-ban recent listings
  isHardRestrict: boolean;   // score ≥ 150: restrict + shadow-ban ALL listings
};

const PEND_THRESHOLD = 80;
const RESTRICT_THRESHOLD = 100;
const HARD_RESTRICT_THRESHOLD = 150;
const WINDOW_HOURS = 24;

function normalizeText(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

function jaccardSimilarity(a: string, b: string): number {
  const wordsA = new Set(a.split(" ").filter(Boolean));
  const wordsB = new Set(b.split(" ").filter(Boolean));
  if (wordsA.size === 0 && wordsB.size === 0) return 1;
  const intersection = [...wordsA].filter((w) => wordsB.has(w)).length;
  const union = new Set([...wordsA, ...wordsB]).size;
  return union === 0 ? 0 : intersection / union;
}

export async function detectSpam(userId: string): Promise<SpamReport> {
  const since = new Date(Date.now() - WINDOW_HOURS * 60 * 60 * 1000);

  const [user, listings] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { createdAt: true, verified: true, isPro: true },
    }),
    prisma.listing.findMany({
      where: { userId, createdAt: { gte: since }, deletedAt: null },
      orderBy: { createdAt: "asc" },
      select: { id: true, location: true, description: true, phone: true, images: true, createdAt: true },
    }),
  ]);

  const empty: SpamReport = { userId, totalScore: 0, signals: [], shouldPend: false, shouldRestrict: false, isHardRestrict: false };

  if (user?.isPro) return empty;
  if (listings.length < 3) return empty;

  const signals: SpamSignal[] = [];

  // --- Trust score (positive signals, reduce final score) ---
  const accountAgeHours = user ? (Date.now() - user.createdAt.getTime()) / 3_600_000 : 0;

  const [approvedCount, favoritesCount] = await Promise.all([
    prisma.listing.count({ where: { userId, status: "APPROVED", deletedAt: null } }),
    prisma.favorite.count({ where: { listing: { userId } } }),
  ]);

  let trustReduction = 0;
  if (user?.verified)              trustReduction += 20;
  if (accountAgeHours >= 2160)     trustReduction += 25; // 90 days
  else if (accountAgeHours >= 720) trustReduction += 15; // 30 days
  if (approvedCount >= 20)         trustReduction += 25;
  else if (approvedCount >= 5)     trustReduction += 15;
  if (favoritesCount >= 10)        trustReduction += 10;

  // --- Spam signals ---

  // Signal 1: Geographic spread — +20 per unique city beyond 3
  const uniqueCities = new Set(listings.map((l) => l.location.toLowerCase().trim()));
  if (uniqueCities.size > 3) {
    const extra = uniqueCities.size - 3;
    signals.push({
      code: "geo_spread",
      points: extra * 20,
      detail: `${uniqueCities.size} villes distinctes en ${WINDOW_HOURS}h`,
    });
  }

  // Signal 2: Duplicate text — +30 per pair >80% Jaccard (cap 90)
  const descriptions = listings.map((l) => normalizeText(l.description));
  let duplicatePairs = 0;
  for (let i = 0; i < descriptions.length; i++) {
    for (let j = i + 1; j < descriptions.length; j++) {
      if (jaccardSimilarity(descriptions[i], descriptions[j]) > 0.8) duplicatePairs++;
    }
  }
  if (duplicatePairs > 0) {
    signals.push({
      code: "duplicate_text",
      points: Math.min(duplicatePairs * 30, 90),
      detail: `${duplicatePairs} paire(s) de descriptions quasi-identiques`,
    });
  }

  // Signal 3: Burst posting — +25 per listing posted < 2 min after previous
  let burstCount = 0;
  for (let i = 1; i < listings.length; i++) {
    if (listings[i].createdAt.getTime() - listings[i - 1].createdAt.getTime() < 2 * 60 * 1000) {
      burstCount++;
    }
  }
  if (burstCount > 0) {
    signals.push({
      code: "burst_posting",
      points: burstCount * 25,
      detail: `${burstCount} annonce(s) en rafale (< 2 min d'intervalle)`,
    });
  }

  // Signal 4: Shared phone — +50 if phone used by another account
  const phones = listings.map((l) => l.phone).filter((p): p is string => Boolean(p?.trim()));
  if (phones.length > 0) {
    const crossPhoneCount = await prisma.listing.count({
      where: { phone: { in: phones }, userId: { not: userId }, deletedAt: null },
    });
    if (crossPhoneCount > 0) {
      signals.push({
        code: "shared_phone",
        points: 50,
        detail: `Numéro(s) partagé(s) avec ${crossPhoneCount} annonce(s) d'autres comptes`,
      });
    }
  }

  // Signal 5: Shared image URLs — +40 if photos reused across accounts
  const allImageUrls = listings.flatMap((l) => {
    try { return JSON.parse(l.images) as string[]; } catch { return []; }
  }).filter((url): url is string => typeof url === "string" && url.startsWith("http"));
  const uniqueImageUrls = [...new Set(allImageUrls)].slice(0, 10);

  if (uniqueImageUrls.length > 0) {
    const sharedImageCount = await prisma.listing.count({
      where: {
        userId: { not: userId },
        deletedAt: null,
        OR: uniqueImageUrls.map((url) => ({ images: { contains: url } })),
      },
    });
    if (sharedImageCount > 0) {
      signals.push({
        code: "shared_images",
        points: 40,
        detail: `Photos partagées avec ${sharedImageCount} annonce(s) d'autres comptes`,
      });
    }
  }

  const rawScore = signals.reduce((sum, s) => sum + s.points, 0);
  const totalScore = Math.max(0, rawScore - trustReduction);

  return {
    userId,
    totalScore,
    signals,
    shouldPend: totalScore >= PEND_THRESHOLD && totalScore < RESTRICT_THRESHOLD,
    shouldRestrict: totalScore >= RESTRICT_THRESHOLD,
    isHardRestrict: totalScore >= HARD_RESTRICT_THRESHOLD,
  };
}

export async function applySpamRestriction(userId: string, report: SpamReport): Promise<void> {
  const adminNote = `[SPAM AUTO${report.isHardRestrict ? " HARD" : ""}] score=${report.totalScore} | ${report.signals.map((s) => `${s.code}(+${s.points})`).join(", ")}`;

  const listingUpdate = report.isHardRestrict
    ? prisma.listing.updateMany({
        where: { userId, shadowBanned: false, deletedAt: null },
        data: { shadowBanned: true },
      })
    : prisma.listing.updateMany({
        where: { userId, shadowBanned: false, status: "APPROVED", deletedAt: null },
        data: { shadowBanned: true },
      });

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { restrictedAt: new Date(), spamScore: report.totalScore, adminNote },
    }),
    listingUpdate,
  ]);
}
