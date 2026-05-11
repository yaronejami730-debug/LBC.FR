import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { CAR_BRANDS } from "@/lib/carBrands";
import { listingUrl } from "@/lib/listing-slug";
import { formatDistanceToNow } from "@/lib/utils";
import Navbar from "@/components/Navbar";
import BottomNav from "@/components/BottomNav";
import SiteFooter from "@/components/SiteFooter";

const BASE = "https://www.dealandcompany.fr";
export const revalidate = 3600;
export const dynamicParams = true;

function slugify(str: string): string {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function slugToMarqueLabel(slug: string): string | null {
  return CAR_BRANDS.find((b) => slugify(b.name) === slug)?.name ?? null;
}

const getListings = cache(
  async (marque: string, modeleSlug: string) => {
    const rows = await prisma.listing.findMany({
      where: {
        status: "APPROVED",
        deletedAt: null,
        shadowBanned: false,
        category: "Véhicules",
        metadata: { contains: marque, mode: "insensitive" },
      } as any,
      orderBy: [{ isPremium: "desc" }, { createdAt: "desc" }],
      take: 200,
      select: {
        id: true,
        title: true,
        price: true,
        images: true,
        location: true,
        createdAt: true,
        metadata: true,
        isPremium: true,
      },
    }).catch(() => []);

    return rows.filter((l) => {
      try {
        const meta = JSON.parse(l.metadata) as { modele?: string };
        if (!meta.modele) return false;
        return slugify(meta.modele) === modeleSlug;
      } catch {
        return false;
      }
    });
  },
);

export async function generateMetadata({
  params,
}: {
  params: Promise<{ marque: string; modele: string }>;
}): Promise<Metadata> {
  const { marque, modele } = await params;
  const marqueLabel = slugToMarqueLabel(marque);
  if (!marqueLabel) return {};

  const rows = await getListings(marqueLabel, modele);
  if (rows.length === 0) return { robots: { index: false, follow: true } };

  const sampleModel =
    rows
      .map((l) => {
        try {
          return JSON.parse(l.metadata).modele as string;
        } catch {
          return null;
        }
      })
      .find(Boolean) ?? modele;

  const canonical = `${BASE}/annonces/vehicules/${marque}/${modele}`;
  const title = `${marqueLabel} ${sampleModel} occasion — ${rows.length} annonce${rows.length > 1 ? "s" : ""} entre particuliers`;
  const description = `${rows.length} ${marqueLabel} ${sampleModel} d'occasion entre particuliers. Sans commission, contact direct vendeur. Comparez les prix sur Deal&Co.`;

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: "Deal&Co",
      type: "website",
      locale: "fr_FR",
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

const PER_PAGE = 24;

export default async function ModelePage({
  params,
  searchParams,
}: {
  params: Promise<{ marque: string; modele: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { marque, modele } = await params;
  const { page: pageParam } = await searchParams;

  const marqueLabel = slugToMarqueLabel(marque);
  if (!marqueLabel) notFound();

  const rows = await getListings(marqueLabel, modele);
  if (rows.length === 0) notFound();

  const sampleModel =
    rows
      .map((l) => {
        try {
          return JSON.parse(l.metadata).modele as string;
        } catch {
          return null;
        }
      })
      .find(Boolean) ?? modele;

  const page = Math.max(1, parseInt(pageParam ?? "1", 10));
  const skip = (page - 1) * PER_PAGE;
  const listings = rows.slice(skip, skip + PER_PAGE);
  const totalPages = Math.ceil(rows.length / PER_PAGE);

  const prices = rows.map((l) => l.price).filter((p) => p > 0);
  const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
  const maxPrice = prices.length > 0 ? Math.max(...prices) : 0;
  const avgPrice = prices.length > 0 ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) : 0;

  const pageUrl = `${BASE}/annonces/vehicules/${marque}/${modele}`;

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Accueil", item: BASE },
      { "@type": "ListItem", position: 2, name: "Véhicules", item: `${BASE}/annonces/vehicules` },
      { "@type": "ListItem", position: 3, name: marqueLabel, item: `${BASE}/annonces/vehicules/${marque}` },
      { "@type": "ListItem", position: 4, name: sampleModel, item: pageUrl },
    ],
  };

  const itemListLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `${marqueLabel} ${sampleModel} d'occasion`,
    url: pageUrl,
    numberOfItems: rows.length,
    ...(minPrice && maxPrice
      ? {
          offers: {
            "@type": "AggregateOffer",
            offerCount: rows.length,
            lowPrice: minPrice,
            highPrice: maxPrice,
            priceCurrency: "EUR",
          },
        }
      : {}),
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
        name: `Combien coûte une ${marqueLabel} ${sampleModel} d'occasion ?`,
        acceptedAnswer: {
          "@type": "Answer",
          text: avgPrice > 0
            ? `Le prix moyen d'une ${marqueLabel} ${sampleModel} d'occasion sur Deal&Co est de ${avgPrice.toLocaleString("fr-FR")} €. Les prix démarrent à ${minPrice.toLocaleString("fr-FR")} € et montent jusqu'à ${maxPrice.toLocaleString("fr-FR")} €.`
            : `Consultez les annonces de ${marqueLabel} ${sampleModel} d'occasion sur Deal&Co pour comparer les prix entre particuliers.`,
        },
      },
      {
        "@type": "Question",
        name: `Où trouver une ${marqueLabel} ${sampleModel} entre particuliers ?`,
        acceptedAnswer: {
          "@type": "Answer",
          text: `Sur Deal&Co, ${rows.length} annonces de ${marqueLabel} ${sampleModel} sont publiées par des particuliers partout en France. Contact direct, sans intermédiaire, sans commission.`,
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
        <nav aria-label="Fil d'Ariane" className="mb-6 text-sm text-outline flex items-center gap-2 flex-wrap">
          <Link href="/" className="hover:text-primary transition-colors">Accueil</Link>
          <span>/</span>
          <Link href="/annonces/vehicules" className="hover:text-primary transition-colors">Véhicules</Link>
          <span>/</span>
          <Link href={`/annonces/vehicules/${marque}`} className="hover:text-primary transition-colors">{marqueLabel}</Link>
          <span>/</span>
          <span className="text-on-surface font-semibold">{sampleModel}</span>
        </nav>

        <header className="mb-8">
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-on-surface font-['Manrope']">
            {marqueLabel} {sampleModel} d&apos;occasion
          </h1>
          <p className="text-outline mt-2">
            {rows.length.toLocaleString("fr-FR")} annonce{rows.length > 1 ? "s" : ""} · Entre particuliers · Sans commission
          </p>
          {avgPrice > 0 && (
            <p className="text-sm text-primary font-semibold mt-1">
              Prix moyen : {avgPrice.toLocaleString("fr-FR")} € · À partir de {minPrice.toLocaleString("fr-FR")} €
            </p>
          )}
        </header>

        <section className="bg-white rounded-2xl border border-surface-container p-5 mb-8 text-sm text-on-surface-variant leading-relaxed">
          <p>
            Achetez votre <strong>{marqueLabel} {sampleModel}</strong> d&apos;occasion directement auprès d&apos;un particulier sur Deal&amp;Co.
            Sans intermédiaire, sans commission, sans frais d&apos;agence — vous payez le prix négocié directement avec le propriétaire.
            {rows.length} annonces sont actuellement disponibles partout en France.
          </p>
        </section>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-4">
          {listings.map((l) => {
            let img = "";
            try {
              const imgs = JSON.parse(l.images) as string[];
              img = imgs[0] ?? "";
            } catch {}
            let meta: Record<string, string> = {};
            try { meta = JSON.parse(l.metadata); } catch {}
            return (
              <Link
                key={l.id}
                href={listingUrl(l.id, l.title)}
                className="group flex flex-col bg-white rounded-xl overflow-hidden border border-surface-container hover:shadow-md transition-all"
              >
                <div className="relative aspect-square bg-surface-container-low overflow-hidden">
                  {img ? (
                    <Image
                      src={img}
                      alt={`${l.title} — ${l.location}`}
                      fill
                      sizes="(max-width:640px) 50vw,(max-width:1024px) 33vw,20vw"
                      className="object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="material-symbols-outlined text-3xl text-outline/30">directions_car</span>
                    </div>
                  )}
                  {l.isPremium && (
                    <span className="absolute top-2 left-2 bg-secondary-container text-on-secondary-container text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">
                      Premium
                    </span>
                  )}
                </div>
                <div className="p-2.5 flex flex-col gap-0.5">
                  <p className="text-on-surface font-semibold text-sm leading-snug line-clamp-2">{l.title}</p>
                  <p className="text-primary font-bold text-base mt-1">{l.price.toLocaleString("fr-FR")} €</p>
                  {meta.annee && (
                    <p className="text-outline text-xs">
                      {meta.annee}
                      {meta.kilometrage
                        ? ` · ${Number(String(meta.kilometrage).replace(/\D/g, "")).toLocaleString("fr-FR")} km`
                        : ""}
                    </p>
                  )}
                  <p className="text-outline text-xs truncate">{l.location}</p>
                  <p className="text-outline/70 text-[10px]">{formatDistanceToNow(l.createdAt)}</p>
                </div>
              </Link>
            );
          })}
        </div>

        {totalPages > 1 && (
          <nav aria-label="Pagination" className="flex items-center justify-center gap-2 mt-10">
            {page > 1 && (
              <Link
                href={page === 2 ? pageUrl : `${pageUrl}?page=${page - 1}`}
                rel="prev"
                className="px-4 py-2 rounded-xl border border-surface-container bg-white text-on-surface hover:border-primary/40 text-sm font-semibold"
              >
                ← Précédent
              </Link>
            )}
            <span className="text-sm text-outline">Page {page} / {totalPages}</span>
            {page < totalPages && (
              <Link
                href={`${pageUrl}?page=${page + 1}`}
                rel="next"
                className="px-4 py-2 rounded-xl border border-surface-container bg-white text-on-surface hover:border-primary/40 text-sm font-semibold"
              >
                Suivant →
              </Link>
            )}
          </nav>
        )}

        <section className="mt-12 prose prose-slate max-w-none">
          <h2 className="text-xl font-bold text-on-surface font-['Manrope']">
            Acheter une {marqueLabel} {sampleModel} sans agence
          </h2>
          <p className="text-on-surface-variant text-sm leading-relaxed mt-3">
            Deal&amp;Co vous permet d&apos;acheter une <strong>{marqueLabel} {sampleModel}</strong> directement auprès du propriétaire, sans commission ni frais d&apos;intermédiaire.
            Vérifiez l&apos;historique du véhicule sur{" "}
            <a href="https://histovec.interieur.gouv.fr" target="_blank" rel="noopener noreferrer" className="text-primary">Histovec</a> avant achat et faites réaliser une expertise pré-achat indépendante pour rouler en confiance.
          </p>
        </section>
      </main>

      <SiteFooter />
      <BottomNav />
    </div>
  );
}
