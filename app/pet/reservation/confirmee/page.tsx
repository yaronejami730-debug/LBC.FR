import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SERVICE_LABELS, euros } from "@/lib/pet/services";

export const dynamic = "force-dynamic";

export default async function ReservationConfirmeePage({
  searchParams,
}: {
  searchParams: Promise<{ booking?: string }>;
}) {
  const sp = await searchParams;
  const bookingId = sp.booking;
  if (!bookingId) notFound();

  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const booking = await prisma.petBooking.findUnique({
    where: { id: bookingId },
    include: {
      offering: true,
      proService: { select: { displayName: true, slug: true, city: true } },
      payment: true,
    },
  });
  if (!booking || booking.clientId !== session.user.id) notFound();

  const paid = booking.payment?.status === "SUCCEEDED" || booking.status !== "PENDING";

  return (
    <div className="max-w-xl mx-auto px-6 py-12 text-center">
      <span
        className={`material-symbols-outlined ${paid ? "text-emerald-500" : "text-amber-500"}`}
        style={{ fontSize: 64 }}
      >
        {paid ? "check_circle" : "schedule"}
      </span>
      <h1 className="text-2xl font-extrabold font-['Manrope'] mt-3">
        {paid ? "Réservation confirmée !" : "Paiement en cours de validation"}
      </h1>
      <p className="text-slate-600 mt-2">
        {paid
          ? `Votre réservation avec ${booking.proService.displayName} est confirmée.`
          : "Le paiement est en cours de traitement. Cette page se mettra à jour sous peu."}
      </p>

      <div className="bg-white border border-slate-200 rounded-2xl p-5 mt-6 text-left text-sm">
        <Row label="Prestation" value={`${SERVICE_LABELS[booking.offering.serviceType]} — ${booking.offering.title}`} />
        <Row label="Pet-sitter" value={`${booking.proService.displayName} · ${booking.proService.city}`} />
        <Row label="Du" value={booking.startDate.toLocaleString("fr-FR")} />
        <Row label="Au" value={booking.endDate.toLocaleString("fr-FR")} />
        <Row label="Animaux" value={String(booking.petCount)} />
        <Row label="Total payé" value={`${euros(booking.totalCents)} €`} />
      </div>

      <div className="flex gap-3 justify-center mt-6">
        <Link
          href={`/pet/pro/${booking.proService.slug}`}
          className="px-5 py-2.5 rounded-full border border-slate-300 text-slate-700 font-semibold text-sm hover:bg-slate-50 transition-colors"
        >
          Voir le pet-sitter
        </Link>
        <Link
          href="/pet/mes-reservations"
          className="px-5 py-2.5 rounded-full bg-[#2f6fb8] hover:bg-[#2560a0] text-white font-bold text-sm transition-colors"
        >
          Mes réservations
        </Link>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-1.5 border-b border-slate-100 last:border-0">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-slate-800 text-right">{value}</span>
    </div>
  );
}
