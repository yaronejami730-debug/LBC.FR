import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Sidebar from "@/components/admin/Sidebar";
import AdminMobileHeader from "@/components/admin/AdminMobileHeader";
import { headers } from "next/headers";
import { canAccess, staffAccess } from "@/lib/admin/staff";
import { sectionForPath } from "@/lib/admin/sections";

/**
 * `robots` explicite plutôt qu'hérité.
 *
 * Ces écrans héritaient du `robots: { index: true }` du layout racine. En
 * pratique ils sont hors de portée — `robots.txt` ferme `/admin` et le
 * middleware redirige tout non-administrateur — mais l'héritage voulait dire
 * qu'aucune de ces trois barrières n'était l'indexation elle-même. On l'écrit.
 */
export const metadata = {
  title: "Administration — Deal & Co",
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const role = (session?.user as any)?.role;

  if (!session?.user || role !== "ADMIN") redirect("/admin/login");

  const adminName = session.user.name ?? "Admin";

  /**
   * Ce que ce compte a le droit d'ouvrir.
   *
   * `role === "ADMIN"` dit qu'on entre ; l'équipe dit ce qu'on y fait. Un
   * administrateur sans équipe garde l'accès complet — sinon la première mise
   * en service aurait fermé l'administration à tout le monde.
   */
  const access = await staffAccess(session.user.id as string);
  const teamLabel = access.implicit
    ? undefined
    : access.teams.map((t) => t.label).join(" · ") || "Sans équipe";

  /**
   * Le droit se vérifie ici, pas seulement dans la barre latérale.
   *
   * Masquer un lien n'a jamais fermé une porte : l'adresse reste tapable. Le
   * chapitre de la page demandée est comparé aux droits effectifs, et un
   * chapitre non accordé renvoie au tableau de bord.
   */
  const requested = sectionForPath((await headers()).get("x-pathname") ?? "");
  if (requested && !canAccess(access, requested.key) && requested.key !== "vue") {
    redirect("/admin");
  }

  return (
    <div className="min-h-screen bg-[#f7f9fb]">
      {/* Desktop Sidebar */}
      <div className="hidden lg:block">
        <Sidebar adminName={adminName} sections={access.sections} teamLabel={teamLabel} />
      </div>

      {/* Mobile Top Bar */}
      <AdminMobileHeader adminName={adminName} sections={access.sections} teamLabel={teamLabel} />

      {/* Main Content */}
      <div className="lg:ml-64 min-h-screen flex flex-col transition-all duration-300">
        <main className="flex-1 p-4 sm:p-6 lg:p-8 pt-20 lg:pt-8">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
