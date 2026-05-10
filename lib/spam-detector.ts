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
  shouldRestrict: boolean;
};

const RESTRICT_THRESHOLD = 100;
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

  const listings = await prisma.listing.findMany({
    where: { userId, createdAt: { gte: since }, deletedAt: null },
    orderBy: { createdAt: "asc" },
    select: { id: true, location: true, description: true, phone: true, createdAt: true },
  });

  const signals: SpamSignal[] = [];

  if (listings.length < 3) {
    return { userId, totalScore: 0, signals, shouldRestrict: false };
  }

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

  // Signal 2: Duplicate text — +30 per pair with >80% Jaccard similarity (cap 90)
  const descriptions = listings.map((l) => normalizeText(l.description));
  let duplicatePairs = 0;
  for (let i = 0; i < descriptions.length; i++) {
    for (let j = i + 1; j < descriptions.length; j++) {
      if (jaccardSimilarity(descriptions[i], descriptions[j]) > 0.8) {
        duplicatePairs++;
      }
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
    const gap = listings[i].createdAt.getTime() - listings[i - 1].createdAt.getTime();
    if (gap < 2 * 60 * 1000) burstCount++;
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
    const crossAccountCount = await prisma.listing.count({
      where: { phone: { in: phones }, userId: { not: userId }, deletedAt: null },
    });
    if (crossAccountCount > 0) {
      signals.push({
        code: "shared_phone",
        points: 50,
        detail: `Numéro(s) partagé(s) avec ${crossAccountCount} annonce(s) d'autres comptes`,
      });
    }
  }

  const totalScore = signals.reduce((sum, s) => sum + s.points, 0);

  return {
    userId,
    totalScore,
    signals,
    shouldRestrict: totalScore >= RESTRICT_THRESHOLD,
  };
}

export async function applySpamRestriction(userId: string, report: SpamReport): Promise<void> {
  const adminNote = `[SPAM AUTO] score=${report.totalScore} | ${report.signals.map((s) => `${s.code}(+${s.points})`).join(", ")}`;

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: {
        restrictedAt: new Date(),
        spamScore: report.totalScore,
        adminNote,
      },
    }),
    // Shadow-ban all recent APPROVED listings
    prisma.listing.updateMany({
      where: { userId, shadowBanned: false, status: "APPROVED", deletedAt: null },
      data: { shadowBanned: true },
    }),
  ]);
}
