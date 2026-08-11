import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import Navbar from "@/components/Navbar";
import BookingFlow from "./BookingFlow";

export const dynamic = "force-dynamic";

const getProfile = (slug: string) =>
  prisma.proProfile
    .findUnique({
      where: { slug },
      include: {
        services: { where: { isActive: true }, orderBy: { position: "asc" } },
        members: {
          where: { isActive: true },
          orderBy: { position: "asc" },
          include: { services: { select: { serviceId: true } } },
        },
        user: { select: { professionalStatus: true, bannedAt: true } },
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
  if (!profile) return { robots: { index: false, follow: false } };
  return {
    title: `Réserver — ${profile.name}`,
    // Le tunnel de réservation n'a rien à faire dans l'index : c'est la fiche
    // qui doit ressortir, pas une étape de formulaire.
    robots: { index: false, follow: true },
  };
}

/**
 * Tunnel de réservation.
 *
 * Les données de départ sont rendues côté serveur (prestations, équipe) pour
 * que la première étape s'affiche sans attendre. Tout le reste — jours ouverts,
 * créneaux, création — passe par l'API, la même que celle de l'application
 * mobile.
 */
export default async function ReserverPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  // `?service=<id>` : la fiche envoie ici depuis la ligne de la carte, avec la
  // prestation déjà choisie.
  searchParams: Promise<{ service?: string }>;
}) {
  const { service: preselectedService } = await searchParams;
  const { slug } = await params;
  const profile = await getProfile(slug);

  if (!profile || profile.user.professionalStatus !== "APPROVED" || profile.user.bannedAt) {
    notFound();
  }

  // Fiche mise hors ligne pendant que quelqu'un avait le tunnel ouvert, ou lien
  // de réservation partagé tel quel : on renvoie sur la fiche, qui explique
  // sous le nom de l'établissement qu'elle est en cours de mise à jour. Un 404
  // ici laisserait croire que la boutique a fermé.
  if (!profile.isPublished) {
    redirect(`/pro/${profile.slug}`);
  }

  return (
    <div className="bg-surface text-on-surface min-h-screen">
      <Navbar />
      <main className="pt-28 md:pt-36 pb-12 px-4 max-w-2xl mx-auto space-y-4">
        <div>
          <Link
            href={`/pro/${profile.slug}`}
            title={profile.name}
            className="text-sm font-semibold text-primary inline-flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            {profile.name}
          </Link>
          <h1 className="text-2xl font-extrabold tracking-tight font-['Manrope'] mt-2">
            Réserver
          </h1>
          {(profile.addressLine || profile.city) && (
            <p className="text-sm text-outline mt-1">
              {[profile.addressLine, profile.postalCode, profile.city].filter(Boolean).join(", ")}
            </p>
          )}
        </div>

        <BookingFlow
          initialServiceId={preselectedService ?? null}
          profile={{
            name: profile.name,
            slug: profile.slug,
            city: profile.city,
            addressLine: profile.addressLine,
            postalCode: profile.postalCode,
            phone: profile.phone,
          }}
          services={profile.services.map((s) => ({
            id: s.id,
            section: s.section,
            label: s.label,
            durationMin: s.durationMin,
            price: s.price,
            priceNote: s.priceNote,
            bookable: s.isBookable && !!s.durationMin && s.durationMin > 0,
          }))}
          members={profile.members.map((m) => ({
            id: m.id,
            displayName: m.displayName,
            role: m.role,
            avatar: m.avatar,
            color: m.color,
            serviceIds: m.services.map((link) => link.serviceId),
          }))}
        />
      </main>
    </div>
  );
}
