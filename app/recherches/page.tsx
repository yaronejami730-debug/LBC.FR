import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Navbar from "@/components/Navbar";
import SearchesClient from "./SearchesClient";
import { buildSearchWhere } from "@/lib/search-where";

export const metadata = {
  title: "Mes recherches",
  robots: { index: false, follow: false },
};

export default async function RecherchesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/recherches");

  const searches = await prisma.savedSearch.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });

  // Server-side match counts using the same powerful engine as the search page
  const withCounts = await Promise.all(
    searches.map(async (s) => {
      const filters = JSON.parse(s.filters) as Record<string, string>;
      const where = buildSearchWhere(filters, { includeNonApproved: true }) as any;

      // Deux chiffres, deux usages. Le total dit ce que vaut la recherche ; les
      // nouveautés disent s'il y a une raison de l'ouvrir maintenant. Seul le
      // second retombe à zéro une fois les résultats consultés.
      const since = s.lastViewedAt ?? s.createdAt;
      const [matchCount, newCount] = await Promise.all([
        prisma.listing.count({ where }),
        prisma.listing.count({ where: { ...where, createdAt: { gt: since } } }),
      ]);

      return {
        ...s,
        createdAt: s.createdAt.toISOString(),
        updatedAt: s.updatedAt.toISOString(),
        lastViewedAt: s.lastViewedAt?.toISOString() ?? null,
        matchCount,
        newCount,
      };
    })
  );

  return (
    <div className="bg-surface text-on-surface min-h-screen">
      <Navbar active="recherches" />

      <main className="pt-32 pb-10 px-4 max-w-3xl mx-auto">
        <SearchesClient initialSearches={withCounts} />
      </main>
    </div>
  );
}
