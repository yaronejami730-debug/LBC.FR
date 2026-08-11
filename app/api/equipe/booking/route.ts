import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { createBooking } from "@/lib/booking/book";
import { BookingError, getSlots, loadBookableService } from "@/lib/booking/engine";
import { bookingErrorResponse } from "@/lib/booking/http";
import { isDayKey } from "@/lib/booking/time";
import { requireActiveMember } from "@/lib/pro-member-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Prise de rendez-vous par le membre d'équipe lui-même.
 *
 * Le téléphone du salon sonne rarement sur le poste de la responsable : c'est
 * souvent la coiffeuse, entre deux clientes, qui décroche et note. Jusqu'ici
 * elle ne pouvait que consulter son planning — le rendez-vous finissait sur un
 * carnet papier, donc invisible du moteur, donc réservable en ligne par
 * quelqu'un d'autre à la même heure.
 *
 * Deux garde-fous, et ils tiennent en une phrase : elle ne peut réserver que
 * **sur son propre planning**, et uniquement pour une prestation qu'elle
 * assure. Le `memberId` n'est jamais lu depuis la requête — c'est la session
 * qui le donne. Un identifiant deviné ne remplit donc pas le carnet d'une
 * collègue.
 *
 * Tout le reste passe par `createBooking`, exactement comme la réservation en
 * ligne : mêmes horaires, mêmes pauses, mêmes absences, même battement, même
 * contrainte d'exclusion PostgreSQL contre le double booking.
 */

/** Trois alternatives : de quoi relancer l'échange sans lire une liste au client. */
const MAX_ALTERNATIVES = 3;

/**
 * Prestations que ce membre assure, et disponibilité d'un créneau précis.
 *
 * Sans paramètre : la liste des prestations, pour alimenter le formulaire.
 * Avec `?serviceId=…&day=…&startMin=…` : la réponse à « est-ce que je peux
 * prendre ce rendez-vous ? », et sinon quoi proposer.
 */
export async function GET(req: NextRequest) {
  try {
    const member = await requireActiveMember();
    if (!member) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const url = new URL(req.url);
    const serviceId = url.searchParams.get("serviceId");

    if (!serviceId) {
      const services = await prisma.proService.findMany({
        where: {
          profileId: member.profileId,
          isActive: true,
          isBookable: true,
          durationMin: { gt: 0 },
          members: { some: { memberId: member.id } },
        },
        orderBy: { position: "asc" },
        select: { id: true, label: true, section: true, durationMin: true, price: true },
      });
      return NextResponse.json({ services });
    }

    const day = url.searchParams.get("day") ?? "";
    if (!isDayKey(day)) throw new BookingError("`day` attendu au format YYYY-MM-DD.", 400, "INVALID_DAY");

    // Appartenance : la prestation doit être celle de son établissement, et
    // faire partie de ce qu'elle sait faire. Sans ce contrôle, un identifiant
    // recopié depuis une autre fiche ouvrirait un planning voisin.
    const service = await loadBookableService(serviceId);
    if (service.profileId !== member.profileId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const assigned = await prisma.proMemberService.findUnique({
      where: { memberId_serviceId: { memberId: member.id, serviceId } },
      select: { id: true },
    });
    if (!assigned) {
      throw new BookingError(
        "Cette prestation ne vous est pas attribuée. Demandez-la à votre responsable.",
        409,
        "MEMBER_NOT_ELIGIBLE",
      );
    }

    // Créneaux de son seul planning : « peu importe » n'a pas de sens ici, la
    // personne prend le rendez-vous pour elle.
    const { slots } = await getSlots({ serviceId, memberId: member.id, day });

    const startMinRaw = url.searchParams.get("startMin");
    const startMin = Number(startMinRaw);
    const hasTime = startMinRaw !== null && Number.isInteger(startMin);
    const exact = hasTime ? (slots.find((s) => s.startMin === startMin) ?? null) : null;
    const available = hasTime ? exact !== null : slots.length > 0;

    // Motif dicible tel quel au téléphone : la personne le répète au client.
    const reason = available
      ? null
      : slots.length === 0
        ? "Vous n'avez aucun créneau libre ce jour-là."
        : "Ce créneau est déjà pris ou hors de vos horaires.";

    return NextResponse.json({
      available,
      reason,
      durationMin: service.durationMin,
      alternatives: slots.slice(0, MAX_ALTERNATIVES).map((s) => s.label),
      slots: slots.map((s) => ({ startMin: s.startMin, label: s.label })),
    });
  } catch (error) {
    return bookingErrorResponse(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const member = await requireActiveMember();
    if (!member) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const serviceId = String(body.serviceId ?? "");
    if (!serviceId) throw new BookingError("`serviceId` requis.", 400, "MISSING_SERVICE");

    const service = await loadBookableService(serviceId);
    if (service.profileId !== member.profileId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const contact = (body.contact ?? {}) as Record<string, string>;

    const booking = await createBooking({
      serviceId,
      // Jamais depuis la requête : une coiffeuse remplit son carnet, pas celui
      // de sa collègue. `createBooking` refusera d'ailleurs si la prestation ne
      // lui est pas attribuée.
      memberId: member.id,
      day: String(body.day ?? ""),
      startMin: Number(body.startMin),
      source: "PHONE",
      // Elle vient d'avoir le client au téléphone : attendre une validation de
      // sa part n'aurait aucun sens.
      forceConfirm: true,
      contact: {
        firstName: String(contact.firstName ?? ""),
        lastName: String(contact.lastName ?? ""),
        phone: String(contact.phone ?? ""),
        email: String(contact.email ?? ""),
        note: contact.note ?? null,
      },
    });

    return NextResponse.json({ booking }, { status: 201 });
  } catch (error) {
    return bookingErrorResponse(error);
  }
}
