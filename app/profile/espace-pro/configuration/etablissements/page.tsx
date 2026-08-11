import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import Navbar from "@/components/Navbar";
import ProNav from "../../ProNav";
import BackToConfig from "../../BackToConfig";
import EstablishmentsManager from "./EstablishmentsManager";
import { canManageEstablishments, resolveProContext } from "@/lib/pro/access";

export const metadata = { title: "Mes établissements" };
export const dynamic = "force-dynamic";

/** Liste et création des points de vente de l'entreprise. */
export default async function EtablissementsPage({
  searchParams,
}: {
  searchParams: Promise<{ etab?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/profile/espace-pro/configuration/etablissements");
  }

  const { etab } = await searchParams;
  const context = await resolveProContext(undefined, etab ?? null).catch(() => null);
  if (!context) redirect("/profile/espace-pro");

  // Ouvrir ou fermer une boutique engage l'entreprise : un MANAGER tient un
  // agenda, il n'ouvre pas de point de vente.
  if (!canManageEstablishments(context.role)) redirect("/profile/espace-pro/configuration");

  const profile = context.establishment;

  return (
    <div className="bg-surface min-h-screen">
      <Navbar />
      <main className="pt-28 md:pt-36 pb-16 px-4 max-w-3xl mx-auto">
        <BackToConfig etab={etab} />
        <h1 className="text-2xl font-extrabold tracking-tight font-['Manrope'] mb-4">
          Mes établissements
        </h1>

        <ProNav
          current="/profile/espace-pro/configuration"
          slug={profile.slug}
          modules={context.modules}
          establishments={context.establishments}
          activeEstablishmentId={profile.id}
          canBook={context.capabilities.includes("bookings")}
        />

        <EstablishmentsManager
          activeId={profile.id}
          establishments={context.establishments.map((e) => ({
            id: e.id,
            name: e.name,
            city: e.city,
            slug: e.slug,
            isPublished: e.isPublished,
          }))}
        />
      </main>
    </div>
  );
}
