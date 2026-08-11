import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import Navbar from "@/components/Navbar";
import ProNav from "../../ProNav";
import BackToConfig from "../../BackToConfig";
import OpeningHoursForm from "./OpeningHoursForm";
import { resolveProContext } from "@/lib/pro/access";

export const metadata = { title: "Horaires d'ouverture" };
export const dynamic = "force-dynamic";

/** Horaires affichés sur la fiche publique, jour par jour. */
export default async function HorairesPage({
  searchParams,
}: {
  searchParams: Promise<{ etab?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/profile/espace-pro/configuration/horaires");
  }

  const { etab } = await searchParams;
  const context = await resolveProContext(undefined, etab ?? null).catch(() => null);
  if (!context) redirect("/profile/espace-pro");

  const profile = context.establishment;

  return (
    <div className="bg-surface min-h-screen">
      <Navbar />
      <main className="pt-28 md:pt-36 pb-16 px-4 max-w-3xl mx-auto">
        <BackToConfig etab={etab} />
        <h1 className="text-2xl font-extrabold tracking-tight font-['Manrope'] mb-1">
          Horaires d&apos;ouverture
        </h1>
        <p className="text-sm text-outline mb-4">
          Affichés sur la fiche publique de {profile.name}. Les créneaux réservables, eux, viennent
          des plannings de chaque membre de l&apos;équipe.
        </p>

        <ProNav
          current="/profile/espace-pro/configuration"
          slug={profile.slug}
          modules={context.modules}
          establishments={context.establishments}
          activeEstablishmentId={profile.id}
          canBook={context.capabilities.includes("bookings")}
        />

        <OpeningHoursForm initial={parseHours(profile.hours)} establishmentId={profile.id} />
      </main>
    </div>
  );
}

function parseHours(raw: string): Record<string, string> {
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, string>) : {};
  } catch {
    return {};
  }
}
