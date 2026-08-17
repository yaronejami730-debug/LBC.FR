import { redirect } from "next/navigation";
import AdSlot from "@/components/ads/AdSlot";
import { auth } from "@/lib/auth";
import Navbar from "@/components/Navbar";
import ProNav from "../ProNav";
import AgendaBoard from "./AgendaBoard";
import { dayKey } from "@/lib/booking/time";
import { resolveProContext } from "@/lib/pro/access";

export const metadata = { title: "Agenda" };
export const dynamic = "force-dynamic";

/** Agenda de l'établissement : rendez-vous du jour et de la semaine. */
export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ etab?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/profile/espace-pro/agenda");

  const { etab } = await searchParams;
  const context = await resolveProContext(undefined, etab ?? null).catch(() => null);

  if (!context) redirect("/profile/espace-pro");

  // Un établissement sans réservation n'a pas d'agenda — mais le renvoyer sur
  // sa fiche ne lui apprend rien : il a cliqué « Agenda » et il retombe sur
  // autre chose sans explication. On l'envoie là où la réservation s'active,
  // c'est-à-dire là où le problème se règle.
  if (!context.capabilities.includes("bookings")) {
    redirect("/profile/espace-pro/configuration?activer=bookings");
  }

  return (
    <div className="bg-surface min-h-screen">
      <Navbar />
      <main className="pt-28 md:pt-36 pb-16 px-4 max-w-3xl mx-auto">
        <h1 className="text-2xl font-extrabold tracking-tight font-['Manrope'] mb-4">Agenda</h1>
        <ProNav
          current="/profile/espace-pro/agenda"
          slug={context.establishment.slug}
          modules={context.modules}
          establishments={context.establishments}
          activeEstablishmentId={context.establishment.id}
          canBook
        />
        {/* Le « aujourd'hui » est celui de Paris, calculé côté serveur : le
            navigateur d'un client à l'étranger ne doit pas décaler l'agenda. */}
        <AgendaBoard initialDay={dayKey(new Date())} />

        <AdSlot placement="PRO_AGENDA" className="mt-8" />
      </main>
    </div>
  );
}
