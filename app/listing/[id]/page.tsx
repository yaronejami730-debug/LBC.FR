import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { getActiveAds } from "@/lib/ads";
import { auth } from "@/lib/auth";
import { formatDistanceToNow } from "@/lib/utils";
import ListingHeader from "./ListingHeader";
import AdRotator from "./AdRotator";
import { getUserResponseTime } from "@/lib/user-stats";
import SellerActions from "./SellerActions";
import OwnerActions from "./OwnerActions";
import PhotoGallery from "./PhotoGallery";
import HistoryTracker from "@/components/HistoryTracker";
import ProBadge from "@/components/ProBadge";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const listing = await prisma.listing.findUnique({
    where: { id },
    select: { title: true, description: true, images: true, price: true, location: true },
  }).catch(() => null);

  if (!listing) return {};

  const imgs = JSON.parse(listing.images) as string[];
  const rawImg = imgs[0] ?? "";
  const priceStr = listing.price.toLocaleString("fr-FR") + " €";

  // Ensure absolute URL — WhatsApp/iMessage require it
  const BASE = "https://www.dealandcompany.fr";
  const mainImg = rawImg.startsWith("http") ? rawImg : `${BASE}${rawImg}`;
  const pageUrl = `${BASE}/listing/${id}`;

  const desc = `${listing.description.slice(0, 150)}${listing.description.length > 150 ? "…" : ""} · ${listing.location} · ${priceStr}`;

  return {
    title: `${listing.title} — ${priceStr} | Deal&Co`,
    description: desc,
    alternates: { canonical: pageUrl },
    openGraph: {
      title: `${listing.title} — ${priceStr}`,
      description: desc,
      url: pageUrl,
      siteName: "Deal&Co",
      type: "website",
      images: rawImg
        ? [{ url: mainImg, width: 1200, height: 630, alt: listing.title }]
        : [],
    },
    twitter: {
      card: "summary_large_image",
      title: `${listing.title} — ${priceStr}`,
      description: desc,
      images: rawImg ? [mainImg] : [],
    },
  };
}

