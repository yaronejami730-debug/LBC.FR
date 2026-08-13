/**
 * Page de cote `/prix/{slug}`.
 *
 * Les critères d'existence et d'indexabilité vivent dans `lib/seo/price.ts` —
 * et ils ne parlent pas de stock. Voir l'en-tête de ce fichier pour le
 * raisonnement ; en deux lignes : une page de cote se positionne sur ce
 * qu'elle sait du marché, pas sur ce qu'elle a en rayon aujourd'hui.
 *
 * L'ancienne version faisait l'inverse : `noindex` sous trois annonces
 * actives, `notFound()` à zéro. `/prix/peugeot-308-occasion` — une requête à
 * volume réel — était donc sortie de l'index pour une raison qui n'a rien à
 * voir avec sa capacité à répondre.
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { listingUrl } from "@/lib/listing-slug";
import Navbar from "@/components/Navbar";
import SiteFooter from "@/components/SiteFooter";
import ListingCard from "@/components/home/ListingCard";
import PriceAlertForm from "@/components/PriceAlertForm";
import { safeJsonLd } from "@/lib/json-ld";
import { getPriceQuote, isPriceQuoteIndexable } from "@/lib/seo/price";

const BASE = "https://www.dealandcompany.fr";

export const revalidate = 3600;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const quote = await getPriceQuote(slug);

  // Pas de cote : la page répondra 404, inutile de lui composer un titre.
  if (!quote) return {};

  const { title, observations, activeCount } = quote;

  // Le `noindex` ne dépend plus du stock mais de la solidité de la cote. Une
  // page à douze observations et zéro annonce en ligne s'indexe : c'est même
  // le cas qui justifie son existence.
  if (!isPriceQuoteIndexable(quote)) {
    return {
      title: `Prix ${title} occasion`,
      alternates: { canonical: `${BASE}/prix/${slug}` },
      robots: { index: false, follow: true },
    };
  }

  const description =
    activeCount > 0
      ? `Prix moyen d'un(e) ${title} d'occasion, calculé sur ${observations} annonces entre particuliers. ${activeCount} annonce${activeCount > 1 ? "s" : ""} en ligne aujourd'hui.`
      : `Prix moyen d'un(e) ${title} d'occasion, calculé sur ${observations} annonces entre particuliers. Prix minimum et maximum constatés sur Deal&Co.`;

  return {
    title: `Prix ${title} occasion en France — Combien ça vaut ? — Deal&Co`,
    description,
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

  /**
   * 404 quand il n'y a pas de cote — et seulement dans ce cas.
   *
   * L'espace `/prix/*` est ouvert : n'importe quel slug atteint cette route.
   * Sans garde, chaque variante inventée produisait une page de plus à
   * explorer. Le seuil n'est pas là pour rationner l'index, il est là parce
   * qu'une moyenne sur deux prix n'est pas une cote et qu'on ne l'affichera
   * pas comme telle.
   */
  const quote = await getPriceQuote(slug);
  if (!quote) notFound();

  const { title, query, observations, average, min, max, activeCount } = quote;

  const listings =
    activeCount > 0
      ? await prisma.listing
          .findMany({
            where: {
              status: "APPROVED",
              deletedAt: null,
              price: { gt: 0 },
              OR: [
                { title: { contains: query, mode: "insensitive" } },
                { description: { contains: query, mode: "insensitive" } },
                { brand: { contains: query, mode: "insensitive" } },
              ],
            } as any,
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
              isPremium: true,
            },
          })
          .catch(() => [])
      : [];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `${title} d'occasion — Prix entre particuliers`,
    url: `${BASE}/prix/${slug}`,
    numberOfItems: listings.length,
    description: `Prix moyen constaté : ${average.toLocaleString("fr-FR")} €. Fourchette : ${min.toLocaleString("fr-FR")} € – ${max.toLocaleString("fr-FR")} €`,
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
          text: `En moyenne, un ${title} d'occasion se vend ${average.toLocaleString("fr-FR")} € entre particuliers en France. Les prix varient de ${min.toLocaleString("fr-FR")} € à ${max.toLocaleString("fr-FR")} € selon l'état et les caractéristiques. Cote établie sur ${observations} annonces.`,
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
    <div className="bg-surface text-on-surface min-h-screen">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(faqLd) }} />
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
          Cote établie sur {observations.toLocaleString("fr-FR")} annonce
          {observations > 1 ? "s" : ""} entre particuliers sur Deal&Co
        </p>

        {/* Prix cards */}
        <div className="grid grid-cols-3 gap-4 mb-10">
          {[
            { label: "Prix moyen", value: average, highlight: true },
            { label: "Prix minimum", value: min, highlight: false },
            { label: "Prix maximum", value: max, highlight: false },
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
            D&apos;après {observations.toLocaleString("fr-FR")} annonces entre particuliers sur Deal&Co, un {title.toLowerCase()} d&apos;occasion se négocie en moyenne autour de <strong>{average.toLocaleString("fr-FR")} €</strong>. Les prix varient de <strong>{min.toLocaleString("fr-FR")} €</strong> (état abîmé ou ancienne génération) à <strong>{max.toLocaleString("fr-FR")} €</strong> (état neuf ou modèle récent).
          </p>
          <p className="text-on-surface-variant leading-relaxed mt-3">
            Cette cote tient compte des annonces déjà vendues, pas seulement de celles en ligne aujourd&apos;hui : c&apos;est ce qui la rend stable d&apos;une semaine à l&apos;autre. Pour obtenir le meilleur prix, comparez plusieurs annonces et négociez en fonction de l&apos;état et des accessoires inclus.
          </p>
        </section>

        {/* Annonces, ou alerte si le stock est vide */}
        {listings.length > 0 ? (
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-on-surface">
                Annonces {title} d&apos;occasion disponibles
              </h2>
              {/* `rel="nofollow"` : `/search` est fermé au robots.txt (espace
                  d'URL illimité). Le lien reste utile au visiteur, il n'a rien
                  à proposer à un crawler. */}
              <Link href={searchUrl} rel="nofollow" className="text-sm text-primary font-semibold hover:underline">
                Voir tout →
              </Link>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-4">
              {listings.map((listing) => (
                <ListingCard key={listing.id} listing={listing} />
              ))}
            </div>

            <div className="mt-6 text-center">
              <Link
                href={searchUrl}
                rel="nofollow"
                className="inline-flex items-center gap-2 px-7 py-3 bg-primary text-white rounded-full font-bold shadow-md shadow-primary/20 active:scale-95 transition-transform"
              >
                <span className="material-symbols-outlined text-base">search</span>
                Voir toutes les annonces {title}
              </Link>
            </div>
          </section>
        ) : (
          <section>
            <PriceAlertForm label={`${title} d'occasion`} query={query} />
          </section>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}
