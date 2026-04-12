import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { formatDistanceToNow } from "@/lib/utils";
import Navbar from "@/components/Navbar";
import BottomNav from "@/components/BottomNav";

export default async function FavoritesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/favorites");

  const favorites = await prisma.favorite.findMany({
    where: { userId: session.user.id },
    include: {
      listing: {
        include: { user: { select: { name: true, verified: true } } },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const active = favorites.filter((f) => !f.listing.deletedAt && f.listing.status === "APPROVED");

  return (
    <div className="bg-surface text-on-surface min-h-screen mb-24 md:mb-0">
      <Navbar active="favoris" />

      <main className="pt-24 pb-10 px-4 max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-extrabold text-on-surface font-['Manrope']">Mes favoris</h1>
            <p className="text-outline text-sm mt-0.5">{active.length} annonce{active.length !== 1 ? "s" : ""} sauvegardée{active.length !== 1 ? "s" : ""}</p>
          </div>
        </div>

        {active.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center shadow-[0_2px_12px_rgba(21,21,125,0.05)]">
            <span className="material-symbols-outlined text-5xl text-outline/30 block mb-3" style={{ fontVariationSettings: "'FILL' 1" }}>favorite</span>
            <p className="text-on-surface-variant font-medium">Aucun favori pour l&apos;instant</p>
            <p className="text-outline text-sm mt-1">Appuyez sur ♡ sur une annonce pour la sauvegarder</p>
            <Link
              href="/search"
              className="mt-6 inline-flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-full font-bold text-sm shadow-md shadow-primary/20 active:scale-95 transition-transform"
            >
              <span className="material-symbols-outlined text-base">search</span>
              Explorer les annonces
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {active.map(({ listing }) => {
              const images = JSON.parse(listing.images) as string[];
              const img = images[0] || "";
              return (
                <Link
                  key={listing.id}
                  href={`/listing/${listing.id}`}
                  className="group flex flex-col bg-white rounded-xl overflow-hidden border border-surface-container hover:shadow-md transition-all duration-200"
                >
                  <div className="relative aspect-square overflow-hidden bg-surface-container-low">
                    {img ? (
                      <img
                        src={img}
                        alt={listing.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <span className="material-symbols-outlined text-3xl text-outline/30">image</span>
                      </div>
                    )}
                    <div className="absolute top-2 right-2 w-7 h-7 rounded-full bg-white/90 flex items-center justify-center shadow-sm">
                      <span className="material-symbols-outlined text-red-500 text-base" style={{ fontVariationSettings: "'FILL' 1" }}>favorite</span>
                    </div>
                  </div>
                  <div className="p-2.5 flex flex-col gap-0.5">
                    <p className="text-on-surface font-semibold text-sm leading-snug line-clamp-2">{listing.title}</p>
                    <p className="text-primary font-bold text-base mt-1">{listing.price.toLocaleString("fr-FR")} €</p>
                    <p className="text-outline text-xs truncate">{listing.location}</p>
                    <p className="text-outline/70 text-[10px]">{formatDistanceToNow(listing.createdAt)}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>

      <BottomNav active="favoris" />
    </div>
  );
}
