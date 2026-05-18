import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SERVICE_LABELS, euros, unitLabel } from "@/lib/pet/services";
import { platformFee, payoutAmount } from "@/lib/pet/stripe";
import { createBooking } from "./actions";

export const dynamic = "force-dynamic";

export default async function ReservationPage({
  params,
  searchParams,
}: {
  params: Promise<{ offeringId: string }>;
  searchParams: Promise<{ annule?: string }>;
}) {
  const { offeringId } = await params;
  const sp = await searchParams;

  const session = await auth();
  if (!session?.user?.id) redirect(`/login?callbackUrl=/pet/reservation/${offeringId}`);

  const offering = await prisma.petServiceOffering.findUnique({
    where: { id: offeringId },
    include: { proService: true },
  });
  if (!offering || !offering.isActive || !offering.proService.isPublished) notFound();

  const action = createBooking.bind(null, offeringId);
  const exampleTotal = offering.priceCents;

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      <Link href={`/pet/pro/${offering.proService.slug}`} className="text-sm text-[#2f6fb8] hover:underline">
        ← Retour au profil
      </Link>

      <h1 className="text-3xl font-extrabold font-['Manrope'] mt-3 mb-1">Réserver</h1>
      <p className="text-slate-600 mb-6">
        {SERVICE_LABELS[offering.serviceType]} avec {offering.proService.displayName} · {offering.proService.city}
      </p>

      {sp.annule && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-xl p-3 mb-4">
          Paiement annulé. Vous pouvez réessayer ci-dessous.
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-5">
        <h2 className="font-bold font-['Manrope']">{offering.title}</h2>
        <p className="text-sm text-slate-600 mt-1">{offering.description}</p>
        <div className="mt-3 font-extrabold text-[#2f6fb8] text-lg">
          {euros(offering.priceCents)} €
          <span className="text-xs font-medium text-slate-500"> / {unitLabel(offering.unit)}</span>
        </div>
      </div>

      <form action={action} className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <label className="block">
            <span className="text-sm font-medium text-slate-700 mb-1 block">Début</span>
            <input
              type="datetime-local"
              name="startDate"
              required
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#2f6fb8]"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-700 mb-1 block">Fin</span>
            <input
              type="datetime-local"
              name="endDate"
              required
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#2f6fb8]"
            />
          </label>
        </div>

        <label className="block">
          <span className="text-sm font-medium text-slate-700 mb-1 block">
            Nombre d&apos;animaux (max {offering.maxPets})
          </span>
          <input
            type="number"
            name="petCount"
            min="1"
            max={offering.maxPets}
            defaultValue="1"
            required
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#2f6fb8]"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-slate-700 mb-1 block">
            Informations sur votre animal (facultatif)
          </span>
          <textarea
            name="petInfo"
            placeholder="Race, âge, besoins particuliers, traitements…"
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#2f6fb8] min-h-[80px]"
          />
        </label>

        <div className="bg-slate-50 rounded-xl p-3 text-sm text-slate-600">
          <div className="flex justify-between">
            <span>Exemple pour 1 {unitLabel(offering.unit)} / 1 animal</span>
            <span className="font-bold">{euros(exampleTotal)} €</span>
          </div>
          <div className="flex justify-between text-xs mt-1">
            <span>dont commission plateforme (10%)</span>
            <span>{euros(platformFee(exampleTotal))} €</span>
          </div>
          <div className="flex justify-between text-xs">
            <span>reversé au pet-sitter</span>
            <span>{euros(payoutAmount(exampleTotal))} €</span>
          </div>
          <p className="text-xs text-slate-400 mt-2">
            Le montant final dépend de la durée et du nombre d&apos;animaux. Le pet-sitter est payé
            après la fin de la prestation.
          </p>
        </div>

        <button
          type="submit"
          className="w-full bg-[#2f6fb8] hover:bg-[#2560a0] text-white px-5 py-3 rounded-full font-bold text-sm transition-colors"
        >
          Payer et réserver
        </button>
        <p className="text-xs text-slate-400 text-center">Paiement sécurisé par Stripe.</p>
      </form>
    </div>
  );
}
