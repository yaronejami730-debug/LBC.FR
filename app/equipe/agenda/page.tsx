import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getMemberSession } from "@/lib/pro-member-auth";
import MemberAgendaHeader from "./MemberAgendaHeader";
import MemberNewBooking from "./MemberNewBooking";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Mon planning — Deal&Co",
  robots: { index: false, follow: false },
};

/** Créneaux libérés : ils ne doivent plus apparaître comme du travail à faire. */
const OCCUPYING = ["PENDING", "CONFIRMED", "IN_PROGRESS", "COMPLETED"];

const DAY_FMT = new Intl.DateTimeFormat("fr-FR", {
  weekday: "long",
  day: "numeric",
  month: "long",
});
const TIME_FMT = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" });

const STATUS_LABEL: Record<string, { label: string; tone: string }> = {
  PENDING: { label: "À confirmer", tone: "text-amber-700 bg-amber-50" },
  CONFIRMED: { label: "Confirmé", tone: "text-emerald-700 bg-emerald-50" },
  IN_PROGRESS: { label: "En cours", tone: "text-[#2f6fb8] bg-[#f5f9ff]" },
  COMPLETED: { label: "Terminé", tone: "text-[#464652] bg-[#f2f4f6]" },
};

/**
 * Planning personnel d'un membre d'équipe.
 *
 * Il ne voit que ce qui lui est attribué — pas l'agenda du salon. Une coiffeuse
 * n'a pas à connaître le carnet de sa collègue, et la responsable garde la vue
 * d'ensemble dans son espace professionnel.
 *
 * Rendez-vous à venir uniquement : le passé encombrerait l'écran qu'on consulte
 * entre deux clients.
 */
export default async function MemberAgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ nouveau?: string }>;
}) {
  const { nouveau } = await searchParams;
  const session = await getMemberSession();
  if (!session) redirect("/equipe/connexion");

  const member = await prisma.proMember.findUnique({
    where: { id: session.memberId },
    select: {
      id: true,
      displayName: true,
      role: true,
      avatar: true,
      isActive: true,
      accessRevokedAt: true,
      mustChangePassword: true,
      profile: {
        select: {
          name: true,
          city: true,
          user: { select: { bannedAt: true, professionalStatus: true } },
        },
      },
    },
  });

  // Accès retiré depuis l'émission du cookie : le jeton est signé pour 12 h, la
  // révocation doit prendre effet immédiatement, pas à son expiration.
  if (
    !member ||
    !member.isActive ||
    member.accessRevokedAt ||
    member.profile.user.bannedAt ||
    member.profile.user.professionalStatus !== "APPROVED"
  ) {
    redirect("/equipe/connexion");
  }

  const bookings = await prisma.proBooking.findMany({
    where: {
      memberId: member.id,
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
      priceSnapshot: true,
      status: true,
    },
  });

  // Regroupement par jour : c'est ainsi qu'on lit un planning, pas en liste plate.
  const byDay = bookings.reduce<Record<string, typeof bookings>>((acc, b) => {
    const key = b.startAt.toISOString().slice(0, 10);
    (acc[key] ??= []).push(b);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-surface text-on-surface">
      <MemberAgendaHeader
        displayName={member.displayName}
        role={member.role}
        salon={member.profile.name}
        avatar={member.avatar}
        mustChangePassword={member.mustChangePassword || nouveau === "1"}
      />

      <main className="px-4 pb-16 max-w-2xl mx-auto space-y-5">
        {/* En tête de page : un appel arrive pendant qu'on regarde son planning,
            pas après l'avoir parcouru jusqu'en bas. */}
        <MemberNewBooking />

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
              <h2 className="text-[11px] font-bold uppercase tracking-[0.12em] text-primary mb-2">
                {DAY_FMT.format(new Date(day))}
              </h2>
              <div className="bg-white rounded-2xl border border-slate-100 divide-y divide-slate-100 overflow-hidden">
                {items.map((b) => {
                  const status = STATUS_LABEL[b.status] ?? { label: b.status, tone: "text-[#464652] bg-[#f2f4f6]" };
                  return (
                    <div key={b.id} className="p-4">
                      <div className="flex items-baseline gap-3">
                        <span className="text-lg font-extrabold tabular-nums">
                          {TIME_FMT.format(b.startAt)}
                        </span>
                        <span className="text-xs text-outline tabular-nums">
                          → {TIME_FMT.format(b.endAt)} · {b.durationSnapshot} min
                        </span>
                        <span className="flex-1" />
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${status.tone}`}>
                          {status.label}
                        </span>
                      </div>

                      <p className="mt-1.5 font-bold">{b.labelSnapshot}</p>
                      <p className="text-sm text-on-surface-variant">
                        {b.firstName} {b.lastName}
                        {" · "}
                        {/* Le téléphone est cliquable : un retard se règle par un
                            appel, pas par une recherche dans le carnet. */}
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
                  );
                })}
              </div>
            </section>
          ))
        )}

        {/* Passerelle vers un compte personnel.
            Le membre est ici pour son travail ; ce bloc ne parle donc pas du
            salon mais de lui. Placé en bas, après le planning : on ne coupe pas
            quelqu'un qui cherche son prochain rendez-vous. */}
        <section className="rounded-2xl bg-gradient-to-br from-primary to-[#1a5a9e] p-6 text-white">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-white/70">
            Pour vous, en dehors du travail
          </p>
          <h2 className="mt-1.5 text-xl font-extrabold font-['Manrope'] leading-tight">
            Découvrez Deal&amp;Co
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-white/90">
            Le site de petites annonces entre particuliers et professionnels. Vendez ce dont vous
            ne vous servez plus, trouvez près de chez vous — gratuitement, sans commission.
          </p>
          <p className="mt-2 text-xs text-white/70 leading-relaxed">
            Un compte personnel, indépendant de {member.profile.name}. Votre employeur n&apos;y a
            pas accès.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href="/register"
              title="Créer mon compte personnel Deal&Co"
              className="rounded-full bg-white px-5 py-2.5 text-sm font-bold text-primary"
            >
              Créer mon compte personnel
            </Link>
            <Link
              href="/"
              title="Voir les annonces"
              className="rounded-full border border-white/40 px-5 py-2.5 text-sm font-bold text-white"
            >
              Voir les annonces
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
