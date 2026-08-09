"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { deleteProDocuments } from "@/lib/pro-documents";
import {
  proVerificationApprovedEmail,
  proVerificationRejectedEmail,
  proVerificationInfoRequestedEmail,
  proVerificationSuspendedEmail,
} from "@/lib/emails/pro-verification";

async function requireAdmin(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Accès refusé");

  const roleFromToken = (session.user as unknown as Record<string, unknown>)?.role as
    | string
    | undefined;
  if (roleFromToken === "ADMIN") return session.user.id;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (user?.role !== "ADMIN") throw new Error("Accès refusé");
  return session.user.id;
}

/**
 * Journalise sur le dernier compte du compte, s'il en a un.
 *
 * Beaucoup de comptes professionnels sont antérieurs à la vérification : ils
 * n'ont aucun compte. La décision est alors tracée dans `ModerationEvent`,
 * pour qu'aucune action n'échappe à l'historique.
 */
async function trace(userId: string, action: string, adminId: string, details?: string) {
  const lastRequest = await prisma.proVerification.findFirst({
    where: { userId },
    orderBy: { submittedAt: "desc" },
    select: { id: true },
  });

  if (lastRequest) {
    await prisma.proVerificationLog.create({
      data: { verificationId: lastRequest.id, action, actor: `admin:${adminId}`, details: details ?? null },
    });
  }
  await prisma.moderationEvent.create({
    data: {
      userId,
      actor: `admin:${adminId}`,
      action: `pro_${action.toLowerCase()}`,
      reason: details ?? action,
    } as any,
  }).catch(() => {});
}

/**
 * Retire du site toutes les annonces d'un compte.
 *
 * Une sanction qui laisse les annonces en ligne ne sanctionne rien : le
 * vendeur continue d'être contacté. `shadowBanned` les sort des listes et de
 * la recherche, `PENDING` les sort de la page publique. Réversible — la levée
 * de sanction les republie.
 */
async function hideAllListings(userId: string, reason: string) {
  await prisma.listing.updateMany({
    where: { userId, deletedAt: null },
    data: {
      status: "PENDING",
      shadowBanned: true,
      adminNote: `[COMPTE_SANCTIONNE] ${reason}`,
    },
  });
}

/** Republie les annonces retirées lors d'une suspension levée. */
async function restoreListings(userId: string) {
  await prisma.listing.updateMany({
    where: { userId, deletedAt: null, shadowBanned: true, status: "PENDING" },
    data: { status: "APPROVED", shadowBanned: false },
  });
}

async function loadUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, companyName: true },
  });
  if (!user) throw new Error("Compte introuvable");
  return user;
}

/** Habilite un compte professionnel déjà présent sur la plateforme. */
export async function verifyProAccount(userId: string) {
  const adminId = await requireAdmin();
  const user = await loadUser(userId);

  await prisma.user.update({
    where: { id: userId },
    data: { isPro: true, professionalStatus: "APPROVED", proVerifiedAt: new Date() },
  });
  await prisma.proVerification.updateMany({
    where: { userId, status: { in: ["PENDING", "INFO_REQUESTED"] } },
    data: { status: "APPROVED", approvedAt: new Date(), approvedById: adminId },
  });
  const requests = await prisma.proVerification.findMany({
    where: { userId, documentsDeletedAt: null },
    select: { id: true },
  });
  for (const d of requests) {
    await deleteProDocuments(d.id, `admin:${adminId}`, "Habilitation accordée");
  }
  await trace(userId, "APPROVED", adminId);

  if (user.email) {
    await sendEmail({
      to: user.email,
      subject: "Votre compte professionnel est activé",
      html: proVerificationApprovedEmail({
        name: user.name ?? "",
        companyName: user.companyName ?? "",
      }),
    }).catch(() => {});
  }
  revalidatePath("/admin/professionnels");
}

/** Réclame une pièce ou une précision à un professionnel déjà en ligne. */
export async function requestProInfo(userId: string, request: string) {
  const adminId = await requireAdmin();
  const demande = request.trim();
  if (demande.length < 5) throw new Error("Demande trop courte");
  const user = await loadUser(userId);

  await prisma.user.update({
    where: { id: userId },
    data: { professionalStatus: "INFO_REQUESTED" },
  });
  await prisma.proVerification.updateMany({
    where: { userId, status: { in: ["PENDING", "APPROVED"] } },
    data: { status: "INFO_REQUESTED", infoRequest: demande.slice(0, 500) },
  });
  await trace(userId, "INFO_REQUESTED", adminId, demande.slice(0, 500));

  if (user.email) {
    await sendEmail({
      to: user.email,
      subject: "Informations complémentaires pour votre compte professionnel",
      html: proVerificationInfoRequestedEmail({ name: user.name ?? "", request: demande.slice(0, 500) }),
    }).catch(() => {});
  }
  revalidatePath("/admin/professionnels");
}

