import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { formatDistanceToNow } from "@/lib/utils";
import ContactButtons from "./ContactButtons";

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

  if (!listing) notFound();

  const currentUserId = session?.user?.id ?? null;
  const isOwner = currentUserId === listing.userId;

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

  return (
    <div className="bg-surface text-on-surface mb-24">
      {/* TopAppBar */}
      <nav className="fixed top-0 w-full z-50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl shadow-[0_16px_32px_rgba(21,21,125,0.06)]">
        <div className="flex items-center justify-between px-6 py-4 w-full max-w-7xl mx-auto">
          <div className="flex items-center gap-4">
            <Link href="/search" className="material-symbols-outlined text-[#15157d] dark:text-[#60fcc6] active:scale-95 transition-transform">arrow_back</Link>
            <span className="font-['Manrope'] font-bold text-lg tracking-tight text-[#15157d] dark:text-[#60fcc6]">PrèsDeToi</span>
          </div>
          <div className="flex items-center gap-6">
            <button className="material-symbols-outlined text-[#15157d] dark:text-[#60fcc6] active:scale-95 transition-transform">share</button>
            <button className="material-symbols-outlined text-[#15157d] dark:text-[#60fcc6] active:scale-95 transition-transform">favorite</button>
          </div>
        </div>
        <div className="bg-slate-100/50 dark:bg-slate-800/50 h-[1px]"></div>
      </nav>

      {/* Content Canvas */}
      <main className="pt-20 max-w-7xl mx-auto">
        {/* Large Asymmetric Image Gallery */}
        <section className="px-4 md:px-6 mt-4">
          <div className="grid grid-cols-4 grid-rows-2 gap-3 h-[300px] md:h-[500px]">
            <div className="col-span-3 row-span-2 rounded-xl overflow-hidden shadow-sm relative group">
              <img className="w-full h-full object-cover" alt={listing.title} src={mainImg} />
              <div className="absolute bottom-4 right-4 bg-black/40 backdrop-blur-md text-white px-3 py-1 rounded-full text-xs font-medium">1 / {Math.max(images.length, 1)}</div>
            </div>
            <div className="col-span-1 row-span-1 rounded-xl overflow-hidden shadow-sm">
              <img className="w-full h-full object-cover" alt={listing.title} src={images[1] || mainImg} />
            </div>
            <div className="col-span-1 row-span-1 rounded-xl overflow-hidden shadow-sm relative">
              <img className="w-full h-full object-cover" alt={listing.title} src={images[2] || mainImg} />
              {images.length > 3 && (
                <div className="absolute inset-0 bg-primary/40 flex items-center justify-center backdrop-blur-[2px]">
                  <span className="text-white font-bold text-lg">+{images.length - 3}</span>
                </div>
              )}
            </div>
          </div>
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
              <div className="bg-surface-container-low p-6 rounded-2xl">
                <p className="text-on-surface-variant leading-relaxed font-body whitespace-pre-wrap">
                  {listing.description}
                </p>
              </div>
            </div>

            {/* Location */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold tracking-tight">Localisation</h2>
                <span className="text-primary font-semibold text-sm">{listing.location}</span>
              </div>
              <div className="h-48 rounded-2xl bg-slate-200 overflow-hidden relative flex items-center justify-center">
                <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center backdrop-blur-sm">
                  <span className="material-symbols-outlined text-primary text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>location_on</span>
                </div>
                <p className="absolute bottom-4 left-4 bg-white/90 px-3 py-1 rounded-full text-sm font-semibold text-on-surface">{listing.location}</p>
              </div>
            </div>
          </div>

          {/* Right Column: Seller Info */}
          <div className="lg:col-span-4">
            <div className="sticky top-28 space-y-6">
              {/* Seller Card */}
              <div className="bg-surface-container-lowest p-6 rounded-3xl shadow-[0_16px_32px_rgba(21,21,125,0.06)] space-y-6">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full overflow-hidden bg-surface-container flex items-center justify-center">
                    {listing.user.avatar ? (
                      <img className="w-full h-full object-cover" alt={listing.user.name} src={listing.user.avatar} />
                    ) : (
                      <span className="material-symbols-outlined text-3xl text-outline">person</span>
                    )}
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-on-surface">{listing.user.name}</h3>
                    {listing.user.verified && (
                      <div className="flex items-center gap-1 text-on-tertiary-container font-semibold text-xs">
                        <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
                        Vendeur vérifié
                      </div>
                    )}
                    <div className="flex items-center gap-1 mt-1">
                      <span className="material-symbols-outlined text-orange-400 text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                      <span className="text-on-surface text-xs font-bold">4.9</span>
                      <span className="text-outline text-xs">(128 reviews)</span>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-surface-container-low p-3 rounded-xl text-center">
                    <span className="block text-outline text-[10px] uppercase font-bold tracking-tighter">Temps de réponse</span>
                    <span className="text-on-surface font-bold text-sm">15 mins</span>
                  </div>
                  <div className="bg-surface-container-low p-3 rounded-xl text-center">
                    <span className="block text-outline text-[10px] uppercase font-bold tracking-tighter">Membre depuis</span>
                    <span className="text-on-surface font-bold text-sm">{listing.user.memberSince}</span>
                  </div>
                </div>
                <button className="w-full py-3 rounded-xl bg-surface-container-high text-primary font-bold text-sm hover:bg-primary/5 transition-colors">
                  Voir le profil
                </button>
              </div>

              {/* Conseil de sécurité */}
              <div className="bg-tertiary-container/10 p-5 rounded-3xl flex items-start gap-4">
                <span className="material-symbols-outlined text-tertiary-fixed-dim">security</span>
                <div>
                  <span className="block font-bold text-tertiary text-sm">Conseil de sécurité</span>
                  <p className="text-on-surface-variant text-xs mt-1 leading-snug">Rencontrez-vous dans des lieux publics et ne payez jamais avant d'avoir vu l'article.</p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Bottom Action Bar */}
      {!isOwner && <ContactButtons listingId={listing.id} sellerId={listing.userId} />}
    </div>
  );
}
