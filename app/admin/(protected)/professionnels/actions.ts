"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { getAuthUser } from "@/lib/auth-unified";
import { prisma } from "@/lib/prisma";
import {
  approveProCore,
  refuseProCore,
  reinstateProCore,
  requestProInfoCore,
  suspendProCore,
} from "@/lib/moderation/pro-decisions";

/**
 * Résultat d'une action de modération.
 *
 * Next masque le message des exceptions levées dans une Server Action en
 * production (« An error occurred in the Server Components render »), ce qui
 * laissait le modérateur devant un mur. Les actions renvoient donc leur échec
 * au lieu de le lever, et le journal serveur garde la trace complète.
 */
export type ActionResult = { ok: true } | { ok: false; error: string };

async function guard(label: string, fn: () => Promise<void>): Promise<ActionResult> {
  try {
    await fn();
    return { ok: true };
  } catch (err) {
    console.error(`[admin/professionnels] ${label}:`, err);
    const message = err instanceof Error ? err.message : "Erreur inconnue";
    return { ok: false, error: message };
  }
}

/** Verrou administrateur — session du site ou jeton Bearer de l'application. */
async function requireAdmin(): Promise<string> {
  const actor = await getAuthUser();
  if (!actor?.id) throw new Error("Accès refusé");

  const user = await prisma.user.findUnique({
    where: { id: actor.id },
    select: { role: true },
  });
  if (user?.role !== "ADMIN") throw new Error("Accès refusé");
  return actor.id;
}

/** Habilite un compte professionnel déjà présent sur la plateforme. */
export async function verifyProAccount(userId: string): Promise<ActionResult> {
  return guard("verify", async () => {
    const adminId = await requireAdmin();
    await approveProCore(userId, adminId);
    revalidatePath("/admin/professionnels");
  });
}

/** Réclame une pièce ou une précision à un professionnel déjà en ligne. */
export async function requestProInfo(userId: string, request: string): Promise<ActionResult> {
  return guard("request-info", async () => {
    const adminId = await requireAdmin();
    await requestProInfoCore(userId, adminId, request);
    revalidatePath("/admin/professionnels");
  });
}

/** Refuse l'habilitation. Le compte redevient un compte particulier intact. */
export async function refuseProAccount(userId: string, reason: string): Promise<ActionResult> {
  return guard("refuse", async () => {
    const adminId = await requireAdmin();
    await refuseProCore(userId, adminId, reason);
    revalidatePath("/admin/professionnels");
  });
}

/**
 * Suspend l'habilitation. Le badge et la fiche publique tombent ; le compte,
 * ses annonces et ses conversations restent — c'est une sanction réversible.
 */
export async function suspendProAccount(userId: string, reason: string): Promise<ActionResult> {
  return guard("suspend", async () => {
    const adminId = await requireAdmin();
    await suspendProCore(userId, adminId, reason);
    revalidatePath("/admin/professionnels");
  });
}

/** Rétablit une habilitation suspendue. */
export async function reinstateProAccount(userId: string): Promise<ActionResult> {
  return guard("reinstate", async () => {
    const adminId = await requireAdmin();
    await reinstateProCore(userId, adminId);
    revalidatePath("/admin/professionnels");
  });
}

/**
 * Suppression définitive du compte et de tout ce qui s'y rattache.
 *
 * Irréversible : les annonces, conversations, favoris et comptes partent avec
 * le compte (cascades Prisma). Un administrateur ne peut pas être supprimé
 * depuis cette file — il faut d'abord lui retirer son rôle, pour qu'une
 * mauvaise manipulation ne coupe pas l'accès à l'administration.
 */
export async function deleteUserAccount(userId: string, confirmEmail: string): Promise<ActionResult> {
  return guard("delete", async () => {
    const adminId = await requireAdmin();
    if (userId === adminId) throw new Error("Impossible de supprimer son propre compte");

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, role: true },
    });
    if (!user) throw new Error("Compte introuvable");
    if (user.role === "ADMIN") throw new Error("Retirez d'abord le rôle administrateur");

    // Garde-fou : l'email saisi doit correspondre exactement au compte visé.
    if (confirmEmail.trim().toLowerCase() !== user.email.toLowerCase()) {
      throw new Error("L'email de confirmation ne correspond pas");
    }

    await prisma.moderationEvent.create({
      data: {
        actor: `admin:${adminId}`,
        action: "account_deleted",
        reason: `Suppression définitive du compte ${user.email}`,
      } as any,
    }).catch(() => {});

    const listingIds = (
      await prisma.listing.findMany({ where: { userId }, select: { id: true } })
    ).map((l) => l.id);

    // L'ordre compte : la relation Listing → User n'est pas en cascade, et les
    // enfants d'une annonce (images, signalements, événements) doivent partir
    // avant elle.
    await prisma.$transaction([
      prisma.listingImage.deleteMany({ where: { listingId: { in: listingIds } } }),
      prisma.report.deleteMany({ where: { OR: [{ listingId: { in: listingIds } }, { reporterId: userId }, { userId }] } }),
      prisma.moderationEvent.deleteMany({ where: { OR: [{ listingId: { in: listingIds } }, { userId }] } }),
      prisma.favorite.deleteMany({ where: { OR: [{ userId }, { listingId: { in: listingIds } }] } }),
      prisma.listing.deleteMany({ where: { userId } }),
      prisma.user.delete({ where: { id: userId } }),
    ]);
    revalidatePath("/admin/professionnels");
    revalidatePath("/admin/users");
  });
}

/**
 * Accorde ou retire le badge de vérification.
 *
 * Retrait possible à tout moment, sur un compte professionnel comme sur un
 * compte particulier : le badge dit qu'un compte est sain aujourd'hui, pas
 * qu'il l'a été une fois.
 */
export async function setVerificationBadge(userId: string, granted: boolean): Promise<ActionResult> {
  return guard("badge", async () => {
    const adminId = await requireAdmin();
    await prisma.user.update({
      where: { id: userId },
      data: granted
        ? { verified: true, badgeGrantedAt: new Date() }
        : { verified: false, badgeGrantedAt: null, badgeRequestedAt: null },
    });
    await prisma.moderationEvent.create({
      data: {
        userId,
        actor: `admin:${adminId}`,
        action: granted ? "badge_granted" : "badge_revoked",
        reason: granted ? "Badge de vérification accordé" : "Badge de vérification retiré",
      } as any,
    }).catch(() => {});
    revalidatePath("/admin/professionnels");
    revalidatePath("/admin/users");
  });
}

/** Donne ou retire le rôle administrateur, à partir de l'email du compte. */
export async function setUserRole(email: string, role: "ADMIN" | "USER"): Promise<ActionResult> {
  return guard("role", async () => {
    const adminId = await requireAdmin();
    const target = await prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
      select: { id: true, email: true },
    });
    if (!target) throw new Error("Aucun compte avec cet email");
    if (target.id === adminId && role === "USER") {
      throw new Error("Impossible de retirer son propre rôle administrateur");
    }

    await prisma.user.update({ where: { id: target.id }, data: { role } });
    await prisma.moderationEvent.create({
      data: {
        userId: target.id,
        actor: `admin:${adminId}`,
        action: role === "ADMIN" ? "role_granted" : "role_revoked",
        reason: `${target.email} → ${role}`,
      } as any,
    }).catch(() => {});

    revalidatePath("/admin/professionnels");
    revalidatePath("/admin/users");
  });
}
