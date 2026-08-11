/**
 * Appartenances professionnelles d'un compte personnel.
 *
 * Corinne est coiffeuse chez Joana. C'est le salon qui l'a inscrite dans son
 * équipe, pas elle : elle n'a pas de compte Deal&Co pour autant. Le jour où
 * elle s'en crée un — pour vendre son vélo, comme tout le monde — les deux
 * doivent se rejoindre sans se confondre :
 *
 *  - son espace personnel gagne un onglet « Mon agenda » et un écusson Pro ;
 *  - le salon ne gagne rien : un membre d'équipe ne devient jamais
 *    administrateur de la fiche, et son compte personnel ne lui donne aucun
 *    droit dessus.
 *
 * Le lien est révocable par le salon seul. Si Joana coupe l'accès de Corinne,
 * l'onglet disparaît — sauf si Corinne travaille ailleurs, auquel cas il reste
 * pour l'autre établissement. C'est pourquoi tout est calculé à la demande :
 * rien à synchroniser, rien à nettoyer.
 */
import { prisma } from "@/lib/prisma";

export type Membership = {
  memberId: string;
  displayName: string;
  /** « Coiffeuse », « Barbier »… tel que le salon l'a saisi. */
  role: string | null;
  establishmentId: string;
  establishmentName: string;
  city: string | null;
};

/**
 * Lignes d'équipe rattachées à ce compte et toujours actives.
 *
 * Vide = aucun onglet agenda. C'est ce qui fait disparaître l'accès à la
 * seconde près où le salon le retire, sans tâche de fond.
 */
export async function membershipsOf(userId: string): Promise<Membership[]> {
  const members = await prisma.proMember.findMany({
    where: {
      userId,
      isActive: true,
      accessRevokedAt: null,
      profile: { user: { bannedAt: null, professionalStatus: "APPROVED" } },
    },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      displayName: true,
      role: true,
      profile: { select: { id: true, name: true, city: true } },
    },
  });

  return members.map((m) => ({
    memberId: m.id,
    displayName: m.displayName,
    role: m.role,
    establishmentId: m.profile.id,
    establishmentName: m.profile.name,
    city: m.profile.city,
  }));
}

/**
 * Lignes d'équipe portant cette adresse, en attente d'un compte personnel.
 *
 * Sert au moment de l'inscription : quelqu'un dont l'adresse est déjà connue
 * comme membre d'équipe doit être prévenu de ce qu'il est en train de faire,
 * plutôt que de découvrir un agenda surgi de nulle part.
 */
export async function membershipsForEmail(email: string): Promise<Membership[]> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return [];

  const members = await prisma.proMember.findMany({
    where: {
      email: normalized,
      userId: null,
      isActive: true,
      accessRevokedAt: null,
      profile: { user: { bannedAt: null, professionalStatus: "APPROVED" } },
    },
    select: {
      id: true,
      displayName: true,
      role: true,
      profile: { select: { id: true, name: true, city: true } },
    },
  });

  return members.map((m) => ({
    memberId: m.id,
    displayName: m.displayName,
    role: m.role,
    establishmentId: m.profile.id,
    establishmentName: m.profile.name,
    city: m.profile.city,
  }));
}

/** Rattache les lignes d'équipe de cette adresse au compte qui vient de naître. */
export async function linkMembershipsToUser(userId: string, email: string): Promise<number> {
  const normalized = email.trim().toLowerCase();
  const result = await prisma.proMember.updateMany({
    where: { email: normalized, userId: null, isActive: true, accessRevokedAt: null },
    data: { userId },
  });
  return result.count;
}

/** Phrase lue par la personne au moment de choisir. */
export function membershipNotice(memberships: Membership[]): string {
  if (memberships.length === 0) return "";
  const where = memberships
    .map((m) => `${m.role ? `${m.role.toLowerCase()} chez ` : ""}${m.establishmentName}`)
    .join(", ");
  return (
    `Cette adresse est déjà celle d'un membre d'équipe (${where}), utilisée pour consulter ` +
    `un agenda professionnel. Créer un compte personnel ne change rien à cet accès : ` +
    `vous retrouverez simplement votre agenda dans votre espace.`
  );
}
