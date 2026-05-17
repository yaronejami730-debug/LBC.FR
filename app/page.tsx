import { Fragment } from "react";
import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { getActiveAds } from "@/lib/ads";
import { formatDistanceToNow } from "@/lib/utils";
import Navbar from "@/components/Navbar";
import BottomNav from "@/components/BottomNav";
import AdCarousel from "@/components/AdCarousel";
import HomeRecommendations from "@/components/HomeRecommendations";
import DejaVuBadge from "@/components/DejaVuBadge";
import SiteFooter from "@/components/SiteFooter";
import { listingUrl } from "@/lib/listing-slug";

export const metadata: Metadata = {
  title: { absolute: "Petites annonces gratuites entre particuliers — Deal&Co" },
  description:
    "Achetez et vendez d'occasion près de chez vous : voitures, immobilier, mode, multimédia. Petites annonces gratuites entre particuliers partout en France.",
  keywords: [
    "petites annonces gratuites France",
    "occasion France",
    "vente entre particuliers",
    "seconde main France",
    "marketplace France",
    "déposer annonce gratuite",
    "voitures occasion",
    "immobilier particulier",
    "matériel professionnel occasion",
    "petites annonces DOM-TOM",
  ],
  alternates: { canonical: "https://www.dealandcompany.fr" },
};

