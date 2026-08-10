import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { listingNature } from "@/lib/offer-intent";

export const dynamic = "force-dynamic";

/** Nombre de candidats tirés avant reclassement par nature. */
const CANDIDATE_POOL = 40;

// Renvoie : { sellerOthers: [...], similar: [...] }
// - sellerOthers : autres annonces du même vendeur (10 max)
// - similar     : annonces de la même catégorie / sous-catégorie (10 max),
//                 de même nature d'offre en priorité
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const ref = await prisma.listing.findUnique({
    where: { id },
    select: {
      userId: true,
      category: true,
      subcategory: true,
      title: true,
      description: true,
      price: true,
      metadata: true,
    },
  });
  if (!ref) return NextResponse.json({ sellerOthers: [], similar: [] });

  const baseSelect = {
    id: true, title: true, price: true, location: true,
    images: true, createdAt: true, isPremium: true,
  };

  // Champs nécessaires au calcul de nature, retirés de la réponse ensuite.
  const rankingSelect = {
    ...baseSelect,
    description: true, category: true, subcategory: true, metadata: true,
  };

  const [sellerOthers, pool] = await Promise.all([
    prisma.listing.findMany({
      where: {
        userId: ref.userId,
        status: "APPROVED",
        deletedAt: null,
        id: { not: id },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: baseSelect,
    }),
    prisma.listing.findMany({
      where: {
        status: "APPROVED",
        deletedAt: null,
        id: { not: id },
        userId: { not: ref.userId },
        category: ref.category,
        ...(ref.subcategory ? { subcategory: ref.subcategory } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: CANDIDATE_POOL,
      select: rankingSelect,
    }),
  ]);

  /**
   * La catégorie ne suffit pas à définir « similaire ». Sous « Beauté &
   * Bien-être », un vernis à ongles d'occasion et une manucure à domicile
   * partagent la rubrique et rien d'autre : proposer l'un à qui regarde
   * l'autre est la même confusion bien/prestation, vue côté acheteur.
   *
   * Les annonces d'une autre nature ne sont pas jetées — elles passent
   * derrière, pour que la liste reste remplie sur les rubriques peu peuplées.
   */
  const refNature = listingNature(ref);
  const similar = pool
    .map((row) => ({ row, sameNature: listingNature(row) === refNature }))
    .sort((a, b) => Number(b.sameNature) - Number(a.sameNature))
    .slice(0, 10)
    .map(({ row }) => {
      const { description: _d, category: _c, subcategory: _s, metadata: _m, ...rest } = row;
      return rest;
    });

  return NextResponse.json({ sellerOthers, similar });
}
