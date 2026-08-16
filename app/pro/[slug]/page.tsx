import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import Navbar from "@/components/Navbar";
import SiteFooter from "@/components/SiteFooter";
import { formatDuration } from "@/lib/wellness/classify";
import { listingUrl } from "@/lib/listing-slug";
import { normalizeWebsite, websiteLabel } from "@/lib/pro/website";
import { safeJsonLd } from "@/lib/json-ld";
import { stockOf } from "@/lib/pro/inventory";

const BASE = "https://www.dealandcompany.fr";

const DAYS = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];

const getProfile = (slug: string) =>
  prisma.proProfile
    .findUnique({
      where: { slug },
      include: {
        services: { where: { isActive: true }, orderBy: { position: "asc" } },
        // Produits en vente. Chargés systématiquement mais affichés seulement
        // si l'établissement en a : une fiche de coiffeur n'aura jamais de
        // rubrique « produits » vide à l'écran.
        products: {
          where: { status: "ACTIVE" },
          orderBy: [{ position: "asc" }, { createdAt: "desc" }],
          take: 60,
          select: {
            id: true,
            name: true,
            section: true,
            price: true,
            comparePrice: true,
            images: true,
            quantity: true,
            reserved: true,
            unlimited: true,
            lowStockAt: true,
            variants: { select: { quantity: true, reserved: true, isActive: true } },
            listings: {
              where: { status: "APPROVED", deletedAt: null, shadowBanned: false },
              select: { id: true, title: true },
              take: 1,
            },
          },
        },
        members: {
          where: { isActive: true },
          orderBy: { position: "asc" },
          include: { services: { select: { serviceId: true } } },
        },
        user: {
          select: {
            id: true,
            name: true,
            companyName: true,
            avatar: true,
            proVerifiedAt: true,
            professionalStatus: true,
            bannedAt: true,
            listings: {
              where: { status: "APPROVED", deletedAt: null, shadowBanned: false },
              orderBy: { createdAt: "desc" },
              take: 6,
              select: { id: true, title: true, price: true, images: true, location: true },
            },
          },
        },
      },
    })
    .catch(() => null);

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const profile = await getProfile(slug);
  // Un compte banni n'est plus une source fiable, même si sa fiche est restée
  // publiée : elle sort de l'index en même temps que ses annonces.
  if (
    !profile ||
    !profile.isPublished ||
    profile.user.professionalStatus !== "APPROVED" ||
    profile.user.bannedAt
  ) {
    return { robots: { index: false, follow: false } };
  }

  const where = profile.city ? ` à ${profile.city}` : "";
  const title = `${profile.name}${where} — Tarifs et prestations`;
  const description =
    profile.description?.slice(0, 155) ??
    `Prestations et tarifs de ${profile.name}${where}. Réservation directe sur Deal&Co.`;

  return {
    title,
    description,
    alternates: { canonical: `${BASE}/pro/${profile.slug}` },
    openGraph: { title, description, url: `${BASE}/pro/${profile.slug}`, siteName: "Deal&Co" },
  };
}

/**
 * Fiche publique d'un établissement.
 *
 * Une seule page pour toute la carte : c'est ce qui évite qu'un salon publie
 * une annonce par prestation. Les annonces du compte restent listées en bas —
 * elles servent d'accroche, la fiche sert de référence.
 */
