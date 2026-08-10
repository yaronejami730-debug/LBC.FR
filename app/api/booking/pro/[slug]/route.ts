import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { bookingErrorResponse } from "@/lib/booking/http";
import { DEFAULT_BOOKING_POLICY, loadBookingPolicy } from "@/lib/booking/queries";

export const runtime = "nodejs";

/**
 * Fiche publique d'un établissement, prête à afficher et à réserver.
 *
 * Sert la page web comme l'écran mobile : mêmes prestations, même équipe,
 * mêmes règles. Les données de contact du pro sont publiques par nature (c'est
 * une vitrine), mais rien du compte utilisateur propriétaire n'est exposé.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await ctx.params;

    const profile = await prisma.proProfile.findUnique({
      where: { slug },
      include: {
        services: { where: { isActive: true }, orderBy: { position: "asc" } },
        members: {
          where: { isActive: true },
          orderBy: { position: "asc" },
          include: { services: { select: { serviceId: true } } },
        },
      },
    });

    if (!profile || !profile.isPublished) {
      return NextResponse.json({ error: "Établissement introuvable." }, { status: 404 });
    }

    const policy = await loadBookingPolicy(profile.id).catch(() => DEFAULT_BOOKING_POLICY);

    return NextResponse.json(
      {
        profile: {
          id: profile.id,
          slug: profile.slug,
          name: profile.name,
          description: profile.description,
          categories: safeJson<string[]>(profile.categories, []),
          addressLine: profile.addressLine,
          city: profile.city,
          postalCode: profile.postalCode,
          phone: profile.phone,
          website: profile.website,
          hours: safeJson<Record<string, string>>(profile.hours, {}),
          photos: safeJson<string[]>(profile.photos, []),
          coverImage: profile.coverImage,
        },
        services: profile.services.map((s) => ({
          id: s.id,
          section: s.section,
          label: s.label,
          durationMin: s.durationMin,
          price: s.price,
          priceNote: s.priceNote,
          // Une ligne sans durée reste affichée sur la carte mais ne peut pas
          // produire de créneau : le front doit masquer son bouton Réserver.
          bookable: s.isBookable && !!s.durationMin && s.durationMin > 0,
        })),
        members: profile.members.map((m) => ({
          id: m.id,
          displayName: m.displayName,
          role: m.role,
          avatar: m.avatar,
          color: m.color,
          serviceIds: m.services.map((link) => link.serviceId),
        })),
        booking: {
          minNoticeMin: policy.minNoticeMin,
          maxAdvanceDays: policy.maxAdvanceDays,
          slotGranularityMin: policy.slotGranularityMin,
          autoConfirm: policy.autoConfirm,
          allowCancel: policy.allowCancel,
          allowReschedule: policy.allowReschedule,
          cancelDeadlineMin: policy.cancelDeadlineMin,
        },
      },
      { headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" } },
    );
  } catch (error) {
    return bookingErrorResponse(error);
  }
}

/** Les colonnes JSON du projet sont des `String` : une donnée corrompue ne doit pas casser la fiche. */
function safeJson<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}
