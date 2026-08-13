import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import Navbar from "@/components/Navbar";
import ProNav from "../../ProNav";
import BackToConfig from "../../BackToConfig";
import AdminViewBanner from "../../AdminViewBanner";
import AccessManager from "./AccessManager";
import { resolveProContext } from "@/lib/pro/access";

export const metadata = { title: "Accès et administrateurs" };
export const dynamic = "force-dynamic";

/** Comptes autorisés à administrer l'entreprise, et retrait de leur accès. */
export default async function AccesPage({
  searchParams,
}: {
  searchParams: Promise<{ etab?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/profile/espace-pro/configuration/acces");

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
          Accès et administrateurs
        </h1>
        <p className="text-sm text-outline mb-4">
          Qui peut entrer dans le back-office de {profile.name} — et à quel titre.
        </p>

        <ProNav
          current="/profile/espace-pro/configuration"
          slug={profile.slug}
          modules={context.modules}
          establishments={context.establishments}
          activeEstablishmentId={profile.id}
          canBook={context.capabilities.includes("bookings")}
        />

        {context.isPlatformAdmin && <AdminViewBanner establishmentName={profile.name} />}

        <AccessManager currentUserId={context.userId} />
      </main>
    </div>
  );
}