/** Refuse l'habilitation. Le compte redevient un compte particulier intact. */
export async function refuseProAccount(userId: string, reason: string) {
  const adminId = await requireAdmin();
  const motif = reason.trim();
  if (motif.length < 5) throw new Error("Motif trop court");
  const user = await loadUser(userId);

  await prisma.user.update({
    where: { id: userId },
    data: { isPro: false, professionalStatus: "REJECTED", proVerifiedAt: null },
  });
  await prisma.proVerification.updateMany({
    where: { userId, status: { in: ["PENDING", "INFO_REQUESTED", "APPROVED"] } },
    data: {
      status: "REJECTED",
      rejectedAt: new Date(),
      rejectedById: adminId,
      rejectionReason: motif.slice(0, 500),
    },
  });
  await prisma.proProfile.updateMany({ where: { userId }, data: { isPublished: false } });
  await hideAllListings(userId, `Habilitation refusée : ${motif.slice(0, 200)}`);
  await trace(userId, "REJECTED", adminId, motif.slice(0, 500));

  if (user.email) {
    await sendEmail({
      to: user.email,
      subject: "Votre demande de compte professionnel",
      html: proVerificationRejectedEmail({ name: user.name ?? "", reason: motif.slice(0, 500) }),
    }).catch(() => {});
  }
  revalidatePath("/admin/professionnels");
}

/**
 * Suspend l'habilitation. Le badge et la fiche publique tombent ; le compte,
 * ses annonces et ses conversations restent — c'est une sanction réversible.
 */
export async function suspendProAccount(userId: string, reason: string) {
  const adminId = await requireAdmin();
  const motif = reason.trim();
  if (motif.length < 5) throw new Error("Motif trop court");
  const user = await loadUser(userId);

  await prisma.user.update({
    where: { id: userId },
    data: { isPro: false, professionalStatus: "SUSPENDED" },
  });
  await prisma.proVerification.updateMany({
    where: { userId },
    data: { status: "SUSPENDED", suspendedAt: new Date(), suspendedById: adminId },
  });
  await prisma.proProfile.updateMany({ where: { userId }, data: { isPublished: false } });
  await hideAllListings(userId, `Compte suspendu : ${motif.slice(0, 200)}`);
  await trace(userId, "SUSPENDED", adminId, motif.slice(0, 500));

  if (user.email) {
    await sendEmail({
      to: user.email,
      subject: "Votre compte professionnel a été suspendu",
      html: proVerificationSuspendedEmail({ name: user.name ?? "", reason: motif.slice(0, 500) }),
    }).catch(() => {});
  }
  revalidatePath("/admin/professionnels");
}

/** Rétablit une habilitation suspendue. */
export async function reinstateProAccount(userId: string) {
  const adminId = await requireAdmin();
  await prisma.user.update({
    where: { id: userId },
    data: { isPro: true, professionalStatus: "APPROVED" },
  });
  await prisma.proVerification.updateMany({
    where: { userId, status: "SUSPENDED" },
    data: { status: "APPROVED", suspendedAt: null, suspendedById: null },
  });
  await prisma.proProfile.updateMany({ where: { userId }, data: { isPublished: true } });
  await restoreListings(userId);
  await trace(userId, "REINSTATED", adminId);
  revalidatePath("/admin/professionnels");
}

/**
 * Suppression définitive du compte et de tout ce qui s'y rattache.
 *
 * Irréversible : les annonces, conversations, favoris et comptes partent avec
 * le compte (cascades Prisma). Un administrateur ne peut pas être supprimé
 * depuis cette file — il faut d'abord lui retirer son rôle, pour qu'une
 * mauvaise manipulation ne coupe pas l'accès à l'administration.
 */
export async function deleteUserAccount(userId: string, confirmEmail: string) {
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
}

/** Donne ou retire le rôle administrateur, à partir de l'email du compte. */
export async function setUserRole(email: string, role: "ADMIN" | "USER") {
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
}
