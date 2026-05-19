/**
 * Suggestions de pré-remplissage de formulaire pour l'utilisateur connecté.
 *
 * Combine la dernière annonce publiée, les entrées waitlist et le prix médian
 * de la catégorie cible pour produire un objet de prefill. Le client (PostForm)
 * applique ces valeurs comme état initial UNIQUEMENT en l'absence de brouillon
 * (le brouillon fait foi quand il existe).
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { suggestPrefill } from "@/lib/behavioral/prefill";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ prefill: null });
  }
  const userId = session.user.id as string;

  const [user, lastListing, waitlist] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    }),
    prisma.listing.findFirst({
      where: { userId, deletedAt: null },
      orderBy: { createdAt: "desc" },
      select: { category: true, subcategory: true, location: true, metadata: true },
    }),
    prisma.user.findUnique({ where: { id: userId }, select: { email: true } }).then((u) =>
      u?.email
        ? prisma.waitlist.findMany({
            where: { email: u.email },
            select: { categoryId: true, citySlug: true },
            take: 5,
          })
        : [],
    ),
  ]);

  if (!user) return NextResponse.json({ prefill: null });

  const lastMeta = lastListing?.metadata
    ? (() => {
        try {
          return JSON.parse(lastListing.metadata) as Record<string, unknown>;
        } catch {
          return undefined;
        }
      })()
    : undefined;

  // Prix médian de la catégorie+sous-catégorie (échantillon récent).
  let medianPriceForCategory: number | null = null;
  if (lastListing?.category) {
    const sample = await prisma.listing.findMany({
      where: {
        category: lastListing.category,
        ...(lastListing.subcategory ? { subcategory: lastListing.subcategory } : {}),
        status: "APPROVED",
        deletedAt: null,
      },
      select: { price: true },
      take: 200,
      orderBy: { createdAt: "desc" },
    });
    if (sample.length >= 5) {
      const sorted = sample.map((s) => s.price).sort((a, b) => a - b);
      medianPriceForCategory = sorted[sorted.length >> 1];
    }
  }

  const prefill = suggestPrefill({
    lastListing: lastListing
      ? {
          category: lastListing.category,
          subcategory: lastListing.subcategory,
          location: lastListing.location,
          metadata: lastMeta,
        }
      : null,
    waitlist: waitlist.map((w) => ({ category: w.categoryId, city: w.citySlug })),
    medianPriceForCategory,
  });

  return NextResponse.json({ prefill });
}
