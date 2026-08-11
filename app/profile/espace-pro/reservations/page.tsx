import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Navbar from "@/components/Navbar";
import ProNav from "../ProNav";
import { resolveProContext } from "@/lib/pro/access";
import ReservationsBoard, { type ProBookingRow } from "./ReservationsBoard";

export const metadata = { title: "Mes réservations" };
export const dynamic = "force-dynamic";

/**
 * Les réservations de l'établissement, demandes en attente d'abord.
 *
 * Séparé de l'agenda à dessein : l'agenda répond à « qu'est-ce que je fais
 * aujourd'hui », celui-ci à « qu'est-ce que j'ai à décider ». Une demande en
 * attente est déjà posée dans la grille horaire — elle y est indistinguable
 * d'un rendez-vous accepté, alors qu'elle attend une réponse.
 */
export default async function ReservationsPage({
  searchParams,
}: {
  searchParams: Promise<{ etab?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/profile/espace-pro/reservations");

  const { etab } = await searchParams;
  const context = await resolveProContext(undefined, etab ?? null).catch(() => null);
  if (!context) redirect("/profile/espace-pro");
  if (!context.capabilities.includes("bookings")) redirect("/profile/espace-pro/configuration");

  const profile = context.establishment;

  // On remonte trois mois : au-delà, c'est de l'historique, et l'historique se
  // consulte par recherche, pas en faisant défiler.
  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

  const bookings = await prisma.proBooking.findMany({
    where: { profileId: profile.id, startAt: { gte: since } },
    orderBy: { startAt: "asc" },
    include: { member: { select: { displayName: true, color: true } } },
  });

  const rows: ProBookingRow[] = bookings.map((b) => ({
    id: b.id,
    status: b.status,
    source: b.source,
    startAt: b.startAt.toISOString(),
    endAt: b.endAt.toISOString(),
    label: b.labelSnapshot,
    price: b.priceSnapshot,
    firstName: b.firstName,
    lastName: b.lastName,
    phone: b.phone,
    email: b.email,
    note: b.note,
    memberName: b.member?.displayName ?? null,
    memberColor: b.member?.color ?? null,
    cancelReason: b.cancelReason,
  }));

  return (
    <div className="bg-surface min-h-screen">
      <Navbar />
      <main className="pt-28 md:pt-36 pb-16 px-4 max-w-3xl mx-auto">
        <h1 className="text-2xl font-extrabold tracking-tight font-['Manrope'] mb-1">
          Mes réservations
        </h1>
        <p className="text-sm text-outline mb-4">
          Les demandes en attente d&apos;abord : le moteur garde le créneau, c&apos;est vous qui
          décidez de le tenir.
        </p>

        <ProNav
          current="/profile/espace-pro/reservations"
          slug={profile.slug}
          modules={context.modules}
          establishments={context.establishments}
          activeEstablishmentId={profile.id}
          canBook
        />

        <ReservationsBoard initial={rows} />
      </main>
    </div>
  );
}
