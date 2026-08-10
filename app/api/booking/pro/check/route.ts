import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { ANY_MEMBER, BookingError, getSlots, loadBookableService } from "@/lib/booking/engine";
import { bookingErrorResponse } from "@/lib/booking/http";
import { instantFromLocal, isDayKey } from "@/lib/booking/time";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * « Est-ce que ce créneau est libre ? » — et sinon, que proposer.
 *
 * Écrit pour la personne qui a un client au téléphone. Elle n'a pas le temps
 * de lire une erreur technique : elle a besoin de savoir en une phrase si c'est
 * possible, et si non, quoi proposer tout de suite.
 *
 * Le moteur est **le même** que celui de la réservation en ligne
 * (`lib/booking/engine`) : horaires, pauses, absences, rendez-vous existants,
 * battement, préavis. Il n'existe pas deux vérités — sinon un jour le site
 * dirait libre là où le dashboard dit occupé.
 *
 * `?serviceId=…&day=2026-08-11&startMin=630&memberId=…`
 */

/** Alternatives proposées par praticien. Trois suffisent à relancer l'échange. */
const MAX_ALTERNATIVES_PER_MEMBER = 3;

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const serviceId = url.searchParams.get("serviceId") ?? "";
    const day = url.searchParams.get("day") ?? "";
    const startMinRaw = url.searchParams.get("startMin");
    const memberId = url.searchParams.get("memberId") || ANY_MEMBER;

    if (!serviceId) throw new BookingError("`serviceId` requis.", 400, "MISSING_SERVICE");
    if (!isDayKey(day)) throw new BookingError("`day` attendu au format YYYY-MM-DD.", 400, "INVALID_DAY");

    const service = await loadBookableService(serviceId);

    // Contrôle d'appartenance : on ne consulte pas le planning d'un autre
    // établissement en changeant un identifiant dans l'URL.
    const owns = await prisma.proProfile.findFirst({
      where: { id: service.profileId, userId: session.user.id },
      select: { id: true },
    });
    if (!owns) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const startMin = Number(startMinRaw);
    const hasTime = startMinRaw !== null && Number.isInteger(startMin);

    /**
     * Créneaux **par praticien**.
     *
     * Le mode « peu importe » du moteur fusionne les plannings et ne garde
     * qu'une personne par horaire — parfait pour un client qui veut juste une
     * heure, inutilisable ici : au téléphone, on annonce « Corinne à 11h15,
     * sinon Nathalie à 10h30 ». Il faut donc interroger chaque planning.
     */
    const eligible = await prisma.proMember.findMany({
      where: { isActive: true, services: { some: { serviceId } } },
      orderBy: { position: "asc" },
      select: { id: true, displayName: true },
    });

    const perMember = await Promise.all(
      eligible.map(async (m) => ({
        member: m,
        slots: (await getSlots({ serviceId, memberId: m.id, day })).slots,
      })),
    );

    const wanted = memberId === ANY_MEMBER ? null : memberId;
    const forWanted = wanted
      ? (perMember.find((p) => p.member.id === wanted)?.slots ?? [])
      : perMember.flatMap((p) => p.slots);

    const exact = hasTime ? forWanted.find((s) => s.startMin === startMin) ?? null : null;
    const available = hasTime ? exact !== null : forWanted.length > 0;

    // Motif en clair. Le professionnel répète cette phrase au téléphone ; elle
    // doit être dicible telle quelle.
    let reason: string | null = null;
    if (hasTime && !available) {
      // Le nom vient des créneaux du moteur ; à défaut (praticien complet ce
      // jour-là, donc absent des créneaux), on le relit en base.
      const memberName =
        eligible.find((m) => m.id === wanted)?.displayName ?? (wanted ? "Ce praticien" : "L'équipe");

      // Fenêtre convertie avec `instantFromLocal`, comme le reste du moteur.
      // Un calcul UTC maison décalait la comparaison de deux heures en été et
      // ne trouvait jamais le rendez-vous qui bloquait pourtant le créneau.
      const conflict = wanted
        ? await prisma.proBooking.findFirst({
            where: {
              memberId: wanted,
              status: { in: ["PENDING", "CONFIRMED", "IN_PROGRESS", "COMPLETED"] },
              startAt: { lt: instantFromLocal(day, startMin + service.durationMin!) },
              endAt: { gt: instantFromLocal(day, startMin) },
            },
            select: { startAt: true, endAt: true, labelSnapshot: true },
          })
        : null;

      reason = conflict
        ? `${memberName} a déjà un rendez-vous de ${hhmm(conflict.startAt)} à ${hhmm(conflict.endAt)}.`
        : `${memberName} n'est pas disponible à cette heure ce jour-là.`;
    }

    // Alternatives, regroupées par praticien : c'est ainsi qu'on les annonce
    // — « Corinne peut à 11h15, sinon Nathalie à 10h30 ».
    const alternatives = perMember
      .map(({ member, slots }) => ({
        memberId: member.id,
        memberName: member.displayName,
        slots: slots
          // On propose ce qui suit l'heure demandée : personne ne rappelle un
          // client pour lui offrir un créneau plus tôt qu'il n'a demandé.
          .filter((s) => !hasTime || s.startMin > startMin || (s.startMin === startMin && member.id !== wanted))
          .slice(0, MAX_ALTERNATIVES_PER_MEMBER)
          .map((s) => s.label),
      }))
      .filter((m) => m.slots.length > 0)
      // Le praticien demandé d'abord : c'est lui que le client voulait.
      .sort((a, b) => (a.memberId === wanted ? -1 : b.memberId === wanted ? 1 : 0));

    return NextResponse.json({
      available,
      reason,
      service: { id: service.id, label: service.label, durationMin: service.durationMin },
      requestedMember: wanted ? (eligible.find((m) => m.id === wanted)?.displayName ?? null) : null,
      ...(exact ? { slot: { startMin: exact.startMin, label: exact.label, memberId: exact.memberId, memberName: exact.memberName } } : {}),
      alternatives,
    });
  } catch (error) {
    return bookingErrorResponse(error);
  }
}

function hhmm(date: Date): string {
  return new Intl.DateTimeFormat("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Paris",
  }).format(date);
}
