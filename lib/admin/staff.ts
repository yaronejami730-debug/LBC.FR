/**
 * Équipes internes — qui accède à quoi dans l'administration.
 *
 * Deux niveaux, et ils ne répondent pas à la même question. `User.role`
 * décide **si** on entre : sans `ADMIN`, le middleware renvoie à la connexion.
 * L'équipe décide **ce qu'on y fait**. Séparer les deux évite qu'un renfort
 * embauché pour le support puisse supprimer des comptes ou lire les pièces
 * d'identité déposées par les professionnels.
 *
 * Compatibilité : un administrateur sans aucune équipe garde l'accès complet.
 * Sans cette règle, la migration aurait fermé l'administration à tout le monde
 * le jour de son déploiement — la sécurité qui commence par un verrouillage
 * général se fait désactiver dans l'heure.
 */
import { prisma } from "@/lib/prisma";
import { ADMIN_SECTIONS } from "./sections";

export type StaffAccess = {
  /** Clés de section accordées. `["*"]` pour un accès complet. */
  sections: string[];
  /** Équipes auxquelles la personne appartient, pour l'affichage. */
  teams: { slug: string; label: string }[];
  /** Vrai quand l'accès vient de l'absence d'équipe, pas d'un droit explicite. */
  implicit: boolean;
};

const FULL: string[] = ["*"];

function parseSections(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

/** Droits effectifs d'un compte administrateur. */
export async function staffAccess(userId: string): Promise<StaffAccess> {
  const memberships = await prisma.staffMembership
    .findMany({
      where: { userId },
      select: { team: { select: { slug: true, label: true, sections: true } } },
    })
    .catch(() => []);

  if (memberships.length === 0) {
    return { sections: FULL, teams: [], implicit: true };
  }

  const sections = new Set<string>();
  for (const m of memberships) {
    for (const key of parseSections(m.team.sections)) sections.add(key);
  }

  return {
    sections: sections.has("*") ? FULL : [...sections],
    teams: memberships.map((m) => ({ slug: m.team.slug, label: m.team.label })),
    implicit: false,
  };
}

/** Le compte peut-il ouvrir cette section ? */
export function canAccess(access: StaffAccess, sectionKey: string): boolean {
  return access.sections.includes("*") || access.sections.includes(sectionKey);
}

/** Sections proposées à la configuration d'une équipe, hors « vue ». */
export function assignableSections() {
  return ADMIN_SECTIONS.filter((s) => s.key !== "vue");
}
