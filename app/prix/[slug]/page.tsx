import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { listingUrl, listingSlug } from "@/lib/listing-slug";
import { formatDistanceToNow } from "@/lib/utils";
import Navbar from "@/components/Navbar";
import BottomNav from "@/components/BottomNav";
import SiteFooter from "@/components/SiteFooter";

const BASE = "https://www.dealandcompany.fr";

export const revalidate = 3600;

function slugToQuery(slug: string): string {
  return slug
    .replace(/-occasion$/i, "")
    .replace(/-/g, " ")
    .trim();
}

function slugToTitle(slug: string): string {
  const query = slugToQuery(slug);
  return query
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const query = slugToQuery(slug);
  const title = slugToTitle(slug);

  const count = await prisma.listing.count({
    where: {
      status: "APPROVED",
      deletedAt: null,
      OR: [
        { title: { contains: query, mode: "insensitive" } },
        { description: { contains: query, mode: "insensitive" } },
        { brand: { contains: query, mode: "insensitive" } },
      ],
    },
  }).catch(() => 0);

  if (count === 0) return { title: `Prix ${title} occasion` };

  return {
    title: `Prix ${title} occasion en France — Combien ça vaut ? — Deal&Co`,
    description: `${count} annonce${count > 1 ? "s" : ""} de ${title} d'occasion. Prix moyen, prix minimum et maximum constatés sur les petites annonces Deal&Co entre particuliers.`,
    alternates: { canonical: `${BASE}/prix/${slug}` },
    openGraph: {
      title: `Prix ${title} occasion`,
      description: `Combien vaut un(e) ${title} d'occasion ? Consultez les prix réels des annonces entre particuliers.`,
      url: `${BASE}/prix/${slug}`,
      siteName: "Deal&Co",
      locale: "fr_FR",
      type: "website",
    },
  };
}

