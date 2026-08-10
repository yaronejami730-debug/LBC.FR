import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Navbar from "@/components/Navbar";
import BottomNav from "@/components/BottomNav";
import ProNav from "../ProNav";
import SettingsForm from "./SettingsForm";
import { loadBookingPolicy } from "@/lib/booking/queries";

export const metadata = { title: "Paramètres de réservation" };
export const dynamic = "force-dynamic";

/** Règles de réservation de l'établissement. */
export default async function ParametresPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/profile/espace-pro/parametres");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      professionalStatus: true,
      proProfiles: { take: 1, orderBy: { createdAt: "asc" }, select: { id: true, slug: true } },
    },
  });

  const establishment = user?.proProfiles[0] ?? null;
  if (user?.professionalStatus !== "APPROVED" || !establishment) {
    redirect("/profile/espace-pro");
  }

  // Repli sur les valeurs par défaut quand rien n'a encore été réglé — un pro
  // doit pouvoir ouvrir la réservation sans passer par cet écran.
  const policy = await loadBookingPolicy(establishment.id);

  return (
    <div className="bg-surface min-h-screen mb-24 md:mb-0">
      <Navbar />
      <main className="pt-28 md:pt-36 pb-16 px-4 max-w-3xl mx-auto">
        <h1 className="text-2xl font-extrabold tracking-tight font-['Manrope'] mb-4">
          Paramètres de réservation
        </h1>
        <ProNav current="/profile/espace-pro/parametres" slug={establishment.slug} />
        <SettingsForm
          initial={{
            slotGranularityMin: policy.slotGranularityMin,
            bufferMin: policy.bufferMin,
            minNoticeMin: policy.minNoticeMin,
            maxAdvanceDays: policy.maxAdvanceDays,
            cancelDeadlineMin: policy.cancelDeadlineMin,
            autoConfirm: policy.autoConfirm,
            allowCancel: policy.allowCancel,
            allowReschedule: policy.allowReschedule,
          }}
        />
      </main>
      <BottomNav />
    </div>
  );
}
