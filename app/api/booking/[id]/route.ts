import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUserId } from "@/lib/auth-unified";
import { BookingError } from "@/lib/booking/engine";
import { bookingErrorResponse } from "@/lib/booking/http";
import { emit } from "@/lib/booking/notify";
import { loadBookingPolicy } from "@/lib/booking/queries";
import { isOccupying } from "@/lib/booking/status";
import { createBooking } from "@/lib/booking/book";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Annulation d'un rendez-vous, par le client ou par le pro.
 *
 * On annule, on ne supprime pas : le créneau est libéré par le changement de
 * statut (la contrainte d'exclusion ne regarde que les statuts occupants), et
 * l'historique reste consultable des deux côtés en cas de litige.
 *
 * Le déplacement passe par une annulation suivie d'une nouvelle réservation :
 * ça évite de contourner le recalcul de disponibilité, qui est précisément ce
 * qui protège le créneau d'arrivée.
 *
 * Deux actions :
 *   cancel      libère le créneau
 *   reschedule  déplace — nouvelle date, nouvelle heure, éventuellement un
 *               autre praticien ou une autre prestation
 */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const userId = await getAuthUserId(req);
    if (!userId) throw new BookingError("Authentification requise.", 401, "UNAUTHORIZED");

    const body = (await req.json().catch(() => ({}))) as {
      action?: string;
      reason?: string;
      day?: string;
      startMin?: number;
      memberId?: string;
      serviceId?: string;
      contact?: Record<string, string>;
    };
    if (body.action !== "cancel" && body.action !== "reschedule") {
      throw new BookingError("Action non supportée.", 400, "UNSUPPORTED_ACTION");
    }

    const booking = await prisma.proBooking.findUnique({
      where: { id },
      include: { profile: { select: { id: true, userId: true } } },
    });
    if (!booking) throw new BookingError("Rendez-vous introuvable.", 404, "BOOKING_NOT_FOUND");

    const isCustomer = booking.customerId === userId;
    const isOwner = booking.profile.userId === userId;
    // Un identifiant deviné ne doit pas permettre d'annuler le rendez-vous
    // d'autrui : seuls le client concerné et le pro propriétaire ont la main.
    if (!isCustomer && !isOwner) {
      throw new BookingError("Rendez-vous introuvable.", 404, "BOOKING_NOT_FOUND");
    }

    if (!isOccupying(booking.status)) {
      throw new BookingError("Ce rendez-vous est déjà clos.", 409, "ALREADY_CLOSED");
    }

    // ── Déplacement ────────────────────────────────────────────────────
    //
    // Réservé au professionnel : c'est lui qui a le client au téléphone. Un
    // client qui veut changer d'heure annule et reprend, ce qui laisse le
    // créneau libéré visible à tous pendant l'opération.
    if (body.action === "reschedule") {
      if (!isOwner) throw new BookingError("Rendez-vous introuvable.", 404, "BOOKING_NOT_FOUND");

      /**
       * Libérer d'abord, réserver ensuite.
       *
       * Sans ça, un déplacement de 10h00 à 10h30 sur une prestation d'une
       * heure entrerait en conflit avec lui-même : l'ancien créneau occupe
       * encore la plage que le nouveau veut prendre. On annule donc dans une
       * transaction, puis on tente la réservation — et si elle échoue, on
       * remet le rendez-vous là où il était.
       */
      await prisma.proBooking.update({
        where: { id },
        data: { status: "CANCELLED", cancelledAt: new Date(), cancelledBy: "PRO", cancelReason: "Déplacé" },
      });

      try {
        const moved = await createBooking({
          serviceId: String(body.serviceId ?? booking.serviceId),
          memberId: String(body.memberId ?? booking.memberId),
          day: String(body.day ?? ""),
          startMin: Number(body.startMin),
          source: booking.source === "ONLINE" ? "MANUAL" : (booking.source as "PHONE" | "MANUAL"),
          forceConfirm: true,
          contact: {
            firstName: body.contact?.firstName ?? booking.firstName,
            lastName: body.contact?.lastName ?? booking.lastName,
            phone: body.contact?.phone ?? booking.phone,
            email: body.contact?.email ?? booking.email,
            note: body.contact?.note ?? booking.note,
          },
          customerId: booking.customerId,
        });

        await emit({
          type: "booking.rescheduled",
          bookingId: moved.id,
          profileId: moved.profileId,
          customerEmail: moved.email,
          customerId: moved.customerId,
        });

        return NextResponse.json({ booking: moved, previousId: id });
      } catch (error) {
        // Le nouveau créneau n'est pas libre : on remet le rendez-vous dans
        // l'état où on l'a trouvé. Un déplacement raté ne doit pas faire
        // disparaître un rendez-vous de l'agenda.
        await prisma.proBooking.update({
          where: { id },
          data: {
            status: booking.status,
            cancelledAt: null,
            cancelledBy: null,
            cancelReason: null,
          },
        });
        throw error;
      }
    }

    // Le pro annule quand il veut — c'est son agenda. Le client est tenu par
    // le délai que le pro a fixé.
    if (isCustomer && !isOwner) {
      const policy = await loadBookingPolicy(booking.profileId);
      if (!policy.allowCancel) {
        throw new BookingError(
          "Cet établissement n'autorise pas l'annulation en ligne.",
          403,
          "CANCEL_DISABLED",
        );
      }
      const minutesUntil = (booking.startAt.getTime() - Date.now()) / 60_000;
      if (minutesUntil < policy.cancelDeadlineMin) {
        throw new BookingError(
          "Le délai d'annulation en ligne est dépassé, contactez l'établissement.",
          409,
          "CANCEL_DEADLINE_PASSED",
        );
      }
    }

    const updated = await prisma.proBooking.update({
      where: { id },
      data: {
        status: "CANCELLED",
        cancelledAt: new Date(),
        cancelledBy: isOwner && !isCustomer ? "PRO" : "CUSTOMER",
        cancelReason: body.reason?.slice(0, 500) || null,
      },
    });

    await emit({
      type: "booking.cancelled",
      bookingId: updated.id,
      profileId: updated.profileId,
      customerEmail: updated.email,
      customerId: updated.customerId,
    });

    return NextResponse.json({ booking: { id: updated.id, status: updated.status } });
  } catch (error) {
    return bookingErrorResponse(error);
  }
}
