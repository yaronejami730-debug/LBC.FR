import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import Navbar from "@/components/Navbar";
import BottomNav from "@/components/BottomNav";
import SiteFooter from "@/components/SiteFooter";
import { formatDuration } from "@/lib/wellness/classify";
import { listingUrl } from "@/lib/listing-slug";

const BASE = "https://www.dealandcompany.fr";

const DAYS = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];

const getProfile = (slug: string) =>
  prisma.proProfile
    .findUnique({
      where: { slug },
      include: {
        services: { orderBy: { position: "asc" } },
        user: {
          select: {
            id: true,
            name: true,
            companyName: true,
            avatar: true,
            proVerifiedAt: true,
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
  if (!profile || !profile.isPublished) return { robots: { index: false, follow: false } };

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
  if (!profile || !profile.isPublished) notFound();

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
    <div className="bg-surface text-on-surface min-h-screen mb-24 md:mb-0">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <Navbar />

      <main className="pt-28 md:pt-36 pb-12 px-4 max-w-4xl mx-auto space-y-6">
        <header className="bg-white rounded-2xl border border-slate-100 p-6 shadow-[0_8px_24px_rgba(21,21,125,0.04)]">
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

          {(profile.phone || profile.website) && (
            <div className="mt-4 flex flex-wrap gap-2">
              {profile.phone && (
                <a
                  href={`tel:${profile.phone}`}
                  title={`Appeler ${profile.name}`}
                  className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-white"
                >
                  <span className="material-symbols-outlined text-[18px]">call</span>
                  {profile.phone}
                </a>
              )}
              {profile.website && (
                <a
                  href={profile.website}
                  target="_blank"
                  rel="noreferrer nofollow"
                  title="Site de l'établissement"
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-5 py-2.5 text-sm font-bold text-on-surface-variant hover:border-primary hover:text-primary"
                >
                  <span className="material-symbols-outlined text-[18px]">language</span>
                  Site web
                </a>
              )}
            </div>
          )}
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
                    {items.map((s) => (
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
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
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
      <BottomNav />
    </div>
  );
}
