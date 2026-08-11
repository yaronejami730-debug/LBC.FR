import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import Navbar from "@/components/Navbar";
import ProNav from "../ProNav";
import BackToConfig from "../BackToConfig";
import SettingsForm from "./SettingsForm";
import { loadBookingPolicy } from "@/lib/booking/queries";
import { resolveProContext } from "@/lib/pro/access";

export const metadata = { title: "Paramètres de réservation" };
export const dynamic = "force-dynamic";

/** Règles de réservation de l'établissement. */
export default async function ParametresPage({
  searchParams,
}: {
  searchParams: Promise<{ etab?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/profile/espace-pro/parametres");

  const { etab } = await searchParams;
  const context = await resolveProContext(undefined, etab ?? null).catch(() => null);

  if (!context || !context.capabilities.includes("bookings")) {
    redirect("/profile/espace-pro");
  }

  // Repli sur les valeurs par défaut quand rien n'a encore été réglé — un pro
  // doit pouvoir ouvrir la réservation sans passer par cet écran.
  const policy = await loadBookingPolicy(context.establishment.id);

  return (
    <div className="bg-surface min-h-screen">
      <Navbar />
      <main className="pt-28 md:pt-36 pb-16 px-4 max-w-3xl mx-auto">
        <BackToConfig etab={etab} />
        <h1 className="text-2xl font-extrabold tracking-tight font-['Manrope'] mb-4">
          Paramètres de réservation
        </h1>
        <ProNav
          current="/profile/espace-pro/configuration"
          slug={context.establishment.slug}
          modules={context.modules}
          establishments={context.establishments}
          activeEstablishmentId={context.establishment.id}
          canBook
        />
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
    </div>
  );
}