export default async function ListingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [listing, session] = await Promise.all([
    prisma.listing.findUnique({
      where: { id },
      include: { user: true },
    }),
    auth(),
  ]);

  const ads = await getActiveAds().catch(() => []);

  const currentUserId = session?.user?.id ?? null;

  if (!listing) notFound();

  const isOwner = currentUserId === listing.userId;
  const role = (session?.user as unknown as Record<string, unknown> | undefined)?.role;
  const isAdmin = role === "ADMIN";

  // Check if listing has been soft-deleted
  const listingData = listing as any;
  if (listingData.deletedAt && !isAdmin) {
    notFound();
  }

  if (listing.status !== "APPROVED" && !isOwner && !isAdmin) {
    notFound();
  }

  // Check if user has favorited this listing
  const isFavorite = currentUserId
    ? !!(await prisma.favorite.findUnique({
        where: { userId_listingId: { userId: currentUserId, listingId: id } },
      }))
    : false;

  // Fetch real stats
  const responseTime = await getUserResponseTime(listing.userId);

  // Parse vehicle metadata
  let vehicleMeta: Record<string, string> = {};
  if (listing.category === "Véhicules" && listing.metadata && listing.metadata !== "{}") {
    try {
      vehicleMeta = JSON.parse(listing.metadata);
    } catch {
      // ignore malformed JSON
    }
  }

  const images = JSON.parse(listing.images) as string[];
  const mainImg = images[0] || "https://lh3.googleusercontent.com/aida-public/AB6AXuAwwxQgv4rI6XClzhTLjkwXug8TYby1cyK7AgQhc4UpMdyrjwq4jRPQo_ZvL_7xvjhVSon_iJvztv0bdEqqiFX0CHRW9IDYjccZpyP4v8zoDq0pcj4RtADoGgiXgRyW1_sPXiKqwZz8D1UwMIYilwBQMOTHJ4RMQl9Rp4vFbK6a0UCsy93TZ3-DYA8qYhHPO4LhM2csSFfFLlOh2P8D7w00bjyGrSMRlGSvhxZrGjVcqJUJ2-2y9XbKHb7ww02PREvAIJO3_wJ41hV5";

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: listing.title,
    description: listing.description,
    image: images.length ? images : [mainImg],
    url: `https://www.dealandcompany.fr/listing/${listing.id}`,
    offers: {
      "@type": "Offer",
      price: listing.price,
      priceCurrency: "EUR",
      availability: "https://schema.org/InStock",
      itemCondition:
        listing.condition === "Neuf"
          ? "https://schema.org/NewCondition"
          : "https://schema.org/UsedCondition",
      seller: {
        "@type": "Person",
        name: listing.user.name ?? "Particulier",
      },
    },
    ...(listing.brand ? { brand: { "@type": "Brand", name: listing.brand } } : {}),
  };

  return (
    <div className="bg-surface text-on-surface mb-24 md:mb-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {/* Navbar (Share, Favorites) */}
      <ListingHeader
        title={listing.title}
        listingId={listing.id}
        userId={currentUserId}
        initialFavorite={isFavorite}
      />

      {/* Content Canvas */}
      <main className="pt-32 max-w-7xl mx-auto pb-12">
        {/* Large Asymmetric Image Gallery */}
        {/* Track this category for homepage recommendations */}
        <HistoryTracker category={listing.category} />
        <section className="px-4 md:px-6 mt-4">
          <PhotoGallery images={images} title={listing.title} />
        </section>

        {/* Product Details Grid */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 px-4 md:px-6 py-8">
          {/* Left Column: Details */}
          <div className="lg:col-span-8 space-y-8">
            {/* Header Info */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                {listing.isPremium && (
                  <span className="px-2 py-0.5 bg-secondary-container text-on-secondary-container text-[10px] font-bold uppercase tracking-wider rounded">Annonce Premium</span>
                )}
                <span className="text-outline text-xs font-medium tracking-wide flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm">schedule</span> {formatDistanceToNow(listing.createdAt)}
                </span>
              </div>
              <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-on-surface leading-tight">
                {listing.title}
              </h1>
              <div className="flex items-baseline gap-3 pt-2">
                <span className="text-4xl font-black text-primary">{listing.price.toLocaleString("fr-FR")} €</span>
              </div>
            </div>

            {/* Attributes Row */}
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
            </div>

            {/* Description */}
            <div className="space-y-4">
              <h2 className="text-xl font-bold tracking-tight">Description</h2>
              <div className="bg-slate-50 p-6 rounded-2xl">
                <p className="text-slate-600 leading-relaxed font-body whitespace-pre-wrap">
                  {listing.description}
                </p>
              </div>
            </div>

            {/* Location */}
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
                
                {/* Overlay gradient for premium feel */}
                <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-black/10 via-transparent to-transparent z-10"></div>
                

                {/* Open in maps corner button */}
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

          {/* Right Column: Seller Info */}
          <div className="lg:col-span-4">
            <div className="sticky top-28 space-y-6">
              {/* Seller Card */}
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

                {/* Seller Actions (Voir profil, Message, Téléphone) */}
                {!isOwner && (
                  <SellerActions
                    listingId={listing.id}
                    sellerId={listing.userId}
                    phone={(listing as any).phone ?? null}
                    hidePhone={(listing as any).hidePhone ?? false}
                  />
                )}
                {isOwner && (
                  <OwnerActions listingId={listing.id} />
                )}
              </div>

              {/* Conseil de sécurité */}
              <div className="bg-blue-50/50 p-5 rounded-3xl flex items-start gap-4 border border-blue-100/50">
                <span className="material-symbols-outlined text-blue-500">security</span>
                <div>
                  <span className="block font-bold text-blue-900 text-sm">Conseil de sécurité</span>
                  <p className="text-blue-800/70 text-xs mt-1 leading-snug">Rencontrez-vous dans des lieux publics et ne payez jamais avant d&apos;avoir vu l&apos;article.</p>
                </div>
              </div>

              {/* Publicité rotative */}
              {ads.length > 0 && <AdRotator ads={ads} />}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
