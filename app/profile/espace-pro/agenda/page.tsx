import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Navbar from "@/components/Navbar";
import BottomNav from "@/components/BottomNav";
import ProNav from "../ProNav";
import AgendaBoard from "./AgendaBoard";
import { dayKey } from "@/lib/booking/time";

export const metadata = { title: "Agenda" };
export const dynamic = "force-dynamic";

/** Agenda de l'établissement : rendez-vous du jour et de la semaine. */
export default async function AgendaPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/profile/espace-pro/agenda");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { professionalStatus: true, proProfiles: {
        // Un seul établissement pour l'instant : la sélection multi-boutique
        // n'existe pas encore côté interface.
        take: 1,
        orderBy: { createdAt: "asc" }, select: { slug: true } } },
  });

  if (user?.professionalStatus !== "APPROVED" || !user.proProfiles[0]) {
    redirect("/profile/espace-pro");
  }

  return (
    <div className="bg-surface min-h-screen mb-24 md:mb-0">
      <Navbar />
      <main className="pt-28 md:pt-36 pb-16 px-4 max-w-3xl mx-auto">
        <h1 className="text-2xl font-extrabold tracking-tight font-['Manrope'] mb-4">Agenda</h1>
        <ProNav current="/profile/espace-pro/agenda" slug={user.proProfiles[0].slug} />
        {/* Le « aujourd'hui » est celui de Paris, calculé côté serveur : le
            navigateur d'un client à l'étranger ne doit pas décaler l'agenda. */}
        <AgendaBoard initialDay={dayKey(new Date())} />
      </main>
      <BottomNav />
    </div>
  );
}
