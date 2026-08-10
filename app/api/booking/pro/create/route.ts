import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { createBooking } from "@/lib/booking/book";
import { BookingError, loadBookableService } from "@/lib/booking/engine";
import { bookingErrorResponse } from "@/lib/booking/http";

export const runtime = "nodejs";

/**
 * Rendez-vous saisi par le professionnel — typiquement pendant un appel.
 *
 * Passe par `createBooking`, exactement comme une réservation en ligne. Il n'y
 * a donc rien à réconcilier : mêmes horaires, mêmes pauses, mêmes absences,
 * même battement, et surtout la même contrainte d'exclusion PostgreSQL qui
 * empêche deux rendez-vous de se chevaucher — y compris quand un client
 * réserve en ligne au moment précis où la coiffeuse saisit l'appel.
 *
 * Deux différences, et deux seulement :
 *   — le rendez-vous est confirmé d'emblée : le professionnel vient de parler
 *     au client, attendre sa propre validation n'aurait aucun sens ;
 *   — l'email est facultatif : au téléphone, on ne le demande pas toujours.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const serviceId = String(body.serviceId ?? "");
    if (!serviceId) throw new BookingError("`serviceId` requis.", 400, "MISSING_SERVICE");

    const service = await loadBookableService(serviceId);
    const owns = await prisma.proProfile.findFirst({
      where: { id: service.profileId, userId: session.user.id },
      select: { id: true },
    });
    if (!owns) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const source = body.source === "MANUAL" ? "MANUAL" : "PHONE";
    const contact = (body.contact ?? {}) as Record<string, string>;

    const booking = await createBooking({
      serviceId,
      memberId: String(body.memberId ?? "any"),
      day: String(body.day ?? ""),
      startMin: Number(body.startMin),
      source,
      forceConfirm: true,
      contact: {
        firstName: String(contact.firstName ?? ""),
        lastName: String(contact.lastName ?? ""),
        phone: String(contact.phone ?? ""),
        email: String(contact.email ?? ""),
        note: contact.note ?? null,
      },
      // Rattachement au compte client s'il en a un : le rendez-vous apparaît
      // alors dans son espace, même s'il a téléphoné.
      customerId: typeof body.customerId === "string" ? body.customerId : null,
    });

    return NextResponse.json({ booking }, { status: 201 });
  } catch (error) {
    return bookingErrorResponse(error);
  }
}

/**
 * Recherche d'un client déjà venu, par téléphone.
 *
 * Un salon rappelle rarement un inconnu : la personne au bout du fil est très
 * souvent déjà passée. Retrouver sa fiche évite de la faire épeler son nom une
 * deuxième fois, et évite surtout de créer un doublon.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const phone = (new URL(req.url).searchParams.get("phone") ?? "").replace(/\D/g, "");
  if (phone.length < 6) return NextResponse.json({ customers: [] });

  // On ne cherche que dans les rendez-vous de ses propres établissements : le
  // carnet d'adresses d'un salon n'est pas celui du voisin.
  const rows = await prisma.proBooking.findMany({
    where: {
      profile: { userId: session.user.id },
      phone: { contains: phone.slice(-9) },
    },
    orderBy: { startAt: "desc" },
    take: 20,
    select: { firstName: true, lastName: true, phone: true, email: true, customerId: true },
  });

  // Dédoublonnage par téléphone : dix passages ne font qu'un client.
  const seen = new Set<string>();
  const customers = rows.filter((r) => {
    const key = r.phone.replace(/\D/g, "");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return NextResponse.json({ customers });
}
