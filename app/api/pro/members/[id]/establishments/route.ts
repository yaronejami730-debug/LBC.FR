import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { BookingError } from "@/lib/booking/engine";
import { bookingErrorResponse, requireOwnedMember, requireProProfile } from "@/lib/booking/http";
import { canManageEstablishments } from "@/lib/pro/access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Établissements dans lesquels un membre d'équipe travaille.
 *
 * Corinne est coiffeuse à Paris 17e le lundi et à Neuilly le jeudi. Ce n'est
 * pas deux Corinne : c'est une personne, un identifiant de connexion, un seul
 * planning — mais des horaires propres à chaque boutique et un agenda qui dit
 * où elle est attendue.
 *
 * `ProMember.profileId` reste l'établissement d'origine, celui qui l'a créée.
 * Cette table liste les autres. On ne peut donc pas « détacher » quelqu'un de
 * sa boutique d'origine : pour cela on le désactive, ce qui préserve
 * l'historique de ses rendez-vous.
 */
export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const { profile, context } = await requireProProfile(req, "staff");
    const member = await requireOwnedMember(profile.id, id);

    // Prêter un salarié à une autre boutique engage l'organisation du groupe :
    // un MANAGER, qui ne pilote qu'un planning, n'a pas à en décider.
    if (!canManageEstablishments(context.role)) {
      throw new BookingError(
        "Seul un responsable peut affecter un membre à un autre établissement.",
        403,
        "FORBIDDEN",
      );
    }

    const body = (await req.json().catch(() => ({}))) as { profileIds?: unknown };
    const requested = Array.isArray(body.profileIds) ? body.profileIds.map(String) : [];

    // Seuls les établissements que ce compte administre : sans ce filtre, un
    // identifiant deviné placerait un inconnu dans l'équipe d'un concurrent.
    const allowed = new Set(context.establishments.map((e) => e.id));
    const unknown = requested.filter((p) => !allowed.has(p));
    if (unknown.length > 0) {
      throw new BookingError("Établissement inconnu.", 400, "UNKNOWN_ESTABLISHMENT");
    }

    // L'établissement d'origine est implicite : le stocker en double n'ajoute
    // rien et laisserait croire qu'on peut l'enlever.
    const extra = [...new Set(requested)].filter((p) => p !== member.profileId);

    await prisma.$transaction([
      prisma.proMemberEstablishment.deleteMany({ where: { memberId: member.id } }),
      ...(extra.length > 0
        ? [
            prisma.proMemberEstablishment.createMany({
              data: extra.map((profileId) => ({ memberId: member.id, profileId })),
            }),
          ]
        : []),
    ]);

    return NextResponse.json({
      memberId: member.id,
      homeProfileId: member.profileId,
      profileIds: [member.profileId, ...extra],
    });
  } catch (error) {
    return bookingErrorResponse(error);
  }
}
