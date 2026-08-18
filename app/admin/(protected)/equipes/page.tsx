import { prisma } from "@/lib/prisma";
import { assignableSections } from "@/lib/admin/staff";
import TeamsManager, { type TeamRow } from "./TeamsManager";

export const metadata = { title: "Équipes — Admin" };
export const dynamic = "force-dynamic";

/**
 * Équipes internes.
 *
 * Il n'existait qu'un seul niveau d'accès : `ADMIN`, c'est-à-dire tout. Un
 * renfort embauché pour répondre au support pouvait supprimer des comptes et
 * lire les pièces d'identité déposées par les professionnels. Cet écran
 * découpe l'administration en chapitres et dit qui ouvre lesquels.
 *
 * Une personne peut appartenir à plusieurs équipes : support *et* modération
 * est un cas courant, et un rôle unique obligerait à inventer des rôles
 * combinés qui se multiplient.
 */
export default async function EquipesPage() {
  const teams = await prisma.staffTeam.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      members: {
        orderBy: { createdAt: "asc" },
        select: {
          userId: true,
          createdAt: true,
          user: { select: { id: true, name: true, email: true, avatar: true } },
        },
      },
    },
  });

  // Administrateurs hors équipe : ils gardent l'accès complet par défaut, ce
  // qui est exactement ce que cet écran sert à corriger. Les afficher évite
  // qu'ils restent invisibles.
  const unassigned = await prisma.user.findMany({
    where: { role: "ADMIN", staffMemberships: { none: {} } },
    select: { id: true, name: true, email: true },
    take: 50,
  });

  const rows: TeamRow[] = teams.map((t) => ({
    id: t.id,
    slug: t.slug,
    label: t.label,
    description: t.description,
    sections: (() => {
      try {
        const parsed = JSON.parse(t.sections) as unknown;
        return Array.isArray(parsed) ? parsed.map(String) : [];
      } catch {
        return [];
      }
    })(),
    members: t.members.map((m) => ({
      id: m.user.id,
      name: m.user.name,
      email: m.user.email,
      since: m.createdAt.toISOString(),
    })),
  }));

  return (
    <div className="space-y-6">
      <header>
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#2f6fb8]">
          Administration
        </p>
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Équipes internes</h1>
        <p className="mt-1 text-sm text-slate-500">
          Chaque équipe ouvre certains chapitres de l&apos;administration. Une personne peut
          appartenir à plusieurs équipes ; ses droits s&apos;additionnent.
        </p>
      </header>

      <TeamsManager
        teams={rows}
        sections={assignableSections().map((s) => ({
          key: s.key,
          label: s.label,
          icon: s.icon,
          entries: s.entries.map((e) => e.label),
        }))}
        unassigned={unassigned}
      />
    </div>
  );
}