const HOME_FAQ = [
  {
    q: "Qu'est-ce que Deal&Co ?",
    a: "Deal&Co est un site français de petites annonces gratuites entre particuliers et professionnels, permettant l'achat, la vente et l'échange de véhicules, biens immobiliers, mode, électronique, mobilier et plus de 14 catégories de biens partout en France, sans commission ni intermédiaire.",
  },
  {
    q: "La publication d'annonces est-elle gratuite sur Deal&Co ?",
    a: "Oui, la publication d'annonces entre particuliers est entièrement gratuite sur Deal&Co, sans limite de nombre d'annonces actives. Des options payantes de mise en avant existent pour les vendeurs souhaitant gagner en visibilité, mais elles sont totalement facultatives.",
  },
  {
    q: "Comment vendre un objet rapidement sur Deal&Co ?",
    a: "Créez un compte gratuit, cliquez sur « Publier une annonce », sélectionnez la catégorie correspondante, ajoutez un titre précis avec la marque et le modèle, des photos en lumière naturelle et un prix légèrement sous le marché. La modération valide l'annonce en quelques minutes et les premiers contacts arrivent généralement dans les 24 heures.",
  },
  {
    q: "Deal&Co prélève-t-il une commission sur les ventes ?",
    a: "Non. Aucune commission n'est prélevée sur les transactions entre particuliers. Les vendeurs et acheteurs traitent en direct, sans intermédiaire ni frais cachés.",
  },
  {
    q: "Dans quelles villes Deal&Co est-il disponible ?",
    a: "Deal&Co couvre toute la France métropolitaine et l'outre-mer (Martinique, Guadeloupe, La Réunion, Guyane, Mayotte). Plus de 150 villes principales disposent de pages dédiées par catégorie, dont Paris, Lyon, Marseille, Toulouse, Bordeaux, Lille, Nantes, Strasbourg, Fort-de-France et Saint-Denis.",
  },
  {
    q: "Quel est le meilleur site de petites annonces gratuites en France ?",
    a: "Deal&Co se distingue par sa gratuité totale pour les particuliers, sa couverture nationale incluant les DOM-TOM, et ses pages locales dédiées par catégorie et par ville. Contrairement aux grandes plateformes, Deal&Co ne prélève aucune commission et met en relation directe acheteurs et vendeurs partout en France.",
  },
  {
    q: "Comment acheter en toute sécurité sur Deal&Co ?",
    a: "Vérifiez le profil et les évaluations du vendeur, communiquez uniquement via la messagerie interne avant de partager vos coordonnées, organisez la remise en main propre dans un lieu public, et payez uniquement à la remise de l'objet. Ne faites jamais de virement avant d'avoir reçu et vérifié l'article.",
  },
  {
    q: "Comment trouver des bonnes affaires près de chez moi sur Deal&Co ?",
    a: "Utilisez la recherche par localisation et activez les alertes de recherche sauvegardée pour être notifié dès qu'une annonce correspondant à vos critères est publiée dans votre zone. Filtrez par catégorie, fourchette de prix et distance pour affiner les résultats en temps réel.",
  },
  {
    q: "Deal&Co propose-t-il des annonces d'emploi et de services locaux ?",
    a: "Oui. Deal&Co référence des offres d'emploi (CDD, CDI, missions ponctuelles, saisonniers) et des annonces de services de proximité (baby-sitting, cours particuliers, jardinage, bricolage, ménage) dans toutes les régions de France. Ces catégories permettent de trouver ou proposer des services localement, sans intermédiaire.",
  },
  {
    q: "Peut-on publier des annonces immobilières gratuitement sur Deal&Co ?",
    a: "Oui. La publication d'annonces immobilières — vente, location, colocation — est gratuite pour les particuliers sur Deal&Co. Vous pouvez vendre ou louer votre bien sans passer par une agence, économisant ainsi 3 à 8 % du prix de vente ou 1 à 2 mois de loyer en honoraires d'agence.",
  },
];

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": "https://www.dealandcompany.fr/#website",
      name: "Deal&Co",
      alternateName: ["Deal and Co", "Dealandcompany"],
      url: "https://www.dealandcompany.fr",
      inLanguage: "fr-FR",
      description:
        "Petites annonces gratuites entre particuliers en France — voitures, immobilier, mode, électronique.",
      publisher: { "@id": "https://www.dealandcompany.fr/#org" },
      potentialAction: {
        "@type": "SearchAction",
        target: {
          "@type": "EntryPoint",
          urlTemplate: "https://www.dealandcompany.fr/search?q={search_term_string}",
        },
        "query-input": "required name=search_term_string",
      },
    },
    {
      "@type": "Organization",
      "@id": "https://www.dealandcompany.fr/#org",
      name: "Deal&Co",
      alternateName: ["Deal and Co", "Dealandcompany", "dealandcompany.fr"],
      url: "https://www.dealandcompany.fr",
      logo: {
        "@type": "ImageObject",
        url: "https://www.dealandcompany.fr/logo-dealco.png",
        width: 500,
        height: 160,
      },
      foundingDate: "2024",
      foundingLocation: { "@type": "Country", name: "France" },
      areaServed: { "@type": "Country", name: "France" },
      knowsLanguage: ["fr"],
      description:
        "Deal&Co est un site français de petites annonces gratuites entre particuliers et professionnels, sans commission, couvrant 14 catégories principales (véhicules, immobilier, mode, multimédia, maison, loisirs, animaux, services, emploi, bébé & enfant, vacances et divers) partout en France.",
      slogan: "Achetez et vendez près de chez vous, gratuitement",
      email: "contact@dealandcompany.fr",
      contactPoint: {
        "@type": "ContactPoint",
        contactType: "customer service",
        email: "contact@dealandcompany.fr",
        availableLanguage: "fr",
      },
      sameAs: [
        "https://www.dealandcompany.fr",
      ],
    },
    {
      "@type": "FAQPage",
      "@id": "https://www.dealandcompany.fr/#faq",
      mainEntity: HOME_FAQ.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    },
  ],
};

