import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { BookingError } from "@/lib/booking/engine";
import { bookingErrorResponse, requireOwnedMember, requireProProfile } from "@/lib/booking/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Définit les prestations qu'un membre sait réaliser.
 *
 * Remplacement complet, comme la carte dans `app/api/pro-profile` : le client
 * envoie l'état final, on ne réconcilie pas de diff. Une case décochée doit
 * disparaître, pas survivre à un oubli.
 */
export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const { profile } = await requireProProfile(req, "staff");
    await requireOwnedMember(profile.id, id);

    const body = (await req.json().catch(() => ({}))) as { serviceIds?: unknown };
    const requested = Array.isArray(body.serviceIds) ? body.serviceIds.map(String) : [];

    // Une prestation d'un autre établissement ne doit pas pouvoir être
    // rattachée : on ne garde que celles de la fiche.
    const owned = await prisma.proService.findMany({
      where: { profileId: profile.id, id: { in: requested } },
      select: { id: true },
    });
    if (owned.length !== requested.length) {
      throw new BookingError("Prestation inconnue pour cet établissement.", 400, "UNKNOWN_SERVICE");
    }

    await prisma.$transaction([
      prisma.proMemberService.deleteMany({ where: { memberId: id } }),
      prisma.proMemberService.createMany({
        data: owned.map((s) => ({ memberId: id, serviceId: s.id })),
      }),
    ]);

    return NextResponse.json({ memberId: id, serviceIds: owned.map((s) => s.id) });
  } catch (error) {
    return bookingErrorResponse(error);
  }
}
