/**
 * Décisions d'habilitation professionnelle, indépendantes du canal.
 *
 * Le site les appelle depuis une Server Action, l'application mobile depuis une
 * route REST : dans les deux cas, une habilitation accordée doit purger les
 * pièces d'identité, envoyer l'email, tracer la décision et republier — ou non
 * — la fiche. Ce sont ces conséquences qui vivent ici ; le contrôle du rôle
 * ADMIN appartient à l'appelant.
 */
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { deleteProDocuments } from "@/lib/pro-documents";
import {
  proVerificationApprovedEmail,
  proVerificationRejectedEmail,
  proVerificationInfoRequestedEmail,
  proVerificationSuspendedEmail,
} from "@/lib/emails/pro-verification";

/**
 * Journalise la décision sur le dernier dossier du compte, s'il en a un.
 *
 * Beaucoup de comptes professionnels sont antérieurs à la vérification : la
 * décision est alors tracée dans `ModerationEvent`, pour qu'aucune n'échappe à
 * l'historique.
 */
export async function traceProDecision(
  userId: string,
  action: string,
  adminId: string,
  details?: string,
) {
  const lastRequest = await prisma.proVerification.findFirst({
    where: { userId },
    orderBy: { submittedAt: "desc" },
    select: { id: true },
  });

  if (lastRequest) {
    await prisma.proVerificationLog.create({
      data: {
        verificationId: lastRequest.id,
        action,
        actor: `admin:${adminId}`,
        details: details ?? null,
      },
    });
  }
  await prisma.moderationEvent
    .create({
      data: {
        userId,
        actor: `admin:${adminId}`,
        action: `pro_${action.toLowerCase()}`,
        reason: details ?? action,
      } as never,
    })
    .catch(() => {});
}

/**
 * Retire du site toutes les annonces d'un compte sanctionné.
 *
 * Une sanction qui laisse les annonces en ligne ne sanctionne rien : le
 * vendeur continue d'être contacté. Réversible.
 */
async function hideAllListings(userId: string, reason: string) {
  await prisma.listing.updateMany({
    where: { userId, deletedAt: null },
    data: { status: "PENDING", shadowBanned: true, adminNote: `[COMPTE_SANCTIONNE] ${reason}` },
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

/** Habilite un compte professionnel. */
export async function approveProCore(userId: string, adminId: string) {
  const user = await loadUser(userId);

  await prisma.user.update({
    where: { id: userId },
    data: { isPro: true, professionalStatus: "APPROVED", proVerifiedAt: new Date() },
  });
  await prisma.proVerification.updateMany({
    where: { userId, status: { in: ["PENDING", "INFO_REQUESTED"] } },
    data: { status: "APPROVED", approvedAt: new Date(), approvedById: adminId },
  });

  // Les pièces d'identité ne servent plus une fois la décision prise : les
  // garder est un risque sans contrepartie.
  const requests = await prisma.proVerification.findMany({
    where: { userId, documentsDeletedAt: null },
    select: { id: true },
  });
  for (const d of requests) {
    await deleteProDocuments(d.id, `admin:${adminId}`, "Habilitation accordée");
  }
  await traceProDecision(userId, "APPROVED", adminId);

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
}

/** Réclame une pièce ou une précision. */
export async function requestProInfoCore(userId: string, adminId: string, request: string) {
  const demande = request.trim();
  if (demande.length < 5) throw new Error("Demande trop courte");
  const user = await loadUser(userId);

  await prisma.user.update({ where: { id: userId }, data: { professionalStatus: "INFO_REQUESTED" } });
  await prisma.proVerification.updateMany({
    where: { userId, status: { in: ["PENDING", "APPROVED"] } },
    data: { status: "INFO_REQUESTED", infoRequest: demande.slice(0, 500) },
  });
  await traceProDecision(userId, "INFO_REQUESTED", adminId, demande.slice(0, 500));

  if (user.email) {
    await sendEmail({
      to: user.email,
      subject: "Informations complémentaires pour votre compte professionnel",
      html: proVerificationInfoRequestedEmail({
        name: user.name ?? "",
        request: demande.slice(0, 500),
      }),
    }).catch(() => {});
  }
}

/** Refuse l'habilitation. Le compte redevient un compte particulier intact. */
export async function refuseProCore(userId: string, adminId: string, reason: string) {
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
  await traceProDecision(userId, "REJECTED", adminId, motif.slice(0, 500));

  if (user.email) {
    await sendEmail({
      to: user.email,
      subject: "Votre demande de compte professionnel",
      html: proVerificationRejectedEmail({ name: user.name ?? "", reason: motif.slice(0, 500) }),
    }).catch(() => {});
  }
}

/** Suspend l'habilitation : badge et fiche tombent, le compte reste. */
export async function suspendProCore(userId: string, adminId: string, reason: string) {
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
  await traceProDecision(userId, "SUSPENDED", adminId, motif.slice(0, 500));

  if (user.email) {
    await sendEmail({
      to: user.email,
      subject: "Votre compte professionnel a été suspendu",
      html: proVerificationSuspendedEmail({ name: user.name ?? "", reason: motif.slice(0, 500) }),
    }).catch(() => {});
  }
}

/** Rétablit une habilitation suspendue. */
export async function reinstateProCore(userId: string, adminId: string) {
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
  await traceProDecision(userId, "REINSTATED", adminId);
}
