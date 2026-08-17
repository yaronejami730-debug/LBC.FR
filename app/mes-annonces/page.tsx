import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Navbar from "@/components/Navbar";
import AdSlot from "@/components/ads/AdSlot";
import MyListings, { type MyListing } from "./MyListings";
import { buildPrivateMetadata } from "@/lib/seo/metadata";

/**
 * Mes annonces — enfin une adresse à elle.
 *
 * Elles vivaient dans un onglet de `/profile`, sous les réglages de compte, la
 * demande de statut professionnel et la clé API. Or c'est l'écran le plus
 * consulté par un vendeur : il y revient plusieurs fois par jour pour voir ce
 * qui est en ligne, ce qui attend une validation, ce qui a été refusé. Le
 * ranger derrière « mon compte » revenait à cacher l'essentiel derrière
 * l'accessoire, et aucun lien du menu ne pouvait y mener directement.
 *
 * La présentation change avec l'adresse : ligne horizontale plutôt que
 * vignette carrée, parce qu'on ne vient pas ici admirer ses photos mais savoir
 * où en est chaque annonce.
 */
export const metadata = buildPrivateMetadata(
  "Mes annonces",
  "Suivez vos annonces publiées, en attente ou refusées.",
);
export const dynamic = "force-dynamic";

export default async function MesAnnoncesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/mes-annonces");

  const rows = await prisma.listing.findMany({
    where: { userId: session.user.id as string, deletedAt: null },
    orderBy: { createdAt: "desc" },
    select: {
      id: true, title: true, price: true, location: true, createdAt: true,
      images: true, status: true, isPremium: true, viewCount: true,
      rejectionReason: true, permanentDeletionAt: true,
    },
  });

  // Sérialisation des dates : le composant est rendu côté navigateur.
  const listings: MyListing[] = rows.map((l) => ({
    ...l,
    createdAt: l.createdAt.toISOString(),
    permanentDeletionAt: l.permanentDeletionAt?.toISOString() ?? null,
  }));

  return (
    <div className="bg-surface min-h-screen">
      <Navbar />
      <main className="pt-28 md:pt-36 pb-16 px-6 max-w-3xl mx-auto">
        <header className="mb-8">
          <h1 className="text-2xl font-extrabold tracking-tight font-['Manrope']">Mes annonces</h1>
          <p className="mt-1 text-sm text-outline">
            {listings.length === 0
              ? "Vous n'avez pas encore publié d'annonce."
              : `${listings.length} annonce${listings.length > 1 ? "s" : ""} au total`}
          </p>
        </header>

        {listings.length === 0 ? (
          <div className="rounded-2xl bg-white p-12 text-center shadow-[0_2px_12px_rgba(21,21,125,0.05)]">
            <span
              className="material-symbols-outlined mb-3 block text-5xl text-outline/30"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              sell
            </span>
            <p className="font-medium text-on-surface-variant">Aucune annonce pour l&apos;instant</p>
            <p className="mt-1 text-sm text-outline">
              Le dépôt est gratuit et prend deux minutes.
            </p>
            <Link
              href="/post"
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-bold text-white shadow-md shadow-primary/20 transition-transform active:scale-95"
            >
              <span className="material-symbols-outlined text-base">add_circle</span>
              Déposer une annonce
            </Link>
          </div>
        ) : (
          <MyListings listings={listings} />
        )}

        <AdSlot placement="PROFILE_BANNER" className="mt-10" />
      </main>
    </div>
  );
}
