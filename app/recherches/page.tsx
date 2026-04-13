import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Navbar from "@/components/Navbar";
import BottomNav from "@/components/BottomNav";
import SearchesClient from "./SearchesClient";
import { buildSearchWhere } from "@/lib/search-where";

export const metadata = { title: "Mes recherches — Deal&Co" };

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
      const matchCount = await prisma.listing.count({
        where: buildSearchWhere(filters, { includeNonApproved: true }) as any,
      });
      return {
        ...s,
        createdAt: s.createdAt.toISOString(),
        updatedAt: s.updatedAt.toISOString(),
        matchCount,
      };
    })
  );

  return (
    <div className="bg-surface text-on-surface min-h-screen mb-24 md:mb-0">
      <Navbar active="recherches" />

      <main className="pt-32 pb-10 px-4 max-w-3xl mx-auto">
        <SearchesClient initialSearches={withCounts} />
      </main>

      <BottomNav active="recherches" />
    </div>
  );
}