export default async function Home() {
  const now = new Date();
  const [listings, ads, activeBanner] = await Promise.all([
    prisma.listing.findMany({
      where: { status: "APPROVED", deletedAt: null } as any,
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { user: { select: { name: true, verified: true } } },
    }),
    getActiveAds(5).catch(() => []),
    prisma.heroBanner.findFirst({
      where: {
        isActive: true,
        OR: [{ startsAt: null }, { startsAt: { lte: now } }],
        AND: [{ OR: [{ endsAt: null }, { endsAt: { gte: now } }] }],
      },
      orderBy: { createdAt: "desc" },
    }).catch(() => null),
  ]);

  return (
    <div className="bg-surface text-on-surface mb-24 md:mb-0">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Navbar active="accueil" />

      {/* Hero */}
      <header className="pt-24 md:pt-44 pb-4 px-4 max-w-7xl mx-auto">
        <div
          className="relative rounded-2xl p-6 md:p-10 overflow-hidden min-h-[120px]"
          style={activeBanner?.bgImage
            ? {
                backgroundImage: `url(${activeBanner.bgImage})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }
            : {
                background: activeBanner
                  ? `linear-gradient(135deg, ${activeBanner.bgFrom}, ${activeBanner.bgTo})`
                  : "linear-gradient(to bottom right, #2f6fb8, #1a5a9e)",
              }}
        >
          {/* Voile sombre uniquement si photo — pour lisibilité du texte */}
          {activeBanner?.bgImage && (
            <div className="absolute inset-0 bg-black/35 rounded-2xl" />
          )}
          <div className="relative z-10 max-w-2xl">
            <h1 className="text-white text-3xl md:text-5xl font-extrabold tracking-tight leading-tight drop-shadow">
              {activeBanner?.title ?? "Petites annonces gratuites entre particuliers en France"}
            </h1>
            {activeBanner?.subtitle && (
              <p className="text-white/90 text-base md:text-lg mt-3 leading-relaxed drop-shadow">{activeBanner.subtitle}</p>
            )}
            {!activeBanner && (
              <p className="text-white/90 text-base md:text-lg mt-3 leading-relaxed drop-shadow max-w-xl">
                Publiez gratuitement votre annonce en 2 minutes. Sans commission, sans engagement, contact direct avec les acheteurs.
              </p>
            )}
            <div className="mt-5 flex flex-col sm:flex-row gap-3">
              <Link
                href="/login?callbackUrl=/post"
                className="inline-flex items-center justify-center gap-2 px-7 py-3 bg-white text-primary rounded-full font-bold shadow-lg active:scale-95 transition-transform"
              >
                <span className="material-symbols-outlined text-lg">add_circle</span>
                Publier mon annonce
              </Link>
              <Link
                href="/nouveautes"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-white/10 border border-white/30 text-white rounded-full font-semibold hover:bg-white/15 transition-colors backdrop-blur-sm"
              >
                Parcourir les annonces
              </Link>
            </div>
          </div>
          {!activeBanner?.bgImage && (
            <div className="absolute top-0 right-0 w-1/2 h-full opacity-20 pointer-events-none bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-tertiary-fixed to-transparent" />
          )}
        </div>
      </header>

      {/* Categories: Bento Style */}
      <section className="px-6 py-4 max-w-7xl mx-auto">
        <div className="flex items-end justify-between mb-8">
          <div>
            <span className="text-primary font-bold uppercase tracking-[0.1em] text-[11px]">Explorer par</span>
            <h2 className="text-2xl font-bold text-on-surface">Catégories populaires</h2>
          </div>
          <Link href="/nouveautes" title="Voir toutes les catégories" className="text-primary font-semibold flex items-center gap-1 group">
            Toutes les catégories <span className="material-symbols-outlined text-sm group-hover:translate-x-1 transition-transform">arrow_forward</span>
          </Link>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            { id: "vehicules", label: "Véhicules", src: "https://lh3.googleusercontent.com/aida-public/AB6AXuBGMEyVAsY5RW4Yei9LtUSa92B7hQ2kPt8EdekXCUM9h3j7ZcDyUJHYxwJ0mb-4-QamClSjIg8RnjpAANyCePb3fhrOjVA2L0t5k7Rl3D1zh6oYexSNqqbyLW3pygORjeicNryZ6it1mEzuPhOT9zAeXaCTu5mBWuZdsI4wF9V7YBu95kW25E51BN9CKmlsBigwQeS7x3AW_HBzZZDo3E9aFdI4Xl__Vd5xAMJ4H80ljzvlZ4am1kTbfj1f9v50sst7_ApbhRtCnY2_" },
            { id: "immobilier", label: "Immobilier", src: "https://lh3.googleusercontent.com/aida-public/AB6AXuAt-0kv_wITShSbU9nfI_E9TtW5TdTuw5hn_DluMsuR3tQbQXBkRXA_3FBmkrVgkDc8gTKQ1a89eMsiiBKwJxpvOKkhcmV_H7p9ZpIMBiBgqmp93hWzAhg7HuozYI-hBs3Ycm7STGtp47eGoFUKE07MF0yIyk5imrhRUSZCamG0oTX8XMTGnyOmk-FzCXAyd7HtUr0xNdYhIzFbIW1IXlxk3hmdApYxJterZ5B0mTXD2XP_tLbDOOCjpOdUcAh0wwGojhYLc87qf7gA" },
            { id: "mode", label: "Mode", src: "https://lh3.googleusercontent.com/aida-public/AB6AXuAh42sdJERo4cvL_P118M-1bQmxaifGrDge0kVugUyS1msBPe9uUPNjGiudAk-iSrL6diy7aBN4uFtaj6ea6MQFDkIo-hWfZwPERRBiCuufUuwTxxepEdU0QBfPd6-bNEoZRYOQQ2ODh0y_oonMoVOSHBjU0lK919C1te5WXVUGifu1THI8gsk3RzG3uWmsPndQWKiGiiqcQiCvef7rsybA6lB5Eapf7xHk136aU_wkfWgUQmF1zmjeUC6CSIyCqdFTy7g0efbSr6tX" },
            { id: "maison", label: "Maison", src: "https://lh3.googleusercontent.com/aida-public/AB6AXuDehjPQkD8W1LqpDimsNIHT7WdfP5bacI12ZLl_bUlBKVRylknSR6MIo5dG_EqzV7od-W1K_MFzzzS3UbNrS6-9F4imbBf8nRLoI2fz7MG7p9Z78krgNFQPX_QVTHFOlPxpYN68i7ymEOIb-__QT9EQLIjWeDEfH4GQWrk06l14FW2VkRGJsknjV1WU0tlIKwPiyZdVXlUalsjoeJ534KwCfcBq5W_mmR6IQY4BCofwKeBxYGvsI3FZY8FgEyydmevYRNC-9aQhAuJ3" },
            { id: "services", label: "Services", src: "https://lh3.googleusercontent.com/aida-public/AB6AXuAYdVk-G5r5SmBtZ1pOtrpJm3G6Hsse-MXy8DtbqFnGoYHOp-7w6mUzsyHxu8i49twEP5pjql6vTgWL4q6ZOsDtYogK8itEB2nIPvTaeDfD7V3vlTcYH9ClSubLCcQ4qnTNHt2aXlAzy_-I-UKEB_2tPB3EazYvwK3LqeH4V-CkYszESDT9lzZJs68F0ue6ZZZ7FrvmZt1vXxzsjnSjmUYH6IFR-0hRJExugJz4chy6oP6zlh1lsO0ks_T0wpW996uJWqkyn9-n5KyR" },
          ].map(({ id, label, src }) => (
            <Link key={id} href={`/annonces/${id}`} title={`Annonces ${label}`} className="group relative aspect-square md:aspect-auto md:h-64 rounded-xl overflow-hidden bg-surface-container-low flex flex-col justify-end p-4">
              <Image
                src={src}
                alt={label}
                fill
                sizes="(max-width:768px) 50vw, 33vw"
                className="object-cover group-hover:scale-110 transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
              <div className="relative z-10">
                <p className="text-white font-bold text-lg">{label}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Ad Carousel */}
      {ads.length > 0 && <AdCarousel ads={ads} />}

      {/* Recommendations based on search history (client-side, only shows if history exists) */}
      <HomeRecommendations />

      {/* Recent Listings Section */}
      <section className="py-10 max-w-7xl mx-auto bg-surface-container-low rounded-t-[3rem]">
        <div className="flex items-center justify-between mb-5 px-6">
          <h2 className="text-xl font-extrabold text-on-surface tracking-tight">Annonces récentes</h2>
          <Link href="/nouveautes" title="Voir toutes les annonces récentes" className="text-primary text-sm font-semibold flex items-center gap-1 group">
            Voir tout <span className="material-symbols-outlined text-base group-hover:translate-x-0.5 transition-transform">arrow_forward</span>
          </Link>
        </div>
        {/* Horizontal scroll on mobile, grid on desktop */}
        <div className="flex gap-3 overflow-x-auto pb-3 px-6 no-scrollbar md:grid md:grid-cols-4 lg:grid-cols-5 md:gap-4 md:overflow-visible md:pb-0">
          {listings.map((listing, i) => {
            const images = JSON.parse(listing.images) as string[];
            const img = images[0] || undefined;
            const ad = i === 1 ? ads[0] : i === 5 ? ads[1] : null;
            return (
              <Fragment key={listing.id}>
                {ad && (
                  <a
                    key={`ad-${ad.id}`}
                    href={ad.destinationUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={ad.title}
                    className="flex-shrink-0 w-44 md:w-auto group flex flex-col bg-white rounded-xl overflow-hidden border border-[#c7c5d4] hover:shadow-md transition-all duration-200"
                  >
                    <div className="relative aspect-square overflow-hidden bg-surface-container-low">
                      <Image
                        src={ad.imageUrl}
                        alt={ad.title}
                        fill
                        sizes="(max-width:640px) 50vw,(max-width:1024px) 33vw,20vw"
                        className="object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <span className="absolute top-2 left-2 bg-[#2f6fb8] text-white text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">
                        Publicité
                      </span>
                    </div>
                    <div className="p-2.5 flex flex-col gap-0.5">
                      <p className="text-on-surface font-semibold text-sm leading-snug line-clamp-2">{ad.title}</p>
                      <p className="text-outline text-xs line-clamp-2">{ad.description}</p>
                    </div>
                  </a>
                )}
                <Link
                  href={listingUrl(listing.id, listing.title)}
                  title={`${listing.title} — ${listing.price.toLocaleString("fr-FR")} €`}
                  className="flex-shrink-0 w-44 md:w-auto group flex flex-col bg-white rounded-xl overflow-hidden border border-surface-container hover:shadow-md transition-all duration-200"
                >
                  <div className="relative aspect-square overflow-hidden bg-surface-container-low">
                    {img ? (
                      <Image
                        src={img}
                        alt={`${listing.title}${listing.location ? ` à ${listing.location.split(/[,(]/)[0]?.trim()}` : ""} — ${listing.price.toLocaleString("fr-FR")} €`}
                        fill
                        // Première carte = LCP probable → priority pour pré-charger.
                        priority={i === 0}
                        sizes="(max-width:640px) 50vw,(max-width:1024px) 33vw,20vw"
                        className="object-cover group-hover:scale-105 transition-transform duration-300"
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
                    <DejaVuBadge listingId={listing.id} />
                  </div>
                  <div className="p-2.5 flex flex-col gap-0.5">
                    <p className="text-on-surface font-semibold text-sm leading-snug line-clamp-2">{listing.title}</p>
                    <p className="text-primary font-bold text-base mt-1">{listing.price.toLocaleString("fr-FR")} €</p>
                    <p className="text-outline text-xs truncate">{listing.location}</p>
                    <p className="text-outline/70 text-[10px]">{formatDistanceToNow(listing.createdAt)}</p>
                  </div>
                </Link>
              </Fragment>
            );
          })}
        </div>
        <div className="mt-8 flex justify-center px-6">
          <Link href="/search" title="Lancer une recherche" className="px-8 py-3 bg-primary text-white rounded-full font-bold text-sm shadow-lg shadow-primary/20 active:scale-95 transition-transform">
            Voir plus d'annonces
          </Link>
        </div>
      </section>

      {/* Bloc SEO textuel */}
      <section className="px-6 py-10 max-w-7xl mx-auto">
        <div className="bg-white border border-[#eceef0] rounded-2xl p-6 md:p-8">
          <h2 className="text-lg font-bold text-[#191c1e] mb-3">Achetez et vendez entre particuliers sur Deal&amp;Co</h2>
          <p className="text-sm text-[#777683] leading-relaxed mb-4">
            Deal&amp;Co est la plateforme de petites annonces gratuites entre particuliers en France. Publiez vos annonces de
            voitures d&apos;occasion, de biens immobiliers, de vêtements, d&apos;électronique, de mobilier et bien plus encore.
            Achetez et vendez facilement près de chez vous, sans commission.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
            {[
              { label: "Voitures d'occasion", href: "/annonces/vehicules" },
              { label: "Immobilier", href: "/annonces/immobilier" },
              { label: "Mode & vêtements", href: "/annonces/mode" },
              { label: "Électronique", href: "/annonces/multimedia" },
              { label: "Mobilier & maison", href: "/annonces/maison" },
              { label: "Animaux", href: "/annonces/animaux" },
              { label: "Loisirs & sport", href: "/annonces/loisirs" },
              { label: "Services", href: "/annonces/services" },
              { label: "Matériel professionnel", href: "/annonces/materiel-pro" },
              { label: "Bébé & Enfant", href: "/annonces/bebe-enfant" },
              { label: "Vacances", href: "/annonces/vacances" },
              { label: "Emploi", href: "/annonces/emploi" },
            ].map(({ label, href }) => (
              <Link
                key={href}
                href={href}
                className="text-xs font-semibold text-[#2f6fb8] hover:underline truncate"
              >
                {label}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ — extraction friendly pour moteurs et IA */}
      <section className="px-6 py-10 max-w-7xl mx-auto">
        <div className="bg-white border border-[#eceef0] rounded-2xl p-6 md:p-8">
          <h2 className="text-xl font-bold text-[#191c1e] mb-5">Questions fréquentes sur Deal&amp;Co</h2>
          <div className="space-y-3">
            {HOME_FAQ.map((item, i) => (
              <details key={i} className="border-b border-slate-100 pb-3 last:border-0 last:pb-0 group">
                <summary className="cursor-pointer font-semibold text-on-surface flex justify-between items-center list-none">
                  {item.q}
                  <span className="material-symbols-outlined text-outline text-base group-open:rotate-180 transition-transform">expand_more</span>
                </summary>
                <p className="mt-2 text-sm text-on-surface-variant leading-relaxed">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Blog teaser */}
      <section className="px-6 pb-10 max-w-7xl mx-auto">
        <div className="bg-white border border-[#eceef0] rounded-2xl p-6 md:p-8">
          <div className="flex items-end justify-between mb-4 flex-wrap gap-3">
            <div>
              <span className="text-primary font-bold uppercase tracking-[0.1em] text-[11px]">À lire</span>
              <h2 className="text-lg font-bold text-[#191c1e]">Guides pratiques sur le blog</h2>
            </div>
            <Link href="/blog" title="Voir tous les articles du blog" className="text-primary text-sm font-semibold flex items-center gap-1 group">
              Tous les articles
              <span className="material-symbols-outlined text-base group-hover:translate-x-0.5 transition-transform">arrow_forward</span>
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[
              { slug: "vendre-voiture-occasion-entre-particuliers", title: "Vendre sa voiture d'occasion entre particuliers" },
              { slug: "eviter-arnaques-petites-annonces", title: "Éviter les arnaques sur les petites annonces" },
              { slug: "estimer-loyer-appartement-location", title: "Estimer le loyer d'un appartement avant location" },
            ].map((post) => (
              <Link
                key={post.slug}
                href={`/blog/${post.slug}`}
                title={post.title}
                className="text-sm font-semibold text-[#2f6fb8] hover:underline"
              >
                {post.title}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <SiteFooter />

      <BottomNav active="accueil" />

    </div>
  );
}
