/**
 * Profil des lectures base d'une fiche annonce.
 *
 *     npm run profile:listing
 *
 * Le crawl du 23/08/2026 mesurait jusqu'à 1,9 s de temps de chargement HTML sur
 * `/annonce/...`, contre 0,3 à 0,7 s sur les pages catégorie. La cause n'était
 * pas le rendu : c'étaient quatre lectures base enchaînées, dont une non bornée
 * qui chargeait tous les messages du vendeur pour afficher « répond en 3 h ».
 *
 * Ce script mesure ce que la page demande réellement, requête par requête, sur
 * le vendeur le plus actif — le pire cas. Il lit, il n'écrit rien.
 */
import { prisma } from "../lib/prisma";
import { getActiveAds } from "../lib/ads";
import { getUserResponseTimeUncached } from "../lib/user-stats";

async function timed<T>(label: string, fn: () => Promise<T>): Promise<number> {
  const t = Date.now();
  await fn();
  const ms = Date.now() - t;
  console.log(`  ${label.padEnd(34)} ${String(ms).padStart(5)} ms`);
  return ms;
}

const USER_FIELDS = {
  id: true,
  name: true,
  avatar: true,
  verified: true,
  memberSince: true,
  isPro: true,
  siret: true,
  companyName: true,
} as const;

async function main() {
  /**
   * Préchauffage — en parallèle, et c'est le point important.
   *
   * Un seul `SELECT 1` n'ouvre qu'**une** connexion. Les trois lectures groupées
   * en ouvriraient alors deux de plus, chacune payant sa poignée de main TLS
   * (~250 ms), et le groupe paraîtrait plus lent que la mise en file qu'il
   * remplace. En production le pool est déjà chaud : mesurer à froid mesurerait
   * l'établissement de connexion, pas la page.
   */
  await Promise.all([
    prisma.$queryRaw`SELECT 1`,
    prisma.$queryRaw`SELECT 1`,
    prisma.$queryRaw`SELECT 1`,
  ]);

  const busiest = await prisma.conversationParticipant.groupBy({
    by: ["userId"],
    _count: { _all: true },
    orderBy: { _count: { userId: "desc" } },
    take: 1,
  });
  const userId = busiest[0]?.userId;
  const listing =
    (userId ? await prisma.listing.findFirst({ where: { userId }, select: { id: true, userId: true } }) : null) ??
    (await prisma.listing.findFirst({ where: { status: "APPROVED" }, select: { id: true, userId: true } }));

  if (!listing) {
    console.log("Aucune annonce à profiler.");
    return;
  }

  console.log(`\nfiche /annonce/${listing.id} — vendeur ${listing.userId.slice(0, 8)}`);

  const rtt = await timed("aller-retour à vide", () => prisma.$queryRaw`SELECT 1`);

  const fiche = await timed("annonce + vendeur", () =>
    prisma.listing.findUnique({
      where: { id: listing.id },
      include: { user: { select: USER_FIELDS } },
    }),
  );

  // Les trois suivantes partent ensemble dans la page : ce qui compte n'est pas
  // leur somme mais la plus lente d'entre elles.
  const groupe = await timed("bannières + favori + délai (groupés)", () =>
    Promise.all([
      getActiveAds(),
      prisma.favorite.findUnique({
        where: { userId_listingId: { userId: listing.userId, listingId: listing.id } },
        select: { userId: true },
      }),
      getUserResponseTimeUncached(listing.userId),
    ]),
  );

  console.log(
    `\n  total ${fiche + groupe} ms de base, dont ${rtt} ms de latence incompressible par aller-retour.`,
  );
  console.log(
    "  Repère : deux allers-retours au maximum sur cette page. Au-delà, une lecture a été ajoutée hors du groupe parallèle.",
  );
}

main().finally(() => prisma.$disconnect());
