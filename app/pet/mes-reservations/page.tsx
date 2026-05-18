import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SERVICE_LABELS, euros } from "@/lib/pet/services";
import { submitReview } from "./actions";

export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  PENDING: { label: "Paiement en attente", cls: "bg-amber-100 text-amber-700" },
  CONFIRMED: { label: "Confirmée", cls: "bg-[#2f6fb8]/10 text-[#2f6fb8]" },
  IN_PROGRESS: { label: "En cours", cls: "bg-[#2f6fb8]/10 text-[#2f6fb8]" },
  COMPLETED: { label: "Terminée", cls: "bg-emerald-100 text-emerald-700" },
  CANCELLED: { label: "Annulée", cls: "bg-slate-100 text-slate-600" },
  REFUNDED: { label: "Remboursée", cls: "bg-slate-100 text-slate-600" },
};

export default async function MesReservationsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/pet/mes-reservations");

  const bookings = await prisma.petBooking.findMany({
    where: { clientId: session.user.id },
    orderBy: { createdAt: "desc" },
    include: {
      offering: true,
      proService: { select: { displayName: true, slug: true, city: true } },
      review: true,
    },
  });

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <h1 className="text-3xl font-extrabold font-['Manrope'] mb-6">Mes réservations</h1>

      {bookings.length === 0 ? (
        <div className="text-center py-16 text-slate-500">
          <span className="material-symbols-outlined text-slate-300" style={{ fontSize: 48 }}>pets</span>
          <p className="mt-2">Aucune réservation pour l&apos;instant.</p>
          <Link href="/pet/recherche" className="text-[#2f6fb8] hover:underline text-sm mt-2 inline-block">
            Trouver un pet-sitter
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {bookings.map((b) => {
            const st = STATUS_LABELS[b.status] ?? STATUS_LABELS.PENDING;
            return (
              <div key={b.id} className="bg-white border border-slate-200 rounded-2xl p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs uppercase tracking-wider text-slate-500 font-bold">
                      {SERVICE_LABELS[b.offering.serviceType]}
                    </div>
                    <h2 className="font-bold font-['Manrope']">{b.offering.title}</h2>
                    <Link href={`/pet/pro/${b.proService.slug}`} className="text-sm text-[#2f6fb8] hover:underline">
                      {b.proService.displayName} · {b.proService.city}
                    </Link>
                  </div>
                  <span className={`text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap ${st.cls}`}>
                    {st.label}
                  </span>
                </div>

                <div className="text-sm text-slate-600 mt-3 flex flex-wrap gap-x-6 gap-y-1">
                  <span>Du {b.startDate.toLocaleDateString("fr-FR")} au {b.endDate.toLocaleDateString("fr-FR")}</span>
                  <span>{b.petCount} animal{b.petCount > 1 ? "x" : ""}</span>
                  <span className="font-bold text-slate-800">{euros(b.totalCents)} €</span>
                </div>

                {b.status === "COMPLETED" && !b.review && (
                  <form
                    action={submitReview.bind(null, b.id)}
                    className="mt-4 border-t border-slate-100 pt-4 space-y-3"
                  >
                    <div className="text-sm font-medium text-slate-700">Laisser un avis</div>
                    <select
                      name="rating"
                      defaultValue="5"
                      className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm"
                    >
                      <option value="5">★★★★★ Excellent</option>
                      <option value="4">★★★★ Très bien</option>
                      <option value="3">★★★ Correct</option>
                      <option value="2">★★ Décevant</option>
                      <option value="1">★ Mauvais</option>
                    </select>
                    <textarea
                      name="comment"
                      placeholder="Votre expérience (facultatif)"
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm min-h-[70px]"
                    />
                    <button
                      type="submit"
                      className="bg-[#2f6fb8] hover:bg-[#2560a0] text-white px-4 py-2 rounded-full font-bold text-sm transition-colors"
                    >
                      Publier l&apos;avis
                    </button>
                  </form>
                )}

                {b.review && (
                  <div className="mt-3 border-t border-slate-100 pt-3 text-sm text-slate-600">
                    Votre avis : <span className="text-amber-400">{"★".repeat(b.review.rating)}</span>
                    {b.review.comment && <span className="ml-2 italic">“{b.review.comment}”</span>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
