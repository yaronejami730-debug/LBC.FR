import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { formatDistanceToNow } from "@/lib/utils";
import Navbar from "@/components/Navbar";
import BottomNav from "@/components/BottomNav";
import SiteFooter from "@/components/SiteFooter";
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
            {listings.map((listing) => {
              const images = JSON.parse(listing.images) as string[];
              const img = images[0] || undefined;
              return (
                <Link
                  key={listing.id}
                  href={listingUrl(listing.id, listing.title)}
                  className="group flex flex-col bg-white rounded-xl overflow-hidden border border-surface-container hover:shadow-md transition-all duration-200"
                >
                  <div className="relative aspect-square overflow-hidden bg-surface-container-low">
                    {img ? (
                      <Image
                        src={img}
                        alt={listing.title}
                        fill
                        sizes="(max-width:640px) 50vw,(max-width:1024px) 33vw,20vw"
                        className="object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <span className="material-symbols-outlined text-3xl text-outline/30">image</span>
                      </div>
                    )}
                    {listing.isPremium && (
                      <span className="absolute top-2 left-2 bg-secondary-container text-on-secondary-container text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">
                        Premium
                      </span>
                    )}
                    <span className="absolute top-2 right-2 bg-green-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                      Nouveau
                    </span>
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

      <SiteFooter />
      <BottomNav />
    </div>
  );
}
