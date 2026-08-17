import type { Metadata } from "next";
import AdSlot from "@/components/ads/AdSlot";
import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Navbar from "@/components/Navbar";
import { membershipsOf } from "@/lib/pro/memberships";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Mon agenda — Deal&Co",
  robots: { index: false, follow: false },
};

/** Créneaux libérés : ils ne sont plus du travail à faire. */
const OCCUPYING = ["PENDING", "CONFIRMED", "IN_PROGRESS", "COMPLETED"];

const DAY_FMT = new Intl.DateTimeFormat("fr-FR", {
  weekday: "long",
  day: "numeric",
  month: "long",
});
const TIME_FMT = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" });

/**
 * Planning de travail dans l'espace personnel.
 *
 * Corinne a un compte Deal&Co comme tout le monde — pour vendre son vélo — et
 * elle est par ailleurs coiffeuse chez Joana. Cette page est la seconde
 * casquette : ses rendez-vous de salon, dans son espace à elle.
 *
 * Elle ne donne aucun droit sur la fiche du salon : ni tarifs, ni équipe, ni
 * réglages. Uniquement les rendez-vous qui lui sont attribués — et si le salon
 * lui retire son accès, la page cesse d'exister d'elle-même, puisque tout est
 * recalculé à chaque affichage.
 *
 * Travailler dans deux boutiques donne un seul agenda, avec le lieu sur chaque
 * ligne : une journée de travail se lit dans l'ordre des heures, pas boutique
 * par boutique.
 */
export default async function MonAgendaPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/mon-agenda");

  const memberships = await membershipsOf(session.user.id);
  if (memberships.length === 0) {
    return (
      <div className="bg-surface min-h-screen">
        <Navbar />
        <main className="pt-28 md:pt-36 pb-16 px-4 max-w-2xl mx-auto">
          <div className="bg-white rounded-2xl border border-slate-100 p-8 text-center">
            <span className="material-symbols-outlined text-[32px] text-outline">badge</span>
            <h1 className="mt-2 text-xl font-extrabold font-['Manrope']">Aucun agenda professionnel</h1>
            <p className="mt-2 text-sm text-outline leading-relaxed">
              Cette page s&apos;affiche quand un établissement vous a inscrit·e dans son équipe.
              Si vous y aviez accès et qu&apos;il a disparu, c&apos;est que l&apos;établissement a
              retiré votre accès — vos rendez-vous passés restent chez lui.
            </p>
            <Link
              href="/profile"
              title="Retour au profil"
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-white"
            >
              Retour à mon profil
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const bookings = await prisma.proBooking.findMany({
    where: {
      memberId: { in: memberships.map((m) => m.memberId) },
      status: { in: OCCUPYING },
      endAt: { gte: new Date() },
    },
    orderBy: { startAt: "asc" },
    take: 100,
    select: {
      id: true,
      startAt: true,
      endAt: true,
      firstName: true,
      lastName: true,
      phone: true,
      note: true,
      labelSnapshot: true,
      durationSnapshot: true,
      status: true,
      profile: { select: { id: true, name: true, city: true } },
    },
  });

  // Le lieu n'est utile que s'il y en a plusieurs : sinon il se répète à
  // chaque ligne pour ne rien apprendre.
  const multiSite = memberships.length > 1;

  const byDay = bookings.reduce<Record<string, typeof bookings>>((acc, b) => {
    (acc[b.startAt.toISOString().slice(0, 10)] ??= []).push(b);
    return acc;
  }, {});

  return (
    <div className="bg-surface min-h-screen">
      <Navbar />
      <main className="pt-28 md:pt-36 pb-16 px-4 max-w-2xl mx-auto space-y-5">
        <header>
          <h1 className="text-2xl font-extrabold tracking-tight font-['Manrope']">Mon agenda</h1>
          <p className="mt-1 text-sm text-outline">
            Vos rendez-vous {multiSite ? "dans les établissements où vous travaillez" : "au travail"}.
          </p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {memberships.map((m) => (
              <li
                key={m.memberId}
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-on-surface-variant"
              >
                <span className="material-symbols-outlined text-[16px] text-primary">storefront</span>
                {m.establishmentName}
                {m.role ? <span className="font-medium text-outline">· {m.role}</span> : null}
              </li>
            ))}
          </ul>
        </header>

        {bookings.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-100 p-8 text-center">
            <span className="material-symbols-outlined text-[32px] text-outline">event_busy</span>
            <p className="mt-2 font-bold">Aucun rendez-vous à venir</p>
            <p className="text-sm text-outline mt-1">
              Les réservations qui vous sont attribuées apparaîtront ici.
            </p>
          </div>
        ) : (
          Object.entries(byDay).map(([day, items]) => (
            <section key={day}>
              <h2 className="text-[11px] font-bold uppercase tracking-[0.12em] text-primary mb-2 capitalize">
                {DAY_FMT.format(new Date(day))}
              </h2>
              <div className="bg-white rounded-2xl border border-slate-100 divide-y divide-slate-100 overflow-hidden">
                {items.map((b) => (
                  <div key={b.id} className="p-4">
                    <div className="flex items-baseline gap-3">
                      <span className="text-lg font-extrabold tabular-nums">
                        {TIME_FMT.format(b.startAt)}
                      </span>
                      <span className="text-xs text-outline tabular-nums">
                        → {TIME_FMT.format(b.endAt)} · {b.durationSnapshot} min
                      </span>
                    </div>

                    {multiSite && (
                      <p className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-surface-container-low px-2.5 py-0.5 text-[11px] font-bold text-on-surface-variant">
                        <span className="material-symbols-outlined text-[14px]">storefront</span>
                        {b.profile.name}
                        {b.profile.city ? ` · ${b.profile.city}` : ""}
                      </p>
                    )}

                    <p className="mt-1.5 font-bold">{b.labelSnapshot}</p>
                    <p className="text-sm text-on-surface-variant">
                      {b.firstName} {b.lastName}
                      {" · "}
                      <a href={`tel:${b.phone}`} className="font-semibold text-primary">
                        {b.phone}
                      </a>
                    </p>
                    {b.note && (
                      <p className="mt-1.5 text-xs italic text-outline bg-surface-container-low rounded-lg px-3 py-2">
                        {b.note}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          ))
        )}

        {/* Le planning d'une salariée : même emplacement que l'agenda du
            gérant, même audience professionnelle. */}
        <AdSlot placement="PRO_AGENDA" className="mt-8" />
      </main>
    </div>
  );
}
