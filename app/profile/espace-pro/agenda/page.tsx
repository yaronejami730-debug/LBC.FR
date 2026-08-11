import { redirect } from "next/navigation";
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

  // Un établissement sans réservation n'a pas d'agenda. On renvoie sur la
  // fiche plutôt que d'afficher un calendrier qui ne se remplira jamais.
  if (!context || !context.capabilities.includes("bookings")) {
    redirect("/profile/espace-pro");
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
      </main>
    </div>
  );
}
