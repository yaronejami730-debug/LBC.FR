import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import Navbar from "@/components/Navbar";
import BottomNav from "@/components/BottomNav";
import SiteFooter from "@/components/SiteFooter";
import ListingCard from "@/components/home/ListingCard";
import { listingUrl } from "@/lib/listing-slug";

const BASE = "https://www.dealandcompany.fr";

export const revalidate = 1800;

export const metadata: Metadata = {
  title: "Nouvelles annonces du jour — Deal&Co",
  description:
    "Découvrez les dernières petites annonces publiées aujourd'hui sur Deal&Co. Mode, multimédia, maison, véhicules — nouveautés en temps réel.",
  alternates: { canonical: `${BASE}/nouveautes` },
  openGraph: {
    title: "Nouvelles annonces du jour — Deal&Co",
    description: "Les dernières petites annonces publiées sur Deal&Co, mises à jour en temps réel.",
    url: `${BASE}/nouveautes`,
    siteName: "Deal&Co",
    locale: "fr_FR",
    type: "website",
  },
};

export default async function NouveautesPage() {
  const cutoff48h = new Date(Date.now() - 48 * 60 * 60 * 1000);

  const listings = await prisma.listing.findMany({
    where: {
      status: "APPROVED",
      deletedAt: null,
      createdAt: { gte: cutoff48h },
    },
    orderBy: { createdAt: "desc" },
    take: 60,
    select: {
      id: true,
      title: true,
      price: true,
      category: true,
      location: true,
      images: true,
      createdAt: true,
      isPremium: true,
    },
  });

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Nouvelles annonces — Deal&Co",
    url: `${BASE}/nouveautes`,
    numberOfItems: listings.length,
    itemListElement: listings.slice(0, 10).map((l, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `${BASE}${listingUrl(l.id, l.title)}`,
      name: l.title,
    })),
  };

  return (
    <div className="bg-surface text-on-surface min-h-screen mb-24 md:mb-0">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <Navbar />

      <main className="pt-32 pb-16 px-6 max-w-7xl mx-auto">
        <nav aria-label="Fil d'Ariane" className="mb-6 text-sm text-outline flex items-center gap-2">
          <Link href="/" className="hover:text-primary transition-colors">Accueil</Link>
          <span>/</span>
          <span className="text-on-surface font-semibold">Nouvelles annonces</span>
        </nav>

        <div className="mb-8">
          <h1 className="text-3xl font-extrabold tracking-tight text-on-surface">
            Nouvelles annonces
          </h1>
          <p className="text-outline mt-1">
            {listings.length} annonce{listings.length !== 1 ? "s" : ""} publiée{listings.length !== 1 ? "s" : ""} dans les 48 dernières heures
          </p>
        </div>

        {listings.length === 0 ? (
          <div className="text-center py-24">
            <span className="material-symbols-outlined text-5xl text-outline/30 block mb-3">inbox</span>
            <p className="text-on-surface-variant font-medium">Aucune nouvelle annonce pour le moment</p>
            <p className="text-outline text-sm mt-1">Revenez dans quelques instants</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-4">
            {listings.map((listing) => (
              <ListingCard
                key={listing.id}
                listing={listing}
                badge={{ label: "Nouveau", tone: "fresh" }}
              />
            ))}
          </div>
        )}
      </main>

      <SiteFooter />
      <BottomNav />
    </div>
  );
}