export default async function PrixPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const query = slugToQuery(slug);
  const title = slugToTitle(slug);

  const where = {
    status: "APPROVED",
    deletedAt: null,
    price: { gt: 0 },
    OR: [
      { title: { contains: query, mode: "insensitive" } },
      { description: { contains: query, mode: "insensitive" } },
      { brand: { contains: query, mode: "insensitive" } },
    ],
  };

  const [listings, agg] = await Promise.all([
    prisma.listing.findMany({
      where: where as any,
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        title: true,
        price: true,
        location: true,
        condition: true,
        images: true,
        createdAt: true,
      },
    }),
    prisma.listing.aggregate({
      where: where as any,
      _avg: { price: true },
      _min: { price: true },
      _max: { price: true },
      _count: { _all: true },
    }),
  ]);

  if (agg._count._all === 0) notFound();

  const avgPrice = Math.round(agg._avg.price ?? 0);
  const minPrice = Math.round(agg._min.price ?? 0);
  const maxPrice = Math.round(agg._max.price ?? 0);
  const count = agg._count._all;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `${title} d'occasion — Prix entre particuliers`,
    url: `${BASE}/prix/${slug}`,
    numberOfItems: count,
    description: `Prix moyen constaté : ${avgPrice.toLocaleString("fr-FR")} €. Fourchette : ${minPrice.toLocaleString("fr-FR")} € – ${maxPrice.toLocaleString("fr-FR")} €`,
    itemListElement: listings.slice(0, 5).map((l, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `${BASE}${listingUrl(l.id, l.title)}`,
      name: l.title,
    })),
  };

  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: `Combien vaut un ${title} d'occasion ?`,
        acceptedAnswer: {
          "@type": "Answer",
          text: `En moyenne, un ${title} d'occasion se vend ${avgPrice.toLocaleString("fr-FR")} € entre particuliers en France. Les prix varient de ${minPrice.toLocaleString("fr-FR")} € à ${maxPrice.toLocaleString("fr-FR")} € selon l'état et les caractéristiques.`,
        },
      },
      {
        "@type": "Question",
        name: `Où acheter un ${title} d'occasion entre particuliers ?`,
        acceptedAnswer: {
          "@type": "Answer",
          text: `Sur Deal&Co (dealandcompany.fr), vous trouverez des annonces de ${title} d'occasion publiées par des particuliers partout en France, sans commission.`,
        },
      },
    ],
  };

  const searchUrl = `/search?q=${encodeURIComponent(query)}`;

  return (
    <div className="bg-surface text-on-surface min-h-screen mb-24 md:mb-0">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />
      <Navbar />

      <main className="pt-32 pb-16 px-6 max-w-4xl mx-auto">
        <nav aria-label="Fil d'Ariane" className="mb-6 text-sm text-outline flex items-center gap-2">
          <Link href="/" className="hover:text-primary transition-colors">Accueil</Link>
          <span>/</span>
          <span className="text-on-surface font-semibold">Prix {title} occasion</span>
        </nav>

        <h1 className="text-3xl font-extrabold tracking-tight text-on-surface font-['Manrope'] mb-2">
          Prix {title} d&apos;occasion
        </h1>
        <p className="text-outline mb-8">
          Basé sur {count.toLocaleString("fr-FR")} annonce{count > 1 ? "s" : ""} entre particuliers sur Deal&Co
        </p>

        {/* Prix cards */}
        <div className="grid grid-cols-3 gap-4 mb-10">
          {[
            { label: "Prix moyen", value: avgPrice, highlight: true },
            { label: "Prix minimum", value: minPrice, highlight: false },
            { label: "Prix maximum", value: maxPrice, highlight: false },
          ].map((stat) => (
            <div
              key={stat.label}
              className={`rounded-2xl border p-5 text-center ${stat.highlight ? "bg-primary text-white border-primary shadow-lg shadow-primary/20" : "bg-white border-surface-container"}`}
            >
              <p className={`text-2xl font-extrabold font-['Manrope'] ${stat.highlight ? "text-white" : "text-primary"}`}>
                {stat.value.toLocaleString("fr-FR")} €
              </p>
              <p className={`text-sm mt-1 ${stat.highlight ? "text-white/80" : "text-outline"}`}>{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Analyse */}
        <section className="bg-white rounded-2xl border border-surface-container p-6 mb-10">
          <h2 className="text-xl font-bold text-on-surface mb-3">
            Combien vaut un {title} d&apos;occasion ?
          </h2>
          <p className="text-on-surface-variant leading-relaxed">
            D&apos;après les annonces récentes entre particuliers sur Deal&Co, un {title.toLowerCase()} d&apos;occasion se négocie en moyenne autour de <strong>{avgPrice.toLocaleString("fr-FR")} €</strong>. Les prix varient de <strong>{minPrice.toLocaleString("fr-FR")} €</strong> (état abîmé ou ancienne génération) à <strong>{maxPrice.toLocaleString("fr-FR")} €</strong> (état neuf ou modèle récent).
          </p>
          <p className="text-on-surface-variant leading-relaxed mt-3">
            Ces données sont calculées en temps réel à partir des annonces actives entre particuliers. Pour obtenir le meilleur prix, comparez plusieurs annonces et négociez en fonction de l&apos;état et des accessoires inclus.
          </p>
        </section>

        {/* Annonces */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-on-surface">
              Annonces {title} d&apos;occasion disponibles
            </h2>
            <Link href={searchUrl} className="text-sm text-primary font-semibold hover:underline">
              Voir tout →
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {listings.map((listing) => {
              const images = JSON.parse(listing.images) as string[];
              const img = images[0] || undefined;
              return (
                <Link
                  key={listing.id}
                  href={listingUrl(listing.id, listing.title)}
                  className="group flex flex-col bg-white rounded-xl overflow-hidden border border-surface-container hover:shadow-md transition-all"
                >
                  <div className="relative aspect-square overflow-hidden bg-surface-container-low">
                    {img ? (
                      <Image
                        src={img}
                        alt={listing.title}
                        fill
                        sizes="(max-width:640px) 50vw,25vw"
                        className="object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <span className="material-symbols-outlined text-3xl text-outline/30">image</span>
                      </div>
                    )}
                  </div>
                  <div className="p-2.5 flex flex-col gap-0.5">
                    <p className="text-on-surface font-semibold text-sm leading-snug line-clamp-2">{listing.title}</p>
                    <p className="text-primary font-bold">{listing.price.toLocaleString("fr-FR")} €</p>
                    <p className="text-outline text-xs truncate">{listing.location}</p>
                    <p className="text-outline/60 text-[10px]">{formatDistanceToNow(listing.createdAt)}</p>
                  </div>
                </Link>
              );
            })}
          </div>

          <div className="mt-6 text-center">
            <Link
              href={searchUrl}
              className="inline-flex items-center gap-2 px-7 py-3 bg-primary text-white rounded-full font-bold shadow-md shadow-primary/20 active:scale-95 transition-transform"
            >
              <span className="material-symbols-outlined text-base">search</span>
              Voir toutes les annonces {title}
            </Link>
          </div>
        </section>
      </main>

      <SiteFooter />
      <BottomNav />
    </div>
  );
}
