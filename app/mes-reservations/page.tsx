import { redirect } from "next/navigation";
import AdSlot from "@/components/ads/AdSlot";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Navbar from "@/components/Navbar";
import { dayKey, formatMinutes, minutesOfDay } from "@/lib/booking/time";
import CancelBookingButton from "./CancelBookingButton";
import { loadBookingPolicy } from "@/lib/booking/queries";
import { buildPrivateMetadata } from "@/lib/seo/metadata";

/**
 * Espace personnel : rendez-vous du compte connecté.
 *
 * `noindex` explicite. La page redirige déjà les visiteurs anonymes, mais une
 * redirection n'est pas une directive d'indexation : l'URL circulait dans les
 * partages et les référents, et rien n'interdisait à Google de la retenir.
 */
export const metadata = buildPrivateMetadata(
  "Mes réservations",
  "Vos rendez-vous à venir et passés chez les professionnels Deal&Co.",
);
export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  PENDING: "À confirmer",
  CONFIRMED: "Confirmé",
  IN_PROGRESS: "En cours",
  COMPLETED: "Terminé",
  CANCELLED: "Annulé",
  NO_SHOW: "Absent",
};

/**
 * Rendez-vous du client connecté.
 *
 * Les réservations prises sans compte n'apparaissent pas : elles n'ont pas de
 * `customerId`, et les rattacher par email laisserait lire l'agenda d'un
 * homonyme à qui changerait son adresse.
 */
export default async function MesReservationsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/mes-reservations");

  const now = new Date();
  const bookings = await prisma.proBooking.findMany({
    where: { customerId: session.user.id },
    orderBy: { startAt: "desc" },
    take: 60,
    include: {
      member: { select: { displayName: true } },
      profile: { select: { name: true, slug: true, city: true, addressLine: true, postalCode: true, phone: true } },
    },
  });

  const upcoming = bookings.filter((b) => b.startAt >= now).reverse();
  const past = bookings.filter((b) => b.startAt < now);

  // Le délai d'annulation dépend de l'établissement : on le charge par fiche
  // concernée plutôt que d'afficher un bouton qui échouerait au clic.
  const policies = new Map<string, Awaited<ReturnType<typeof loadBookingPolicy>>>();
  for (const id of new Set(upcoming.map((b) => b.profileId))) {
    policies.set(id, await loadBookingPolicy(id));
  }

  return (
    <div className="bg-surface min-h-screen">
      <Navbar />
      <main className="pt-28 md:pt-36 pb-16 px-4 max-w-2xl mx-auto space-y-6">
        <h1 className="text-2xl font-extrabold tracking-tight font-['Manrope']">Mes réservations</h1>

        <section>
          <h2 className="text-sm font-bold uppercase tracking-wider text-outline mb-3">À venir</h2>
          {upcoming.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-100 p-6 text-sm text-outline">
              Aucun rendez-vous à venir.
            </div>
          ) : (
            <ul className="space-y-3">
              {upcoming.map((b) => {
                const policy = policies.get(b.profileId);
                const minutesUntil = (b.startAt.getTime() - now.getTime()) / 60_000;
                const cancellable =
                  b.status !== "CANCELLED" &&
                  b.status !== "NO_SHOW" &&
                  !!policy?.allowCancel &&
                  minutesUntil >= (policy?.cancelDeadlineMin ?? 0);

                return (
                  <li key={b.id} className="bg-white rounded-2xl border border-slate-100 p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <Link
                          href={`/pro/${b.profile.slug}`}
                          title={b.profile.name}
                          className="font-extrabold hover:text-primary"
                        >
                          {b.profile.name}
                        </Link>
                        <p className="text-sm mt-1">
                          {b.labelSnapshot} · {b.durationSnapshot} min
                          {b.member && ` · ${b.member.displayName}`}
                        </p>
                        <p className="text-sm text-outline capitalize mt-0.5">
                          {formatDay(dayKey(b.startAt))} à {formatMinutes(minutesOfDay(b.startAt))}
                        </p>
                        {(b.profile.addressLine || b.profile.city) && (
                          <p className="text-xs text-outline mt-1">
                            {[b.profile.addressLine, b.profile.postalCode, b.profile.city].filter(Boolean).join(", ")}
                          </p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <span className="font-extrabold text-primary block">
                          {b.priceSnapshot.toLocaleString("fr-FR")} €
                        </span>
                        <span className="text-[10px] font-bold uppercase tracking-wide text-outline">
                          {STATUS_LABEL[b.status] ?? b.status}
                        </span>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      {cancellable && <CancelBookingButton bookingId={b.id} />}
                      {b.profile.phone && (
                        <a
                          href={`tel:${b.profile.phone}`}
                          title={`Appeler ${b.profile.name}`}
                          className="rounded-full border border-slate-200 px-4 py-2 text-xs font-bold text-on-surface-variant hover:border-primary hover:text-primary"
                        >
                          Appeler
                        </a>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {past.length > 0 && (
          <section>
            <h2 className="text-sm font-bold uppercase tracking-wider text-outline mb-3">Historique</h2>
            <ul className="bg-white rounded-2xl border border-slate-100 divide-y divide-slate-100">
              {past.map((b) => (
                <li key={b.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                  <span className="min-w-0">
                    <span className="font-semibold block truncate">{b.profile.name}</span>
                    <span className="text-xs text-outline capitalize">
                      {formatDay(dayKey(b.startAt))} · {b.labelSnapshot}
                    </span>
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-wide text-outline shrink-0">
                    {STATUS_LABEL[b.status] ?? b.status}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <AdSlot placement="BOOKINGS" className="mt-8" />
      </main>
    </div>
  );
}

function formatDay(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, d, 12)));
}
