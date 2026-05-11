import { prisma } from "@/lib/prisma";

export type TrustTier = "untrusted" | "standard" | "trusted" | "vetted";

export type TrustComputeInput = {
  userId: string;
};

export type TrustResult = {
  score: number;
  tier: TrustTier;
  breakdown: Record<string, number>;
};

function tierFor(score: number): TrustTier {
  if (score >= 85) return "vetted";
  if (score >= 60) return "trusted";
  if (score >= 30) return "standard";
  return "untrusted";
}

/** Daily rate-limit caps per trust tier. Used by rate-limit lib. */
export const LISTING_DAILY_CAP: Record<TrustTier, number> = {
  untrusted: 3,
  standard: 10,
  trusted: 20,
  vetted: 50,
};

export const LISTING_HOURLY_CAP: Record<TrustTier, number> = {
  untrusted: 1,
  standard: 3,
  trusted: 5,
  vetted: 10,
};

export async function computeTrustScore({
  userId,
}: TrustComputeInput): Promise<TrustResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      createdAt: true,
      emailVerified: true,
      phoneVerified: true,
      isPro: true,
      siret: true,
      verified: true,
      totalReportsAgainst: true,
      rejectedListingCount: true,
      bannedAt: true,
    },
  });

  const breakdown: Record<string, number> = {};
  if (!user) return { score: 0, tier: "untrusted", breakdown };

  let s = 0;

  // Identity (max 35)
  if (user.emailVerified) {
    s += 10;
    breakdown.email_verified = 10;
  }
  if (user.phoneVerified) {
    s += 10;
    breakdown.phone_verified = 10;
  }
  if (user.isPro && user.siret) {
    s += 15;
    breakdown.pro_verified = 15;
  }

  // Account age (max 20)
  const ageDays = (Date.now() - user.createdAt.getTime()) / 86_400_000;
  if (ageDays >= 365) {
    s += 20;
    breakdown.age_1y = 20;
  } else if (ageDays >= 90) {
    s += 12;
    breakdown.age_90d = 12;
  } else if (ageDays >= 30) {
    s += 6;
    breakdown.age_30d = 6;
  }

  // History (max 25)
  const [approvedListings, soldListingsRaw] = await Promise.all([
    prisma.listing.count({
      where: { userId, status: "APPROVED", deletedAt: null } as any,
    }),
    prisma.listing.count({
      where: { userId, status: "SOLD", deletedAt: null } as any,
    }).catch(() => 0),
  ]);

  if (approvedListings >= 50) {
    s += 15;
    breakdown.history_50 = 15;
  } else if (approvedListings >= 10) {
    s += 10;
    breakdown.history_10 = 10;
  } else if (approvedListings >= 3) {
    s += 5;
    breakdown.history_3 = 5;
  }

  if (soldListingsRaw >= 10) {
    s += 10;
    breakdown.sold_10 = 10;
  }

  // Admin manual verification badge (+5)
  if (user.verified) {
    s += 5;
    breakdown.admin_verified = 5;
  }

  // Penalties (uncapped negative)
  if (user.totalReportsAgainst > 0) {
    const pen = -Math.min(20, user.totalReportsAgainst * 2);
    s += pen;
    breakdown.reports = pen;
  }
  if (user.rejectedListingCount > 0) {
    const pen = -Math.min(15, user.rejectedListingCount * 3);
    s += pen;
    breakdown.rejected = pen;
  }
  if (user.bannedAt) {
    s -= 50;
    breakdown.ever_banned = -50;
  }

  const score = Math.max(0, Math.min(100, s));
  return { score, tier: tierFor(score), breakdown };
}

export async function updateTrustScore(userId: string): Promise<TrustResult> {
  const result = await computeTrustScore({ userId });
  await prisma.user.update({
    where: { id: userId },
    data: { trustScore: result.score, trustScoreUpdatedAt: new Date() } as any,
  });
  return result;
}