export default async function ProProfilePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const profile = await getProfile(slug);

  // Fiche inexistante, ou compte qui n'a jamais eu d'habilitation : rien à
  // montrer, et surtout rien à laisser deviner.
  if (!profile || profile.user.bannedAt || profile.user.professionalStatus !== "APPROVED") {
    notFound();
  }

  /**
   * Fiche mise hors ligne par son propriétaire.
   *
   * Un 404 serait une mauvaise réponse : le lien circule — carte de visite,
   * vitrine, signature d'email — et il continuera de circuler. Dire « page
   * introuvable » laisse croire que l'établissement a disparu. On annonce donc
   * une absence temporaire, sous son propre nom.
   *
   * La page reste `noindex` : hors ligne veut dire hors des moteurs aussi.
   */
  if (!profile.isPublished) {
    return <OfflineNotice name={profile.name} city={profile.city} />;
  }

  const hours: Record<string, string> = (() => {
    try {
      return JSON.parse(profile.hours);
    } catch {
      return {};
    }
  })();
  const photos: string[] = (() => {
    try {
      return JSON.parse(profile.photos);
    } catch {
      return [];
    }
  })();

  // Une carte se lit par rubrique — « Massages », « Coiffure », « Barbe » —
  // dans l'ordre où le professionnel les a saisies.
  const sections = profile.services.reduce<Record<string, typeof profile.services>>((acc, s) => {
    (acc[s.section] ??= []).push(s);
    return acc;
  }, {});

  // Une ligne sans durée ne produit aucun créneau : sans prestation réservable
  // ni équipe, le bouton « Réserver » mènerait à un tunnel vide.
  // Produits présentables : on calcule ici plutôt que dans le JSX, pour que le
  // rendu n'ait plus qu'à afficher. `stockOf` reste la seule autorité sur la
  // disponibilité — la fiche publique ne recompte rien elle-même.
  const sellableProducts = profile.products.map((p) => {
    const stock = stockOf(p);
    let image: string | null = null;
    try {
      const parsed = JSON.parse(p.images) as unknown;
      if (Array.isArray(parsed) && typeof parsed[0] === "string") image = parsed[0];
    } catch {
      /* colonne illisible — vignette de repli */
    }
    return {
      id: p.id,
      name: p.name,
      section: p.section,
      price: p.price,
      comparePrice: p.comparePrice,
      image,
      outOfStock: stock.outOfStock,
      low: stock.low,
      listingId: p.listings[0]?.id ?? null,
    };
  });

  const bookableCount = profile.services.filter(
    (s) => s.isBookable && s.durationMin && s.durationMin > 0,
  ).length;
  const canBook = bookableCount > 0 && profile.members.length > 0;

  // Les fiches enregistrées avant la normalisation portent encore des adresses
  // sans schéma (« monsalon.fr ») : on les rend cliquables à l'affichage.
  const websiteUrl = normalizeWebsite(profile.website);

  /** Couverture : image dédiée, sinon la première photo, sinon le dégradé. */
  const coverImage = profile.coverImage ?? photos[0] ?? null;

  /**
   * Monogramme de repli pour le logo. Deux initiales au maximum : « Salon de
   * coiffure Paris 17ème » donne « SC », pas une bouillie de lettres.
   */
  const monogram = profile.name
    .split(/\s+/)
    .filter((w) => w.length > 2)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "HealthAndBeautyBusiness",
    name: profile.name,
    url: `${BASE}/pro/${profile.slug}`,
    ...(profile.phone ? { telephone: profile.phone } : {}),
    ...(profile.addressLine || profile.city
      ? {
          address: {
            "@type": "PostalAddress",
            streetAddress: profile.addressLine ?? undefined,
            addressLocality: profile.city ?? undefined,
            postalCode: profile.postalCode ?? undefined,
            addressCountry: "FR",
          },
        }
      : {}),
    ...(profile.services.length > 0
      ? {
          hasOfferCatalog: {
            "@type": "OfferCatalog",
            name: "Prestations",
            itemListElement: profile.services.slice(0, 50).map((s) => ({
              "@type": "Offer",
              name: s.label,
              price: s.price,
              priceCurrency: "EUR",
            })),
          },
        }
      : {}),
  };

  return (
    <div className="bg-surface text-on-surface min-h-screen">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }} />
      <Navbar />

      <main className="pt-28 md:pt-36 pb-12 px-4 max-w-4xl mx-auto space-y-6">
        {/* `overflow-hidden` est porté par la couverture seule, pas par
            l'en-tête : sur l'en-tête, il rognait le logo qui déborde vers le
            haut. Les coins arrondis de la couverture sont donc redéclarés ici. */}
        <header className="bg-white rounded-2xl border border-slate-100 shadow-[0_8px_24px_rgba(21,21,125,0.04)]">
          {/* Bandeau de couverture. À défaut d'image dédiée, la première photo
              de l'établissement fait l'affaire — c'est presque toujours la
              devanture ou la salle. Sans aucune photo, un dégradé de marque
              plutôt qu'un vide : la fiche doit avoir une tête même neuve. */}
          <div className="relative h-40 sm:h-56 rounded-t-2xl overflow-hidden bg-gradient-to-br from-primary to-[#1a5a9e]">
            {coverImage && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={coverImage}
                alt={`${profile.name} — devanture`}
                className="absolute inset-0 h-full w-full object-cover"
                // Cadrage choisi par l'établissement dans son espace : sans lui,
                // le recadrage automatique coupe au centre et décapite
                // l'enseigne une fois sur deux.
                style={{
                  objectPosition: `${profile.coverX}% ${profile.coverY}%`,
                  transform: `scale(${profile.coverZoom})`,
                }}
              />
            )}
            {/* Voile bas : le rond du logo et son ombre restent lisibles quelle
                que soit la photo. */}
            <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/35 to-transparent" />
          </div>

          <div className="px-6 pb-6">
            {/* Logo rond, à cheval sur la couverture. */}
            <div className="relative z-10 -mt-12 mb-4 flex items-end gap-4">
              <div className="h-24 w-24 shrink-0 rounded-full border-4 border-white bg-white shadow-[0_6px_20px_rgba(21,21,125,0.12)] overflow-hidden grid place-items-center">
                {profile.user.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={profile.user.avatar}
                    alt={`Logo ${profile.name}`}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  // Pas de logo : un monogramme vaut mieux qu'un rond gris. Il
                  // reste stable dans le temps, contrairement à une icône
                  // générique que l'œil ne rattache à rien.
                  <span className="text-2xl font-extrabold text-primary font-['Manrope']">{monogram}</span>
                )}
              </div>
            </div>

          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight font-['Manrope']">{profile.name}</h1>
              {(profile.addressLine || profile.city) && (
                <p className="text-sm text-outline mt-1">
                  {[profile.addressLine, profile.postalCode, profile.city].filter(Boolean).join(", ")}
                </p>
              )}
            </div>
            {profile.user.proVerifiedAt && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#d5e3fc] px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-[#2f6fb8]">
                <span className="material-symbols-outlined text-[16px]">verified</span>
                Professionnel vérifié
              </span>
            )}
          </div>

          {profile.description && (
            <p className="mt-4 text-sm leading-relaxed text-on-surface-variant whitespace-pre-wrap">
              {profile.description}
            </p>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            {/* La réservation prime sur le téléphone : c'est ce que
                l'établissement gagne à être ici plutôt que sur un annuaire. */}
            {canBook && (
              <Link
                href={`/pro/${profile.slug}/reserver`}
                title={`Réserver chez ${profile.name}`}
                className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-bold text-white shadow-[0_6px_16px_rgba(47,111,184,0.25)]"
              >
                <span className="material-symbols-outlined text-[18px]">event_available</span>
                Réserver
              </Link>
            )}
          </div>

          {(profile.phone || websiteUrl) && (
            <div className="mt-3 flex flex-wrap gap-2">
              {profile.phone && (
                <a
                  href={`tel:${profile.phone}`}
                  title={`Appeler ${profile.name}`}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-5 py-2.5 text-sm font-bold text-on-surface-variant hover:border-primary hover:text-primary"
                >
                  <span className="material-symbols-outlined text-[18px]">call</span>
                  {profile.phone}
                </a>
              )}
              {websiteUrl && (
                // Le domaine plutôt que « Site web » : le visiteur voit où il
                // va avant de cliquer, et reconnaît l'enseigne qu'il connaît.
                <a
                  href={websiteUrl}
                  target="_blank"
                  rel="noreferrer nofollow"
                  title={`Ouvrir ${websiteLabel(websiteUrl)} dans un nouvel onglet`}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-5 py-2.5 text-sm font-bold text-on-surface-variant hover:border-primary hover:text-primary"
                >
                  <span className="material-symbols-outlined text-[18px]">language</span>
                  {websiteLabel(websiteUrl)}
                  <span className="material-symbols-outlined text-[16px]">open_in_new</span>
                </a>
              )}
            </div>
          )}
          </div>
        </header>

        {photos.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {photos.slice(0, 6).map((src) => (
              <img
                key={src}
                src={src}
                alt={profile.name}
                loading="lazy"
                className="aspect-square w-full rounded-xl object-cover bg-slate-100"
              />
            ))}
          </div>
        )}

        {profile.services.length > 0 && (
          <section className="bg-white rounded-2xl border border-slate-100 p-6 shadow-[0_8px_24px_rgba(21,21,125,0.04)]">
            <h2 className="text-lg font-extrabold tracking-tight font-['Manrope'] mb-4">
              Carte des prestations
            </h2>
            <div className="space-y-6">
              {Object.entries(sections).map(([section, items]) => (
                <div key={section}>
                  <h3 className="text-[11px] font-bold uppercase tracking-[0.12em] text-primary mb-2">
                    {section}
                  </h3>
                  <ul className="divide-y divide-slate-100">
                    {items.map((s) => {
                      // Une ligne sans durée ferme ne produit aucun créneau :
                      // le moteur ne saurait pas combien de temps bloquer. Elle
                      // reste affichée, mais renvoie vers le téléphone.
                      const lineBookable =
                        canBook && s.isBookable && !!s.durationMin && s.durationMin > 0;
                      return (
                        <li key={s.id} className="flex items-baseline gap-3 py-2.5">
                          <span className="font-semibold">{s.label}</span>
                          {s.durationMin ? (
                            <span className="text-xs text-outline shrink-0">
                              {formatDuration(s.durationMin)}
                            </span>
                          ) : null}
                          <span
                            className="flex-1 border-b border-dotted border-slate-200 translate-y-[-3px]"
                            aria-hidden
                          />
                          <span className="font-extrabold text-primary shrink-0">
                            {s.priceNote ? `${s.priceNote} ` : ""}
                            {s.price.toLocaleString("fr-FR")} €
                          </span>
                          {/* Réserver depuis la ligne : le client a choisi sa
                              prestation en la lisant, lui redemander de la
                              sélectionner au début du tunnel est une étape de
                              trop. */}
                          {lineBookable && (
                            <Link
                              href={`/pro/${profile.slug}/reserver?service=${s.id}`}
                              title={`Réserver « ${s.label} »`}
                              className="shrink-0 rounded-full border border-primary/30 px-3 py-1 text-[11px] font-bold text-primary hover:bg-primary hover:text-white transition-colors"
                            >
                              Réserver
                            </Link>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Ce que la boutique vend. La section n'apparaît que si des produits
            existent : la fiche s'adapte à l'activité réelle, sans que personne
            n'ait à déclarer un « type de compte ». */}
        {sellableProducts.length > 0 && (
          <section className="bg-white rounded-2xl border border-slate-100 p-6 shadow-[0_8px_24px_rgba(21,21,125,0.04)]">
            <h2 className="text-lg font-extrabold tracking-tight font-['Manrope'] mb-4">
              {profile.services.length > 0 ? "Nos produits" : "Notre catalogue"}
            </h2>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {sellableProducts.map((p) => (
                <li
                  key={p.id}
                  className="rounded-xl border border-slate-100 overflow-hidden flex flex-col"
                >
                  {p.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.image}
                      alt={p.name}
                      className="w-full h-36 object-cover bg-slate-50"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-36 bg-slate-50" aria-hidden />
                  )}
                  <div className="p-3.5 flex-1 flex flex-col">
                    <p className="font-semibold text-[15px] leading-snug text-on-surface">
                      {p.name}
                    </p>
                    {p.section && (
                      <p className="text-[11px] uppercase tracking-wider text-slate-400 mt-0.5">
                        {p.section}
                      </p>
                    )}
                    <p className="mt-2 font-extrabold text-primary">
                      {p.price.toLocaleString("fr-FR")} €
                      {p.comparePrice && p.comparePrice > p.price && (
                        <span className="ml-2 text-xs font-semibold text-slate-400 line-through">
                          {p.comparePrice.toLocaleString("fr-FR")} €
                        </span>
                      )}
                    </p>
                    {/* Une rupture se dit, elle ne se cache pas : le client qui
                        se déplace pour rien ne revient pas. */}
                    {p.outOfStock ? (
                      <p className="mt-1 text-xs font-semibold text-[#9a6118]">
                        Momentanément épuisé
                      </p>
                    ) : p.low ? (
                      <p className="mt-1 text-xs text-slate-400">Derniers exemplaires</p>
                    ) : null}
                    {p.listingId && (
                      <Link
                        href={`/annonce/${p.listingId}`}
                        className="mt-3 inline-block text-sm font-bold text-primary hover:underline"
                      >
                        Voir l&apos;annonce
                      </Link>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {profile.members.length > 0 && (
          <section className="bg-white rounded-2xl border border-slate-100 p-6">
            <h2 className="text-lg font-extrabold tracking-tight font-['Manrope'] mb-4">L&apos;équipe</h2>
            <ul className="flex flex-wrap gap-4">
              {profile.members.map((m) => (
                <li key={m.id} className="flex items-center gap-3">
                  {m.avatar ? (
                    // Un visage plutôt qu'une initiale : le client qui demande
                    // « avec Corinne » choisit une personne.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={m.avatar}
                      alt={m.displayName}
                      className="w-11 h-11 rounded-full object-cover"
                    />
                  ) : (
                    <span
                      className="w-11 h-11 rounded-full flex items-center justify-center text-white text-sm font-extrabold"
                      style={{ backgroundColor: m.color }}
                      aria-hidden
                    >
                      {m.displayName.slice(0, 1).toUpperCase()}
                    </span>
                  )}
                  <span>
                    <span className="font-bold text-sm block">{m.displayName}</span>
                    {m.role && <span className="text-xs text-outline">{m.role}</span>}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {Object.keys(hours).length > 0 && (
          <section className="bg-white rounded-2xl border border-slate-100 p-6">
            <h2 className="text-lg font-extrabold tracking-tight font-['Manrope'] mb-3">Horaires</h2>
            <ul className="text-sm">
              {DAYS.filter((d) => hours[d]).map((d) => (
                <li key={d} className="flex justify-between py-1.5 border-b border-slate-50 last:border-0">
                  <span className="capitalize text-on-surface-variant">{d}</span>
                  <span className="font-semibold">{hours[d]}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {profile.user.listings.length > 0 && (
          <section className="bg-white rounded-2xl border border-slate-100 p-6">
            <h2 className="text-lg font-extrabold tracking-tight font-['Manrope'] mb-3">
              Annonces de l&apos;établissement
            </h2>
            <ul className="divide-y divide-slate-100">
              {profile.user.listings.map((l) => (
                <li key={l.id}>
                  <Link
                    href={listingUrl(l.id, l.title)}
                    title={`${l.title} — ${l.price.toLocaleString("fr-FR")} €`}
                    className="flex items-center justify-between gap-3 py-3 hover:text-primary"
                  >
                    <span className="font-semibold truncate">{l.title}</span>
                    <span className="font-extrabold text-primary shrink-0">
                      {l.price.toLocaleString("fr-FR")} €
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}

/**
 * Écran « cet établissement met à jour sa fiche ».
 *
 * Volontairement sobre et sans navigation de catalogue : le visiteur venait
 * voir un salon précis, lui déverser la page d'accueil serait une réponse à
 * côté. Un seul lien de sortie, discret, vers Deal&Co.
 */
function OfflineNotice({ name, city }: { name: string; city: string | null }) {
  return (
    <div className="bg-surface text-on-surface min-h-screen flex flex-col">
      <main className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-md text-center">
          <span className="material-symbols-outlined text-[40px] text-primary/40">storefront</span>

          <h1 className="mt-3 text-2xl font-extrabold tracking-tight font-['Manrope']">
            {name}
          </h1>
          {city && <p className="text-sm text-outline mt-0.5">{city}</p>}

          <p className="mt-5 text-base leading-relaxed text-on-surface-variant">
            Cet établissement met à jour sa fiche.
            <br />
            Elle sera de nouveau consultable très bientôt.
          </p>

          <p className="mt-3 text-xs text-outline leading-relaxed">
            Le lien reste valable : inutile de le remplacer, cette page reviendra à la même adresse.
          </p>

          <div className="mt-10 pt-6 border-t border-outline-variant/20">
            <Link href="/" title="Deal&Co — petites annonces" className="inline-block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.png" alt="Deal & Co" className="h-9 w-auto mx-auto opacity-70" />
            </Link>
            <p className="mt-2 text-[11px] text-outline">
              Fiche professionnelle hébergée sur Deal&amp;Co
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
