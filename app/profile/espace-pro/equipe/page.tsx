import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Navbar from "@/components/Navbar";
import BottomNav from "@/components/BottomNav";
import ProNav from "../ProNav";
import TeamManager from "./TeamManager";

export const metadata = { title: "Équipe et horaires" };
export const dynamic = "force-dynamic";

/**
 * Équipe, compétences, horaires, pauses et absences.
 *
 * C'est l'écran qui alimente le moteur de créneaux : tant qu'il est vide,
 * la page publique n'affiche aucun bouton « Réserver ».
 */
export default async function EquipePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/profile/espace-pro/equipe");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      professionalStatus: true,
      proProfiles: {
        // Un seul établissement pour l'instant : la sélection multi-boutique
        // n'existe pas encore côté interface.
        take: 1,
        orderBy: { createdAt: "asc" },
        include: {
          services: { where: { isActive: true }, orderBy: { position: "asc" } },
          members: {
            orderBy: { position: "asc" },
            include: { services: { select: { serviceId: true } } },
          },
        },
      },
    },
  });

  if (user?.professionalStatus !== "APPROVED" || !user.proProfiles[0]) {
    return (
      <div className="bg-surface min-h-screen">
        <Navbar />
        <main className="pt-32 pb-16 px-6 max-w-2xl mx-auto">
          <div className="bg-white rounded-2xl border border-slate-100 p-6">
            <h1 className="text-xl font-extrabold font-['Manrope']">Équipe et horaires</h1>
            <p className="text-sm text-outline mt-2 leading-relaxed">
              {user?.professionalStatus !== "APPROVED"
                ? "Réservé aux comptes professionnels vérifiés."
                : "Créez d'abord votre fiche d'établissement."}
            </p>
            <Link
              href="/profile/espace-pro"
              title="Ma fiche"
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-white"
            >
              Ma fiche
            </Link>
          </div>
        </main>
        <BottomNav />
      </div>
    );
  }

  const profile = user.proProfiles[0];

  return (
    <div className="bg-surface min-h-screen mb-24 md:mb-0">
      <Navbar />
      <main className="pt-28 md:pt-36 pb-16 px-4 max-w-3xl mx-auto">
        <h1 className="text-2xl font-extrabold tracking-tight font-['Manrope'] mb-4">
          Équipe et horaires
        </h1>
        <ProNav current="/profile/espace-pro/equipe" slug={profile.slug} />

        <TeamManager
          services={profile.services.map((s) => ({
            id: s.id,
            label: s.label,
            section: s.section,
            durationMin: s.durationMin,
          }))}
          initialMembers={profile.members.map((m) => ({
            id: m.id,
            displayName: m.displayName,
            role: m.role,
            color: m.color,
            isActive: m.isActive,
            serviceIds: m.services.map((link) => link.serviceId),
            // L'identifiant est affiché ; le mot de passe, jamais — seule son
            // empreinte existe en base.
            loginId: m.accessRevokedAt ? null : m.loginId,
          }))}
        />
      </main>
      <BottomNav />
    </div>
  );
}
