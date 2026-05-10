import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { CAR_BRANDS } from "@/lib/carBrands";
import { listingUrl } from "@/lib/listing-slug";
import { formatDistanceToNow } from "@/lib/utils";
import Navbar from "@/components/Navbar";
import BottomNav from "@/components/BottomNav";
import SiteFooter from "@/components/SiteFooter";
import DejaVuBadge from "@/components/DejaVuBadge";

const BASE = "https://www.dealandcompany.fr";
export const revalidate = 3600;

function slugToMarque(slug: string): string {
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ")
    .replace(/Benz$/, "-Benz")
    .replace(/Rover$/, "Rover");
}

function marqueToSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function generateStaticParams() {
  return CAR_BRANDS.map((b) => ({ marque: marqueToSlug(b.name) }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ marque: string }>;
}): Promise<Metadata> {
  const { marque: marqueSlug } = await params;
  const marque = slugToMarque(marqueSlug);
  const brand = CAR_BRANDS.find((b) => b.name.toLowerCase() === marque.toLowerCase());
  if (!brand) return {};

  const count = await prisma.listing.count({
    where: {
      status: "APPROVED",
      deletedAt: null,
      category: "Véhicules",
      metadata: { contains: brand.name, mode: "insensitive" },
    },
  }).catch(() => 0);

  return {
    title: `${brand.name} occasion entre particuliers — ${count} annonce${count !== 1 ? "s" : ""} — Deal&Co`,
    description: `Achetez une ${brand.name} d'occasion entre particuliers en France. ${count} annonce${count !== 1 ? "s" : ""} de particuliers sans commission. Toutes les ${brand.name} disponibles sur Deal&Co.`,
    alternates: { canonical: `${BASE}/annonces/vehicules/${marqueSlug}` },
    openGraph: {
      title: `${brand.name} occasion — Petites annonces particuliers`,
      description: `${count} ${brand.name} d'occasion entre particuliers en France. Sans frais d'agence, contact direct avec le vendeur.`,
      url: `${BASE}/annonces/vehicules/${marqueSlug}`,
      siteName: "Deal&Co",
      locale: "fr_FR",
      type: "website",
    },
  };
}

const PER_PAGE = 24;

