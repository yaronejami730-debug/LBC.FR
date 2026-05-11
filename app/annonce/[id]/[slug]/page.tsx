import { cache, Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { getActiveAds } from "@/lib/ads";
import { auth } from "@/lib/auth";
import { formatDistanceToNow } from "@/lib/utils";
import ListingHeader from "../ListingHeader";
import AdRotator from "../AdRotator";
import { getUserResponseTime } from "@/lib/user-stats";
import SellerActions from "../SellerActions";
import ReportButton from "../ReportButton";
import OwnerActions from "../OwnerActions";
import PhotoGallery from "../PhotoGallery";
import HistoryTracker from "@/components/HistoryTracker";
import ProBadge from "@/components/ProBadge";
import ListingInfoTip from "../ListingInfoTip";
import MarkViewed from "@/components/MarkViewed";
import ExpiryTimer from "../ExpiryTimer";
import ViewTracker from "@/components/ViewTracker";
import LiveViewCount from "../LiveViewCount";
import { getBrandLogo } from "@/lib/carBrands";
import BrandBadge from "../BrandBadge";
import { CATEGORIES } from "@/lib/categories";
import { listingSlug, listingUrl } from "@/lib/listing-slug";

const BASE = "https://www.dealandcompany.fr";

const getListing = cache((id: string) =>
  prisma.listing.findUnique({
    where: { id },
    include: { user: true },
  }).catch(() => null)
);

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string; slug: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const listing = await getListing(id);

  if (!listing) return {};

  const ld = listing as any;
  if (ld.shadowBanned) {
    return { robots: { index: false, follow: false } };
  }
  // Thin/low-quality/reported listings → noindex but still followable so
  // Google can discover internal links from the page.
  if (
    (ld.qualityScore != null && ld.qualityScore < 40) ||
    (ld.reportCount != null && ld.reportCount >= 3) ||
    !ld.description ||
    ld.description.length < 80
  ) {
    return { robots: { index: false, follow: true } };
  }

  const priceStr = listing.price.toLocaleString("fr-FR") + " €";
  const pageUrl = `${BASE}/annonce/${id}/${listingSlug(listing.title)}`;
  const cityShort = listing.location?.split(/[,(]/)[0]?.trim() ?? listing.location ?? "";

  const titleSeo = cityShort
    ? `${listing.title} à ${cityShort} — ${priceStr}`
    : `${listing.title} — ${priceStr}`;

  const descBase = `${listing.description.slice(0, 155)}${listing.description.length > 155 ? "…" : ""}`;
  const desc = `${descBase} · ${listing.location} · ${priceStr}`;

  return {
    title: titleSeo,
    description: desc,
    alternates: { canonical: pageUrl },
    other: {
      "product:price:amount": String(listing.price),
      "product:price:currency": "EUR",
      "product:availability": "in stock",
      "product:condition": listing.condition === "Neuf" ? "new" : "used",
    },
    openGraph: {
      title: titleSeo,
      description: desc,
      url: pageUrl,
      siteName: "Deal&Co",
      type: "website",
      images: [{ url: `${BASE}/annonce/${id}/opengraph-image`, width: 1200, height: 630, alt: listing.title }],
    },
    twitter: {
      card: "summary_large_image",
      title: titleSeo,
      description: desc,
      images: [`${BASE}/annonce/${id}/opengraph-image`],
    },
  };
}

export default async function ListingPage({
  params,
}: {
  params: Promise<{ id: string; slug: string }>;
}) {
  const { id, slug } = await params;
  const [listing, session] = await Promise.all([
    getListing(id),
    auth(),
  ]);

  const ads = await getActiveAds().catch(() => []);

  const currentUserId = session?.user?.id ?? null;

  if (!listing) notFound();

  const isOwner = currentUserId === listing.userId;
  const role = (session?.user as unknown as Record<string, unknown> | undefined)?.role;
  const isAdmin = role === "ADMIN";

  const listingData = listing as any;
  if (listingData.deletedAt && !isAdmin) {
    notFound();
  }

  if (listing.status !== "APPROVED" && !isOwner && !isAdmin) {
    notFound();
  }

  // Canonical slug correction — redirect if slug in URL doesn't match title
  const correctSlug = listingSlug(listing.title);
  if (slug !== correctSlug) {
    redirect(`/annonce/${id}/${correctSlug}`);
  }

  const isFavorite = currentUserId
    ? !!(await prisma.favorite.findUnique({
        where: { userId_listingId: { userId: currentUserId, listingId: id } },
      }))
    : false;

  const responseTime = await getUserResponseTime(listing.userId);

  type VehicleMeta = {
    marque?: string; modele?: string; annee?: string; kilometrage?: string;
    carburant?: string; transmission?: string; couleur?: string;
    immatriculation?: string; puissanceFiscale?: string; nombrePortes?: string;
    motorisation?: string; nombreVitesses?: string; nombrePlaces?: string;
    typeVehicule?: string; emissionCO2?: string;
    consoUrbaine?: string; consoExtraU?: string; consoMixte?: string;
    critAir?: string; dateImmatriculation?: string;
    options?: string[];
  };
  let vehicleMeta: VehicleMeta = {};
  if (listing.category === "Véhicules" && listing.metadata && listing.metadata !== "{}") {
    try {
      vehicleMeta = JSON.parse(listing.metadata) as VehicleMeta;
    } catch {
      // ignore malformed JSON
    }
  }

  let immoMeta: Record<string, string | boolean> = {};
  if (listing.category === "Immobilier" && listing.metadata && listing.metadata !== "{}") {
    try {
      immoMeta = JSON.parse(listing.metadata);
    } catch {
      // ignore malformed JSON
    }
  }

  const images = JSON.parse(listing.images) as string[];
  const mainImg = images[0] || "https://lh3.googleusercontent.com/aida-public/AB6AXuAwwxQgv4rI6XClzhTLjkwXug8TYby1cyK7AgQhc4UpMdyrjwq4jRPQo_ZvL_7xvjhVSon_iJvztv0bdEqqiFX0CHRW9IDYjccZpyP4v8zoDq0pcj4RtADoGgiXgRyW1_sPXiKqwZz8D1UwMIYilwBQMOTHJ4RMQl9Rp4vFbK6a0UCsy93TZ3-DYA8qYhHPO4LhM2csSFfFLlOh2P8D7w00bjyGrSMRlGSvhxZrGjVcqJUJ2-2y9XbKHb7ww02PREvAIJO3_wJ41hV5";

  const pageUrl = `${BASE}/annonce/${listing.id}/${correctSlug}`;
  const cat = CATEGORIES.find((c) => c.label === listing.category);

  const cityShort = listing.location?.split(/[,(]/)[0]?.trim() ?? listing.location ?? "";

  const baseOffer = {
    "@type": "Offer",
    url: pageUrl,
    price: listing.price,
    priceCurrency: "EUR",
    availability: "https://schema.org/InStock",
    itemCondition: listing.condition === "Neuf"
      ? "https://schema.org/NewCondition"
      : "https://schema.org/UsedCondition",
    priceValidUntil: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    areaServed: { "@type": "Country", name: "France" },
    ...(cityShort
      ? {
          availableAtOrFrom: {
            "@type": "Place",
            address: { "@type": "PostalAddress", addressLocality: cityShort, addressCountry: "FR" },
          },
        }
      : {}),
    seller: {
      "@type": (listing.user as any).isPro ? "Organization" : "Person",
      name: (listing.user as any).isPro && (listing.user as any).companyName
        ? (listing.user as any).companyName
        : listing.user.name ?? "Particulier",
      url: `${BASE}/u/${listing.userId}`,
    },
  };

  const isVehicle = listing.category === "Véhicules";
  const isImmo = listing.category === "Immobilier";

  const immoType = String(immoMeta.typeBien ?? "").toLowerCase();
  const immoSchemaType =
    immoType.includes("maison") || immoType.includes("villa") ? "House"
    : immoType.includes("appartement") || immoType.includes("studio") || immoType.includes("loft") ? "Apartment"
    : "Accommodation";

  const jsonLd = isVehicle
    ? {
        "@context": "https://schema.org",
        "@type": "Car",
        name: listing.title,
        description: listing.description,
        image: images.length ? images : [mainImg],
        url: pageUrl,
        datePublished: listing.createdAt.toISOString(),
        dateModified: listing.updatedAt.toISOString(),
        offers: baseOffer,
        ...(vehicleMeta.marque ? { brand: { "@type": "Brand", name: vehicleMeta.marque } } : {}),
        ...(vehicleMeta.modele ? { model: vehicleMeta.modele } : {}),
        ...(vehicleMeta.annee ? { vehicleModelDate: vehicleMeta.annee } : {}),
        ...(vehicleMeta.kilometrage ? {
          mileageFromOdometer: {
            "@type": "QuantitativeValue",
            value: parseInt(String(vehicleMeta.kilometrage).replace(/\D/g, ""), 10) || undefined,
            unitCode: "KMT",
          },
        } : {}),
        ...(vehicleMeta.carburant ? { fuelType: vehicleMeta.carburant } : {}),
        ...(vehicleMeta.transmission ? { vehicleTransmission: vehicleMeta.transmission } : {}),
        ...(vehicleMeta.couleur ? { color: vehicleMeta.couleur } : {}),
        ...(vehicleMeta.nombrePortes ? { numberOfDoors: parseInt(String(vehicleMeta.nombrePortes), 10) || undefined } : {}),
        ...(vehicleMeta.nombrePlaces ? { vehicleSeatingCapacity: parseInt(String(vehicleMeta.nombrePlaces), 10) || undefined } : {}),
        ...(vehicleMeta.typeVehicule ? { bodyType: vehicleMeta.typeVehicule } : {}),
        ...(vehicleMeta.motorisation ? { vehicleEngine: { "@type": "EngineSpecification", name: vehicleMeta.motorisation } } : {}),
        ...(vehicleMeta.emissionCO2 ? { meetsEmissionStandard: vehicleMeta.emissionCO2 } : {}),
      }
    : isImmo
    ? {
        "@context": "https://schema.org",
        "@type": immoSchemaType,
        name: listing.title,
        description: listing.description,
        image: images.length ? images : [mainImg],
        url: pageUrl,
        datePublished: listing.createdAt.toISOString(),
        dateModified: listing.updatedAt.toISOString(),
        address: {
          "@type": "PostalAddress",
          addressLocality: listing.location,
          addressCountry: "FR",
        },
        offers: baseOffer,
        ...(immoMeta.surface ? {
          floorSize: { "@type": "QuantitativeValue", value: parseFloat(String(immoMeta.surface)), unitCode: "MTK" },
        } : {}),
        ...(immoMeta.rooms ? { numberOfRooms: parseInt(String(immoMeta.rooms), 10) } : {}),
        ...(immoMeta.chambres ? { numberOfBedrooms: parseInt(String(immoMeta.chambres), 10) } : {}),
        ...(immoMeta.classeEnergie ? {
          amenityFeature: [{ "@type": "LocationFeatureSpecification", name: "Classe énergie", value: String(immoMeta.classeEnergie) }],
        } : {}),
      }
    : {
        "@context": "https://schema.org",
        "@type": "Product",
        name: listing.title,
        description: listing.description,
        image: images.length ? images : [mainImg],
        url: pageUrl,
        datePublished: listing.createdAt.toISOString(),
        dateModified: listing.updatedAt.toISOString(),
        offers: baseOffer,
        ...(listing.subcategory ? { category: listing.subcategory } : (cat ? { category: cat.label } : {})),
        ...(listing.brand ? { brand: { "@type": "Brand", name: listing.brand } } : {}),
      };

  const cityShortForCrumb = cityShort;
  const cityCrumbSlug = cityShortForCrumb
    ? cityShortForCrumb
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
    : "";

  const breadcrumbItems: Array<Record<string, unknown>> = [
    { "@type": "ListItem", position: 1, name: "Accueil", item: BASE },
  ];
  let pos = 2;
  if (cat) {
    breadcrumbItems.push({ "@type": "ListItem", position: pos++, name: cat.label, item: `${BASE}/annonces/${cat.id}` });
  }
  if (cat && cityCrumbSlug) {
    breadcrumbItems.push({
      "@type": "ListItem",
      position: pos++,
      name: cityShortForCrumb,
      item: `${BASE}/annonces/${cat.id}/${cityCrumbSlug}`,
    });
  }
  breadcrumbItems.push({ "@type": "ListItem", position: pos, name: listing.title, item: pageUrl });

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: breadcrumbItems,
  };

  return (
    <div className="bg-surface text-on-surface mb-24 md:mb-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
      <ListingHeader
        title={listing.title}
        listingId={listing.id}
        userId={currentUserId}
        initialFavorite={isFavorite}
        images={images}
      />

      <main className="pt-32 max-w-7xl mx-auto pb-12">
        <HistoryTracker category={listing.category} />
        <MarkViewed listingId={listing.id} />
        {!isOwner && <ViewTracker listingId={listing.id} />}

        {/* Breadcrumb visible — SEO + UX */}
        <nav
          aria-label="Fil d'Ariane"
          className="px-4 md:px-6 mt-2 text-xs text-outline flex flex-wrap items-center gap-1.5"
        >
          <Link href="/" className="hover:text-primary transition-colors">Accueil</Link>
          {cat && (
            <>
              <span className="text-slate-300">›</span>
              <Link
                href={`/annonces/${cat.id}`}
                className="hover:text-primary transition-colors"
              >
                {cat.label}
              </Link>
            </>
          )}
          {cat && cityCrumbSlug && (
            <>
              <span className="text-slate-300">›</span>
              <Link
                href={`/annonces/${cat.id}/${cityCrumbSlug}`}
                className="hover:text-primary transition-colors"
              >
                {cityShortForCrumb}
              </Link>
            </>
          )}
          <span className="text-slate-300">›</span>
          <span className="text-on-surface font-medium truncate max-w-[40ch]">
            {listing.title}
          </span>
        </nav>

        <section className="px-4 md:px-6 mt-2">
          <PhotoGallery images={images} title={listing.title} />
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 px-4 md:px-6 py-8">
          <div className="lg:col-span-8 space-y-8">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                {listing.isPremium && (
                  <span className="px-2 py-0.5 bg-secondary-container text-on-secondary-container text-[10px] font-bold uppercase tracking-wider rounded">Annonce Premium</span>
                )}
                <span className="text-outline text-xs font-medium tracking-wide flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm">schedule</span> {formatDistanceToNow(listing.createdAt)}
                </span>
              </div>

              {listing.category === "Véhicules" && vehicleMeta.marque && (() => {
                const logo = getBrandLogo(vehicleMeta.marque as string);
                return logo ? (
                  <BrandBadge name={vehicleMeta.marque as string} logo={logo} />
                ) : (
                  <span className="text-sm font-bold text-slate-400 uppercase tracking-widest">{vehicleMeta.marque as string}</span>
                );
              })()}

              <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-on-surface leading-tight">
                {listing.title}
              </h1>
              <div className="flex items-center gap-3 pt-2">
                <span className="text-4xl font-black text-primary">{listing.price.toLocaleString("fr-FR")} €</span>
                {isOwner && Date.now() - new Date(listing.createdAt).getTime() < 48 * 60 * 60 * 1000 && (
                  <ListingInfoTip />
                )}
              </div>
              {isOwner && (
                <ExpiryTimer listingId={listing.id} createdAt={listing.createdAt.toISOString()} />
              )}
              {isOwner && (
                <div className="flex items-center gap-3 mt-2 flex-wrap">
                  <LiveViewCount
                    listingId={listing.id}
                    initialCount={(listing as any).viewCount ?? 0}
                  />
                </div>
              )}
              {isOwner && (
                <p className="text-[10px] text-slate-300 mt-1 select-all" title="Communiquez cette référence au service client en cas de problème">
                  Réf. {listing.id}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-6 border-y border-outline-variant/15">
              <div className="flex flex-col gap-1">
                <span className="text-outline text-[11px] font-semibold uppercase tracking-widest">État</span>
                <span className="text-on-surface font-semibold">{listing.condition}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-outline text-[11px] font-semibold uppercase tracking-widest">Catégorie</span>
                <span className="text-on-surface font-semibold">{listing.category}</span>
              </div>
              {listing.brand && (
                <div className="flex flex-col gap-1">
                  <span className="text-outline text-[11px] font-semibold uppercase tracking-widest">Marque</span>
                  <span className="text-on-surface font-semibold">{listing.brand}</span>
                </div>
              )}
              {listing.material && (
                <div className="flex flex-col gap-1">
                  <span className="text-outline text-[11px] font-semibold uppercase tracking-widest">Matière</span>
                  <span className="text-on-surface font-semibold">{listing.material}</span>
                </div>
              )}
              {vehicleMeta.marque && (
                <div className="flex flex-col gap-1">
                  <span className="text-outline text-[11px] font-semibold uppercase tracking-widest">Marque</span>
                  <span className="text-on-surface font-semibold">{vehicleMeta.marque}</span>
                </div>
              )}
              {vehicleMeta.modele && (
                <div className="flex flex-col gap-1">
                  <span className="text-outline text-[11px] font-semibold uppercase tracking-widest">Modèle</span>
                  <span className="text-on-surface font-semibold">{vehicleMeta.modele}</span>
                </div>
              )}
              {vehicleMeta.annee && (
                <div className="flex flex-col gap-1">
                  <span className="text-outline text-[11px] font-semibold uppercase tracking-widest">Année</span>
                  <span className="text-on-surface font-semibold">{vehicleMeta.annee}</span>
                </div>
              )}
              {vehicleMeta.kilometrage && (
                <div className="flex flex-col gap-1">
                  <span className="text-outline text-[11px] font-semibold uppercase tracking-widest">Kilométrage</span>
                  <span className="text-on-surface font-semibold">{Number(vehicleMeta.kilometrage).toLocaleString("fr-FR")} km</span>
                </div>
              )}
              {vehicleMeta.carburant && (
                <div className="flex flex-col gap-1">
                  <span className="text-outline text-[11px] font-semibold uppercase tracking-widest">Carburant</span>
                  <span className="text-on-surface font-semibold">{vehicleMeta.carburant}</span>
                </div>
              )}
              {vehicleMeta.transmission && (
                <div className="flex flex-col gap-1">
                  <span className="text-outline text-[11px] font-semibold uppercase tracking-widest">Boîte</span>
                  <span className="text-on-surface font-semibold">{vehicleMeta.transmission}</span>
                </div>
              )}
              {vehicleMeta.couleur && (
                <div className="flex flex-col gap-1">
                  <span className="text-outline text-[11px] font-semibold uppercase tracking-widest">Couleur</span>
                  <span className="text-on-surface font-semibold">{vehicleMeta.couleur}</span>
                </div>
              )}
              {vehicleMeta.nombrePortes && (
                <div className="flex flex-col gap-1">
                  <span className="text-outline text-[11px] font-semibold uppercase tracking-widest">Portes</span>
                  <span className="text-on-surface font-semibold">{vehicleMeta.nombrePortes}</span>
                </div>
              )}
              {vehicleMeta.puissanceFiscale && (
                <div className="flex flex-col gap-1">
                  <span className="text-outline text-[11px] font-semibold uppercase tracking-widest">Puissance</span>
                  <span className="text-on-surface font-semibold">{vehicleMeta.puissanceFiscale} CV</span>
                </div>
              )}
              {vehicleMeta.immatriculation && (
                <div className="flex flex-col gap-1">
                  <span className="text-outline text-[11px] font-semibold uppercase tracking-widest">Immatriculation</span>
                  <span className="text-on-surface font-semibold font-mono">{vehicleMeta.immatriculation}</span>
                </div>
              )}
              {vehicleMeta.motorisation && (
                <div className="flex flex-col gap-1">
                  <span className="text-outline text-[11px] font-semibold uppercase tracking-widest">Motorisation</span>
                  <span className="text-on-surface font-semibold">{vehicleMeta.motorisation}</span>
                </div>
              )}
              {vehicleMeta.typeVehicule && (
                <div className="flex flex-col gap-1">
                  <span className="text-outline text-[11px] font-semibold uppercase tracking-widest">Type</span>
                  <span className="text-on-surface font-semibold">{vehicleMeta.typeVehicule}</span>
                </div>
              )}
              {vehicleMeta.nombreVitesses && (
                <div className="flex flex-col gap-1">
                  <span className="text-outline text-[11px] font-semibold uppercase tracking-widest">Vitesses</span>
                  <span className="text-on-surface font-semibold">{vehicleMeta.nombreVitesses}</span>
                </div>
              )}
              {vehicleMeta.nombrePlaces && (
                <div className="flex flex-col gap-1">
                  <span className="text-outline text-[11px] font-semibold uppercase tracking-widest">Places</span>
                  <span className="text-on-surface font-semibold">{vehicleMeta.nombrePlaces}</span>
                </div>
              )}
              {vehicleMeta.dateImmatriculation && (
                <div className="flex flex-col gap-1">
                  <span className="text-outline text-[11px] font-semibold uppercase tracking-widest">Date immat.</span>
                  <span className="text-on-surface font-semibold">{vehicleMeta.dateImmatriculation}</span>
                </div>
              )}
              {vehicleMeta.critAir && (
                <div className="flex flex-col gap-1">
                  <span className="text-outline text-[11px] font-semibold uppercase tracking-widest">Crit&apos;Air</span>
                  <span className="text-on-surface font-semibold">{vehicleMeta.critAir === "0" ? "0 (Électrique)" : `Crit'Air ${vehicleMeta.critAir}`}</span>
                </div>
              )}
              {vehicleMeta.emissionCO2 && (
                <div className="flex flex-col gap-1">
                  <span className="text-outline text-[11px] font-semibold uppercase tracking-widest">CO₂</span>
                  <span className="text-on-surface font-semibold">{vehicleMeta.emissionCO2} g/km</span>
                </div>
              )}
              {immoMeta.typeBien && (
                <div className="flex flex-col gap-1">
                  <span className="text-outline text-[11px] font-semibold uppercase tracking-widest">Type de bien</span>
                  <span className="text-on-surface font-semibold">{String(immoMeta.typeBien)}</span>
                </div>
              )}
              {immoMeta.surface && (
                <div className="flex flex-col gap-1">
                  <span className="text-outline text-[11px] font-semibold uppercase tracking-widest">Surface</span>
                  <span className="text-on-surface font-semibold">{String(immoMeta.surface)} m²</span>
                </div>
              )}
              {immoMeta.rooms && (
                <div className="flex flex-col gap-1">
                  <span className="text-outline text-[11px] font-semibold uppercase tracking-widest">Pièces</span>
                  <span className="text-on-surface font-semibold">{String(immoMeta.rooms)} pièce{String(immoMeta.rooms) !== "1" ? "s" : ""}</span>
                </div>
              )}
              {immoMeta.chambres && (
                <div className="flex flex-col gap-1">
                  <span className="text-outline text-[11px] font-semibold uppercase tracking-widest">Chambres</span>
                  <span className="text-on-surface font-semibold">{String(immoMeta.chambres)} ch.</span>
                </div>
              )}
              {immoMeta.sallesEau && (
                <div className="flex flex-col gap-1">
                  <span className="text-outline text-[11px] font-semibold uppercase tracking-widest">Salles d&apos;eau</span>
                  <span className="text-on-surface font-semibold">{String(immoMeta.sallesEau)}</span>
                </div>
              )}
              {immoMeta.typeCharuffe && (
                <div className="flex flex-col gap-1">
                  <span className="text-outline text-[11px] font-semibold uppercase tracking-widest">Type de chauffage</span>
                  <span className="text-on-surface font-semibold">{String(immoMeta.typeCharuffe)}</span>
                </div>
              )}
              {immoMeta.modeCharuffe && (
                <div className="flex flex-col gap-1">
                  <span className="text-outline text-[11px] font-semibold uppercase tracking-widest">Mode de chauffage</span>
                  <span className="text-on-surface font-semibold">{String(immoMeta.modeCharuffe)}</span>
                </div>
              )}
              {immoMeta.etage && (
                <div className="flex flex-col gap-1">
                  <span className="text-outline text-[11px] font-semibold uppercase tracking-widest">Étage</span>
                  <span className="text-on-surface font-semibold">{String(immoMeta.etage)}</span>
                </div>
              )}
              {immoMeta.exposition && (
                <div className="flex flex-col gap-1">
                  <span className="text-outline text-[11px] font-semibold uppercase tracking-widest">Exposition</span>
                  <span className="text-on-surface font-semibold">{String(immoMeta.exposition)}</span>
                </div>
              )}
              {immoMeta.placesParking && String(immoMeta.placesParking) !== "0" && (
                <div className="flex flex-col gap-1">
                  <span className="text-outline text-[11px] font-semibold uppercase tracking-widest">Parking</span>
                  <span className="text-on-surface font-semibold">{String(immoMeta.placesParking)} place{String(immoMeta.placesParking) !== "1" ? "s" : ""}</span>
                </div>
              )}
              {immoMeta.anneeConstruction && (
                <div className="flex flex-col gap-1">
                  <span className="text-outline text-[11px] font-semibold uppercase tracking-widest">Année de construction</span>
                  <span className="text-on-surface font-semibold">{String(immoMeta.anneeConstruction)}</span>
                </div>
              )}
              {immoMeta.etatBien && (
                <div className="flex flex-col gap-1">
                  <span className="text-outline text-[11px] font-semibold uppercase tracking-widest">État du bien</span>
                  <span className="text-on-surface font-semibold">{String(immoMeta.etatBien)}</span>
                </div>
              )}
              {immoMeta.reference && (
                <div className="flex flex-col gap-1">
                  <span className="text-outline text-[11px] font-semibold uppercase tracking-widest">Référence</span>
                  <span className="text-on-surface font-semibold font-mono">{String(immoMeta.reference)}</span>
                </div>
              )}
              {immoMeta.vueMer === true && (
                <div className="flex flex-col gap-1">
                  <span className="text-outline text-[11px] font-semibold uppercase tracking-widest">Vue</span>
                  <span className="text-on-surface font-semibold flex items-center gap-1">
                    <span className="material-symbols-outlined text-[16px] text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>water</span>
                    Vue sur mer
                  </span>
                </div>
              )}
              {immoMeta.visAVis === false && (
                <div className="flex flex-col gap-1">
                  <span className="text-outline text-[11px] font-semibold uppercase tracking-widest">Environnement</span>
                  <span className="text-on-surface font-semibold flex items-center gap-1">
                    <span className="material-symbols-outlined text-[16px] text-emerald-600" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                    Pas de vis-à-vis
                  </span>
                </div>
              )}
            </div>

            {listing.category === "Véhicules" && (vehicleMeta.consoUrbaine || vehicleMeta.consoExtraU || vehicleMeta.consoMixte) && (
              <div className="bg-slate-50 rounded-2xl p-5 space-y-3">
                <h2 className="text-base font-bold tracking-tight flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px] text-primary">local_gas_station</span>
                  Consommations
                </h2>
                <div className="grid grid-cols-3 gap-3">
                  {vehicleMeta.consoUrbaine && (
                    <div className="flex flex-col gap-0.5 text-center">
                      <span className="text-outline text-[10px] font-semibold uppercase tracking-widest">Urbaine</span>
                      <span className="text-on-surface font-bold text-sm">{vehicleMeta.consoUrbaine} L/100</span>
                    </div>
                  )}
                  {vehicleMeta.consoExtraU && (
                    <div className="flex flex-col gap-0.5 text-center">
                      <span className="text-outline text-[10px] font-semibold uppercase tracking-widest">Extra-urb.</span>
                      <span className="text-on-surface font-bold text-sm">{vehicleMeta.consoExtraU} L/100</span>
                    </div>
                  )}
                  {vehicleMeta.consoMixte && (
                    <div className="flex flex-col gap-0.5 text-center">
                      <span className="text-outline text-[10px] font-semibold uppercase tracking-widest">Mixte</span>
                      <span className="text-on-surface font-bold text-sm">{vehicleMeta.consoMixte} L/100</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {listing.category === "Véhicules" && vehicleMeta.options && vehicleMeta.options.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-xl font-bold tracking-tight">Équipements &amp; options</h2>
                <div className="flex flex-wrap gap-2">
                  {vehicleMeta.options.map((opt) => (
                    <span key={opt} className="bg-primary/8 text-primary text-sm font-semibold px-3 py-1.5 rounded-full border border-primary/15">
                      {opt}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {listing.category === "Immobilier" && (immoMeta.prixHonorairesInclus || immoMeta.prixHonorairesExclus || immoMeta.honorairesAcquereur || immoMeta.taxeFonciere) && (
              <div className="bg-slate-50 rounded-2xl p-5 space-y-3">
                <h2 className="text-base font-bold tracking-tight flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px] text-primary">account_balance</span>
                  Honoraires &amp; taxes
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {immoMeta.prixHonorairesInclus && (
                    <div className="flex flex-col gap-0.5">
                      <span className="text-outline text-[10px] font-semibold uppercase tracking-widest">Prix honoraires TTC inclus</span>
                      <span className="text-on-surface font-bold text-sm">{Number(immoMeta.prixHonorairesInclus).toLocaleString("fr-FR")} €</span>
                    </div>
                  )}
                  {immoMeta.prixHonorairesExclus && (
                    <div className="flex flex-col gap-0.5">
                      <span className="text-outline text-[10px] font-semibold uppercase tracking-widest">Prix honoraires TTC exclus</span>
                      <span className="text-on-surface font-bold text-sm">{Number(immoMeta.prixHonorairesExclus).toLocaleString("fr-FR")} €</span>
                    </div>
                  )}
                  {immoMeta.honorairesAcquereur && (
                    <div className="flex flex-col gap-0.5">
                      <span className="text-outline text-[10px] font-semibold uppercase tracking-widest">Honoraires TTC à la charge acquéreur</span>
                      <span className="text-on-surface font-bold text-sm">{Number(immoMeta.honorairesAcquereur).toLocaleString("fr-FR")} €</span>
                    </div>
                  )}
                  {immoMeta.taxeFonciere && (
                    <div className="flex flex-col gap-0.5">
                      <span className="text-outline text-[10px] font-semibold uppercase tracking-widest">Taxe foncière annuelle</span>
                      <span className="text-on-surface font-bold text-sm">{Number(immoMeta.taxeFonciere).toLocaleString("fr-FR")} €</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {listing.category === "Immobilier" && (immoMeta.classeEnergie || immoMeta.ges || (Array.isArray(immoMeta.caracteristiques) && (immoMeta.caracteristiques as string[]).length > 0)) && (
              <div className="space-y-4">
                {(immoMeta.classeEnergie || immoMeta.ges) && (
                  <div>
                    <h2 className="text-xl font-bold tracking-tight mb-3">Diagnostics</h2>
                    <div className="bg-slate-50 p-5 rounded-2xl space-y-3">
                      {immoMeta.classeEnergie && (() => {
                        const dpeColors: Record<string, string> = { A: "#009966", B: "#33cc33", C: "#99cc00", D: "#ffcc00", E: "#ff9900", F: "#ff6600", G: "#ff0000" };
                        const letters = ["A","B","C","D","E","F","G"];
                        const active = String(immoMeta.classeEnergie);
                        return (
                          <div className="flex items-center gap-3">
                            <span className="text-sm text-slate-600 w-28 shrink-0">Classe énergie</span>
                            <div className="flex gap-1">
                              {letters.map((l) => (
                                <span key={l} className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black"
                                  style={{ background: l === active ? dpeColors[l] : "#e2e8f0", color: l === active ? "#fff" : "#94a3b8" }}>
                                  {l}
                                </span>
                              ))}
                            </div>
                          </div>
                        );
                      })()}
                      {immoMeta.ges && (() => {
                        const gesColors: Record<string, string> = { A: "#e8d5f5", B: "#d4aae8", C: "#c07fda", D: "#a855c9", E: "#8e2db7", F: "#7209a1", G: "#5c008a" };
                        const letters = ["A","B","C","D","E","F","G"];
                        const active = String(immoMeta.ges);
                        return (
                          <div className="flex items-center gap-3">
                            <span className="text-sm text-slate-600 w-28 shrink-0">GES</span>
                            <div className="flex gap-1">
                              {letters.map((l) => (
                                <span key={l} className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black"
                                  style={{ background: l === active ? gesColors[l] : "#e2e8f0", color: l === active ? (["A","B"].includes(l) ? "#7209a1" : "#fff") : "#94a3b8" }}>
                                  {l}
                                </span>
                              ))}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                )}
                {Array.isArray(immoMeta.caracteristiques) && (immoMeta.caracteristiques as string[]).length > 0 && (
                  <div>
                    <h2 className="text-xl font-bold tracking-tight mb-3">Équipements</h2>
                    <div className="flex flex-wrap gap-2">
                      {(immoMeta.caracteristiques as string[]).map((c) => (
                        <span key={c} className="bg-primary/8 text-primary text-sm font-semibold px-3 py-1.5 rounded-full border border-primary/15">
                          {c}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-4">
              <h2 className="text-xl font-bold tracking-tight">Description</h2>
              <div className="bg-slate-50 p-6 rounded-2xl">
                <p className="text-slate-600 leading-relaxed font-body whitespace-pre-wrap">
                  {listing.description}
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold tracking-tight">Localisation</h2>
                <div className="flex items-center gap-1.5 bg-primary/10 px-3 py-1 rounded-full">
                  <span className="material-symbols-outlined text-primary text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>location_on</span>
                  <span className="text-primary font-bold text-xs">{listing.location}</span>
                </div>
              </div>

              <div className="h-64 rounded-3xl bg-surface-container-high overflow-hidden relative border border-outline-variant/10 shadow-inner group">
                <iframe
                  width="100%"
                  height="100%"
                  style={{ border: 0 }}
                  loading="lazy"
                  allowFullScreen
                  referrerPolicy="no-referrer-when-downgrade"
                  src={`https://maps.google.com/maps?q=${encodeURIComponent(listing.location)}&t=&z=14&ie=UTF8&iwloc=&output=embed`}
                  className="absolute inset-0 z-0 group-hover:filter-none transition-all duration-700"
                ></iframe>
                <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-black/10 via-transparent to-transparent z-10"></div>
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(listing.location)}`}
                  target="_blank"
                  className="absolute top-4 right-4 z-20 w-10 h-10 bg-white shadow-lg rounded-full flex items-center justify-center text-primary group-hover:scale-110 transition-transform active:scale-95"
                >
                  <span className="material-symbols-outlined text-xl">map</span>
                </a>
              </div>
            </div>
          </div>

          <div className="lg:col-span-4">
            <div className="sticky top-28 space-y-6">
              <div className="bg-white p-6 rounded-3xl shadow-[0_16px_32px_rgba(21,21,125,0.06)] border border-slate-50 space-y-6">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full overflow-hidden bg-surface-container flex items-center justify-center">
                    {listing.user.avatar ? (
                      <img className="w-full h-full object-cover" alt={listing.user.name} src={listing.user.avatar} />
                    ) : (
                      <span className="material-symbols-outlined text-3xl text-outline">person</span>
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-lg text-on-surface">
                        {listing.user.isPro ? listing.user.companyName || listing.user.name : listing.user.name}
                      </h3>
                      {listing.user.isPro && <ProBadge size="sm" />}
                    </div>
                    {listing.user.verified && (
                      <div className="flex items-center gap-1 text-[#2f6fb8] font-semibold text-xs mt-0.5">
                        <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
                        Vendeur vérifié
                      </div>
                    )}
                    {listing.user.isPro && (
                      <p className="text-outline text-xs mt-0.5">Vendeur professionnel</p>
                    )}
                    {listing.user.isPro && listing.user.siret && (
                      <p className="text-[10px] text-outline/70 font-mono mt-0.5">
                        SIRET {listing.user.siret}
                      </p>
                    )}
                  </div>
                </div>

                <div className={`grid ${responseTime ? "grid-cols-2" : "grid-cols-1"} gap-3`}>
                  {responseTime && (
                    <div className="bg-slate-50 p-3 rounded-xl text-center">
                      <span className="block text-outline text-[10px] uppercase font-bold tracking-tighter text-slate-500">Réponse moyenne</span>
                      <span className="text-[#2f6fb8] font-bold text-sm">{responseTime}</span>
                    </div>
                  )}
                  <div className="bg-slate-50 p-3 rounded-xl text-center">
                    <span className="block text-outline text-[10px] uppercase font-bold tracking-tighter text-slate-500">Membre depuis</span>
                    <span className="text-[#2f6fb8] font-bold text-sm">{listing.user.memberSince}</span>
                  </div>
                </div>

                {!isOwner && (
                  <SellerActions
                    listingId={listing.id}
                    sellerId={listing.userId}
                    phone={(listing as any).phone ?? null}
                    hidePhone={(listing as any).hidePhone ?? false}
                  />
                )}
                {isOwner && (
                  <OwnerActions
                    listingId={listing.id}
                    status={(listing as any).status}
                    rejectionReason={(listing as any).rejectionReason ?? null}
                    createdAt={listing.createdAt.toISOString()}
                  />
                )}
              </div>

              <div className="bg-blue-50/50 p-5 rounded-3xl flex items-start gap-4 border border-blue-100/50">
                <span className="material-symbols-outlined text-blue-500">security</span>
                <div>
                  <span className="block font-bold text-blue-900 text-sm">Conseil de sécurité</span>
                  <p className="text-blue-800/70 text-xs mt-1 leading-snug">Rencontrez-vous dans des lieux publics et ne payez jamais avant d&apos;avoir vu l&apos;article.</p>
                </div>
              </div>

              {!isOwner && (
                <div className="pt-2 text-center">
                  <ReportButton listingId={listing.id} loggedIn={!!currentUserId} />
                </div>
              )}

              {ads.length > 0 && <AdRotator ads={ads} />}
            </div>
          </div>
        </section>

        {/* Similar listings — SEO + UX. Streamed via Suspense so they don't
            block TTFB / LCP of the main listing details. */}
        <Suspense
          fallback={
            <div className="px-4 md:px-6 mt-4 pb-12">
              <div className="h-6 w-48 bg-slate-100 rounded animate-pulse mb-3" />
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="aspect-square rounded-xl bg-slate-100 animate-pulse" />
                ))}
              </div>
            </div>
          }
        >
          <SimilarListings
            listingId={listing.id}
            category={listing.category}
            subcategory={listing.subcategory}
            city={cityShort}
            sellerId={listing.userId}
            sellerName={
              (listing.user as any).isPro && (listing.user as any).companyName
                ? (listing.user as any).companyName
                : (listing.user.name ?? "Particulier")
            }
          />
        </Suspense>
      </main>
    </div>
  );
}

async function SimilarListings({
  listingId,
  category,
  subcategory,
  city,
  sellerId,
  sellerName,
}: {
  listingId: string;
  category: string;
  subcategory: string | null;
  city: string;
  sellerId: string;
  sellerName: string;
}) {
  const [sameCity, sameCategory, fromSeller] = await Promise.all([
    city
      ? prisma.listing.findMany({
          where: {
            id: { not: listingId },
            status: "APPROVED",
            deletedAt: null,
            shadowBanned: false,
            category,
            location: { contains: city, mode: "insensitive" },
          } as any,
          orderBy: { createdAt: "desc" },
          take: 6,
          select: { id: true, title: true, price: true, images: true, location: true },
        }).catch(() => [])
      : Promise.resolve([] as any[]),
    prisma.listing.findMany({
      where: {
        id: { not: listingId },
        status: "APPROVED",
        deletedAt: null,
        shadowBanned: false,
        category,
        ...(subcategory ? { subcategory } : {}),
      } as any,
      orderBy: { createdAt: "desc" },
      take: 12,
      select: { id: true, title: true, price: true, images: true, location: true },
    }).catch(() => []),
    prisma.listing.findMany({
      where: {
        id: { not: listingId },
        userId: sellerId,
        status: "APPROVED",
        deletedAt: null,
        shadowBanned: false,
      } as any,
      orderBy: { createdAt: "desc" },
      take: 6,
      select: { id: true, title: true, price: true, images: true, location: true },
    }).catch(() => []),
  ]);

  const sameCityFiltered = sameCity.filter((l: any) => !fromSeller.find((s: any) => s.id === l.id));
  const sameCategoryFiltered = sameCategory.filter(
    (l: any) =>
      !fromSeller.find((s: any) => s.id === l.id) &&
      !sameCityFiltered.find((c: any) => c.id === l.id),
  ).slice(0, 12);

  const renderCard = (l: any) => {
    let img = "";
    try {
      const imgs = JSON.parse(l.images) as string[];
      img = imgs[0] ?? "";
    } catch {}
    return (
      <Link
        key={l.id}
        href={listingUrl(l.id, l.title)}
        className="group flex flex-col bg-white rounded-xl overflow-hidden border border-slate-200 hover:shadow-md transition-all"
      >
        <div className="relative aspect-square bg-slate-100 overflow-hidden">
          {img && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={img}
              alt={l.title}
              loading="lazy"
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          )}
        </div>
        <div className="p-2.5">
          <p className="text-on-surface font-semibold text-sm leading-snug line-clamp-2">{l.title}</p>
          <p className="text-primary font-bold text-base mt-1">
            {l.price.toLocaleString("fr-FR")} €
          </p>
          <p className="text-outline text-[11px] truncate">{l.location}</p>
        </div>
      </Link>
    );
  };

  return (
    <div className="px-4 md:px-6 mt-4 space-y-10 pb-12">
      {fromSeller.length > 0 && (
        <section>
          <div className="flex items-end justify-between mb-3">
            <h2 className="text-lg font-extrabold text-on-surface font-['Manrope']">
              Autres annonces de {sellerName}
            </h2>
            <Link
              href={`/u/${sellerId}`}
              className="text-xs text-primary font-bold hover:underline whitespace-nowrap"
            >
              Voir le profil →
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
            {fromSeller.map(renderCard)}
          </div>
        </section>
      )}

      {sameCityFiltered.length > 0 && city && (
        <section>
          <h2 className="text-lg font-extrabold text-on-surface font-['Manrope'] mb-3">
            {category} à {city}
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
            {sameCityFiltered.map(renderCard)}
          </div>
        </section>
      )}

      {sameCategoryFiltered.length > 0 && (
        <section>
          <h2 className="text-lg font-extrabold text-on-surface font-['Manrope'] mb-3">
            Annonces similaires {subcategory ? `— ${subcategory}` : `en ${category}`}
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
            {sameCategoryFiltered.map(renderCard)}
          </div>
        </section>
      )}
    </div>
  );
}
