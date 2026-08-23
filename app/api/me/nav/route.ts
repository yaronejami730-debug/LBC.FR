import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { membershipsOf } from "@/lib/pro/memberships";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Ce que le menu du compte a besoin de savoir, et rien de plus.
 *
 * ── Pourquoi cette route existe ───────────────────────────────────────────
 *
 * La `Navbar` lisait la session côté serveur. Or lire un cookie fait basculer
 * en rendu dynamique **toute page qui affiche le composant** : les familles
 * SEO déclaraient `generateStaticParams` et `revalidate`, et n'ont jamais
 * produit une seule page statique. Mesure du 23/08/2026 : 18 pages
 * pré-rendues sur tout le site, et `x-vercel-cache: MISS` partout ailleurs —
 * chaque passage de Googlebot repartait à l'origine.
 *
 * La session est donc lue ici, à la demande, par le seul morceau qui en
 * dépend. Deux champs seulement : le reste du menu est du texte identique pour
 * tout le monde.
 *
 * Jamais mise en cache : elle décrit la personne connectée.
 */
export async function GET() {
  const session = await auth().catch(() => null);
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json(
      { isPro: false, membershipCount: 0 },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  }

  const [dbUser, memberships] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { isPro: true } }).catch(() => null),
    membershipsOf(userId).catch(() => []),
  ]);

  return NextResponse.json(
    { isPro: dbUser?.isPro ?? false, membershipCount: memberships.length },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