export default async function MarquePage({
  params,
  searchParams,
}: {
  params: Promise<{ marque: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { marque: marqueSlug } = await params;
  const { page: pageParam } = await searchParams;

  const marque = slugToMarque(marqueSlug);
  const brand = CAR_BRANDS.find((b) => b.name.toLowerCase() === marque.toLowerCase());
  if (!brand) notFound();

  const page = Math.max(1, parseInt(pageParam ?? "1", 10));
  const skip = (page - 1) * PER_PAGE;

  const where = {
    status: "APPROVED",
    deletedAt: null,
    category: "Véhicules",
    metadata: { contains: brand.name, mode: "insensitive" },
  };

  const [listings, total, priceAgg] = await Promise.all([
    prisma.listing.findMany({
      where: where as any,
      orderBy: [{ isPremium: "desc" }, { createdAt: "desc" }],
      take: PER_PAGE,
      skip,
      select: {
        id: true,
        title: true,
        price: true,
        location: true,
        images: true,
        createdAt: true,
        isPremium: true,
        metadata: true,
        user: { select: { verified: true } },
      },
    }),
    prisma.listing.count({ where: where as any }),
    prisma.listing.aggregate({
      where: { ...where, price: { gt: 0 } } as any,
      _min: { price: true },
      _max: { price: true },
      _avg: { price: true },
    }),
  ]);

  if (total === 0 && page === 1) notFound();

  const totalPages = Math.ceil(total / PER_PAGE);
  const avgPrice = Math.round(priceAgg._avg.price ?? 0);
  const minPrice = Math.round(priceAgg._min.price ?? 0);

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Accueil", item: BASE },
      { "@type": "ListItem", position: 2, name: "Véhicules", item: `${BASE}/annonces/vehicules` },
      { "@type": "ListItem", position: 3, name: `${brand.name} occasion`, item: `${BASE}/annonces/vehicules/${marqueSlug}` },
    ],
  };

  const itemListLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `${brand.name} d'occasion entre particuliers`,
    url: `${BASE}/annonces/vehicules/${marqueSlug}`,
    numberOfItems: total,
    ...(priceAgg._min.price && priceAgg._max.price ? {
      offers: {
        "@type": "AggregateOffer",
        offerCount: total,
        lowPrice: priceAgg._min.price,
        highPrice: priceAgg._max.price,
        priceCurrency: "EUR",
      },
    } : {}),
    itemListElement: listings.slice(0, 10).map((l, i) => ({
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
        name: `Où acheter une ${brand.name} d'occasion entre particuliers ?`,
        acceptedAnswer: {
          "@type": "Answer",
          text: `Sur Deal&Co, vous trouverez ${total} annonce${total !== 1 ? "s" : ""} de ${brand.name} d'occasion publiées par des particuliers en France. Sans commission, sans intermédiaire, contact direct avec le vendeur.`,
        },
      },
      {
        "@type": "Question",
        name: `Quel est le prix d'une ${brand.name} d'occasion entre particuliers ?`,
        acceptedAnswer: {
          "@type": "Answer",
          text: avgPrice > 0
            ? `En moyenne, une ${brand.name} d'occasion se vend ${avgPrice.toLocaleString("fr-FR")} € entre particuliers sur Deal&Co. Les prix démarrent à ${minPrice.toLocaleString("fr-FR")} €.`
            : `Consultez les annonces de ${brand.name} d'occasion sur Deal&Co pour comparer les prix entre particuliers.`,
        },
      },
    ],
  };

  return (
    <div className="bg-surface text-on-surface min-h-screen mb-24 md:mb-0">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />
      <Navbar />

      <main className="pt-32 pb-16 px-6 max-w-7xl mx-auto">
        {/* Breadcrumb */}
        <nav aria-label="Fil d'Ariane" className="mb-6 text-sm text-outline flex items-center gap-2">
          <Link href="/" className="hover:text-primary transition-colors">Accueil</Link>
          <span>/</span>
          <Link href="/annonces/vehicules" className="hover:text-primary transition-colors">Véhicules</Link>
          <span>/</span>
          <span className="text-on-surface font-semibold">{brand.name}</span>
        </nav>

        {/* Header */}
        <div className="mb-8 flex items-start gap-5">
          {brand.logo && (
            <div className="shrink-0 w-16 h-16 bg-white rounded-2xl border border-surface-container flex items-center justify-center p-2 shadow-sm">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={brand.logo} alt={`Logo ${brand.name}`} className="w-full h-full object-contain" />
            </div>
          )}
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-on-surface font-['Manrope']">
              {brand.name} d&apos;occasion entre particuliers
            </h1>
            <p className="text-outline mt-1">
              {total.toLocaleString("fr-FR")} annonce{total !== 1 ? "s" : ""} · Sans commission · Contact direct
            </p>
            {avgPrice > 0 && (
              <p className="text-sm text-primary font-semibold mt-1">
                Prix moyen : {avgPrice.toLocaleString("fr-FR")} € · À partir de {minPrice.toLocaleString("fr-FR")} €
              </p>
            )}
          </div>
        </div>

        {/* Intro SEO */}
        <div className="bg-white rounded-2xl border border-surface-container p-5 mb-8 text-sm text-on-surface-variant leading-relaxed">
          <p>
            Achetez une <strong>{brand.name} d&apos;occasion</strong> directement auprès d&apos;un particulier en France — sans frais d&apos;agence, sans commission.
            Deal&amp;Co vous met en contact direct avec les vendeurs de {brand.name} partout en France.
            Comparez les prix, vérifiez les photos et contactez le vendeur en un clic.
          </p>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-4">
          {listings.map((listing) => {
            const imgs = JSON.parse(listing.images) as string[];
            const img = imgs[0] || undefined;
            let meta: Record<string, string> = {};
            try { meta = JSON.parse(listing.metadata); } catch { /* empty */ }

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
                      <span className="material-symbols-outlined text-3xl text-outline/30">directions_car</span>
                    </div>
                  )}
                  {listing.isPremium && (
                    <span className="absolute top-2 left-2 bg-secondary-container text-on-secondary-container text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">Premium</span>
                  )}
                  <DejaVuBadge listingId={listing.id} />
                </div>
                <div className="p-2.5 flex flex-col gap-0.5">
                  <p className="text-on-surface font-semibold text-sm leading-snug line-clamp-2">{listing.title}</p>
                  <p className="text-primary font-bold text-base mt-1">{listing.price.toLocaleString("fr-FR")} €</p>
                  {meta.annee && <p className="text-outline text-xs">{meta.annee}{meta.kilometrage ? ` · ${Number(String(meta.kilometrage).replace(/\D/g, "")).toLocaleString("fr-FR")} km` : ""}</p>}
                  <p className="text-outline text-xs truncate">{listing.location}</p>
                  <p className="text-outline/70 text-[10px]">{formatDistanceToNow(listing.createdAt)}</p>
                </div>
              </Link>
            );
          })}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <nav className="flex items-center justify-center gap-2 mt-10" aria-label="Pagination">
            {page > 1 && (
              <Link href={`/annonces/vehicules/${marqueSlug}?page=${page - 1}`} rel="prev"
                className="px-4 py-2 rounded-xl border border-surface-container bg-white text-on-surface hover:border-primary/40 text-sm font-semibold transition-colors">
                ← Précédent
              </Link>
            )}
            <span className="text-sm text-outline">Page {page} / {totalPages}</span>
            {page < totalPages && (
              <Link href={`/annonces/vehicules/${marqueSlug}?page=${page + 1}`} rel="next"
                className="px-4 py-2 rounded-xl border border-surface-container bg-white text-on-surface hover:border-primary/40 text-sm font-semibold transition-colors">
                Suivant →
              </Link>
            )}
          </nav>
        )}

        {/* SEO text bottom */}
        <section className="mt-12 prose prose-slate max-w-none">
          <h2 className="text-xl font-bold text-on-surface font-['Manrope']">
            Acheter une {brand.name} d&apos;occasion sans agence
          </h2>
          <p className="text-on-surface-variant text-sm leading-relaxed mt-3">
            Contrairement aux concessions ou aux sites spécialisés qui prennent une commission, Deal&amp;Co vous permet d&apos;acheter votre {brand.name} directement auprès du particulier.
            Pas de frais cachés, pas de marges de négociant. Le prix affiché est le prix négocié directement avec le propriétaire.
          </p>
          <p className="text-on-surface-variant text-sm leading-relaxed mt-2">
            Avant d&apos;acheter, vérifiez l&apos;historique du véhicule sur{" "}
            <a href="https://histovec.interieur.gouv.fr" target="_blank" rel="noopener noreferrer" className="text-primary">Histovec</a>{" "}
            et le statut administratif sur Cartegrise.gouv.fr. Pour un achat serein, faites réaliser une expertise pré-achat (Dekra, Autovision, Sécuritest).
          </p>
        </section>

        {/* Other brands */}
        <section className="mt-10">
          <h3 className="text-base font-bold text-on-surface mb-3">Autres marques disponibles</h3>
          <div className="flex flex-wrap gap-2">
            {CAR_BRANDS.filter((b) => b.name !== brand.name).slice(0, 12).map((b) => (
              <Link
                key={b.name}
                href={`/annonces/vehicules/${marqueToSlug(b.name)}`}
                className="px-3 py-1.5 bg-white border border-surface-container rounded-full text-xs font-semibold text-on-surface-variant hover:border-primary/40 hover:text-primary transition-colors"
              >
                {b.name}
              </Link>
            ))}
          </div>
        </section>
      </main>

      <SiteFooter />
      <BottomNav />
    </div>
  );
}
