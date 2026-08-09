"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import {
  proVerificationApprovedEmail,
  proVerificationRejectedEmail,
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
 * Valide un dossier : c'est le seul endroit qui passe un compte en `isPro`.
 * Le SIRET et la raison sociale sont recopiés depuis le dossier vérifié, pas
 * depuis ce que le compte s'était attribué.
 */
export async function approveVerification(id: string) {
  const adminId = await requireAdmin();

  const dossier = await prisma.proVerification.findUnique({
    where: { id },
    include: { user: { select: { id: true, email: true, name: true } } },
  });
  if (!dossier) throw new Error("Dossier introuvable");

  // Un SIRET déjà rattaché à un autre compte doit bloquer l'approbation : c'est
  // exactement la fraude que cette file existe pour arrêter.
  const holder = await prisma.user.findUnique({ where: { siret: dossier.siret } });
  if (holder && holder.id !== dossier.userId) {
    throw new Error(`SIRET déjà rattaché au compte ${holder.email}`);
  }

  await prisma.$transaction([
    prisma.proVerification.update({
      where: { id },
      data: {
        status: "APPROVED",
        reviewedAt: new Date(),
        reviewedById: adminId,
        rejectionReason: null,
      },
    }),
    prisma.user.update({
      where: { id: dossier.userId },
      data: {
        isPro: true,
        siret: dossier.siret,
        companyName: dossier.companyName,
        proVerifiedAt: new Date(),
      },
    }),
  ]);

  if (dossier.user.email) {
    await sendEmail({
      to: dossier.user.email,
      subject: "Votre compte professionnel est activé",
      html: proVerificationApprovedEmail({
        name: dossier.user.name ?? "",
        companyName: dossier.companyName,
      }),
    }).catch((err) => console.error("[verif-pro] email approbation:", err));
  }

  revalidatePath("/admin/verifications-pro");
}

/** Refuse un dossier. Le motif part à l'utilisateur : il doit être exploitable. */
export async function rejectVerification(id: string, reason: string) {
  const adminId = await requireAdmin();
  const motif = reason.trim();
  if (motif.length < 5) throw new Error("Motif de refus trop court");

  const dossier = await prisma.proVerification.findUnique({
    where: { id },
    include: { user: { select: { email: true, name: true } } },
  });
  if (!dossier) throw new Error("Dossier introuvable");

  await prisma.proVerification.update({
    where: { id },
    data: {
      status: "REJECTED",
      reviewedAt: new Date(),
      reviewedById: adminId,
      rejectionReason: motif.slice(0, 500),
    },
  });

  if (dossier.user.email) {
    await sendEmail({
      to: dossier.user.email,
      subject: "Votre demande de compte professionnel",
      html: proVerificationRejectedEmail({
        name: dossier.user.name ?? "",
        reason: motif.slice(0, 500),
      }),
    }).catch((err) => console.error("[verif-pro] email refus:", err));
  }

  revalidatePath("/admin/verifications-pro");
}

/** Note interne, jamais envoyée à l'utilisateur. */
export async function updateVerificationNote(id: string, note: string) {
  await requireAdmin();
  await prisma.proVerification.update({
    where: { id },
    data: { adminNote: note.trim().slice(0, 2000) || null },
  });
  revalidatePath("/admin/verifications-pro");
}
