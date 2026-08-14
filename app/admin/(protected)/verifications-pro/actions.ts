"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { getAuthUser } from "@/lib/auth-unified";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { deleteProDocuments } from "@/lib/pro-documents";
import {
  proVerificationApprovedEmail,
  proVerificationRejectedEmail,
  proVerificationInfoRequestedEmail,
  proVerificationSuspendedEmail,
} from "@/lib/emails/pro-verification";

/** Voir app/admin/(protected)/professionnels/actions.ts : en production, une
 *  exception levée dans une Server Action perd son message. Les actions
 *  renvoient donc leur échec. */
export type ActionResult = { ok: true } | { ok: false; error: string };

async function guard(label: string, fn: () => Promise<void>): Promise<ActionResult> {
  try {
    await fn();
    return { ok: true };
  } catch (err) {
    console.error(`[admin/verifications-pro] ${label}:`, err);
    return { ok: false, error: err instanceof Error ? err.message : "Erreur inconnue" };
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

/** Toute décision laisse une trace : l'historique ne se réécrit pas. */
async function log(verificationId: string, action: string, adminId: string, details?: string) {
  await prisma.proVerificationLog.create({
    data: { verificationId, action, actor: `admin:${adminId}`, details: details ?? null },
  });
}

async function loadAccount(id: string) {
  const account = await prisma.proVerification.findUnique({
    where: { id },
    include: { user: { select: { id: true, email: true, name: true } } },
  });
  if (!account) throw new Error("Compte introuvable");
  return account;
}

/**
 * Valide un account. C'est le seul endroit qui accorde l'habilitation : SIRET,
 * raison sociale et `isPro` sont recopiés depuis le compte vérifié, jamais
 * depuis ce que le compte s'était attribué.
 */
export async function approveVerification(id: string): Promise<ActionResult> {
  return guard("approve", async () => {
    const adminId = await requireAdmin();
    const account = await loadAccount(id);

    // Un SIRET déjà rattaché à un autre compte bloque l'approbation : c'est
    // exactement la fraude que cette file existe pour arrêter.
    const holder = await prisma.user.findUnique({ where: { siret: account.siret } });
    if (holder && holder.id !== account.userId) {
      throw new Error(`SIRET déjà rattaché au compte ${holder.email}`);
    }

    const now = new Date();
    await prisma.$transaction([
      prisma.proVerification.update({
        where: { id },
        data: {
          status: "APPROVED",
          approvedAt: now,
          approvedById: adminId,
          reviewedAt: now,
          reviewedById: adminId,
          rejectionReason: null,
          infoRequest: null,
        },
      }),
      prisma.user.update({
        where: { id: account.userId },
        data: {
          isPro: true,
          professionalStatus: "APPROVED",
          siret: account.siret,
          companyName: account.companyName,
          proVerifiedAt: now,
        },
      }),
    ]);
    await log(id, "APPROVED", adminId, account.companyName);

    // La vérification a eu lieu : les pièces n'ont plus d'objet. Elles partent
    // immédiatement, avant même l'email de confirmation.
    await deleteProDocuments(id, `admin:${adminId}`, "Habilitation accordée");

    if (account.user.email) {
      await sendEmail({
        to: account.user.email,
        subject: "Votre compte professionnel est activé",
        html: proVerificationApprovedEmail({
          name: account.user.name ?? "",
          companyName: account.companyName,
        }),
      }).catch((err) => console.error("[verif-pro] email approbation:", err));
    }

    revalidatePath("/admin/verifications-pro");
  });
}

/** Refuse un account. Le motif part à l'utilisateur : il doit être exploitable. */
export async function rejectVerification(id: string, reason: string): Promise<ActionResult> {
  return guard("reject", async () => {
    const adminId = await requireAdmin();
    const motif = reason.trim();
    if (motif.length < 5) throw new Error("Motif de refus trop court");

    const account = await loadAccount(id);
    const now = new Date();

    await prisma.$transaction([
      prisma.proVerification.update({
        where: { id },
        data: {
          status: "REJECTED",
          rejectedAt: now,
          rejectedById: adminId,
          reviewedAt: now,
          reviewedById: adminId,
          rejectionReason: motif.slice(0, 500),
        },
      }),
      // Le refus ne touche ni `isPro` ni les annonces : un compte particulier
      // refusé reste un compte particulier intact.
      prisma.user.update({
        where: { id: account.userId },
        data: { professionalStatus: "REJECTED" },
      }),
    ]);
    await log(id, "REJECTED", adminId, motif.slice(0, 500));

    if (account.user.email) {
      await sendEmail({
        to: account.user.email,
        subject: "Votre demande de compte professionnel",
        html: proVerificationRejectedEmail({ name: account.user.name ?? "", reason: motif.slice(0, 500) }),
      }).catch((err) => console.error("[verif-pro] email refus:", err));
    }

    revalidatePath("/admin/verifications-pro");
  });
}

/**
 * Demande une pièce ou une précision. La demande reste ouverte — c'est une
 * relance, pas un refus : il doit rester dans la file de travail.
 */
export async function requestVerificationInfo(id: string, request: string): Promise<ActionResult> {
  return guard("request-info", async () => {
    const adminId = await requireAdmin();
    const demande = request.trim();
    if (demande.length < 5) throw new Error("Demande trop courte");

    const account = await loadAccount(id);

    await prisma.$transaction([
      prisma.proVerification.update({
        where: { id },
        data: { status: "INFO_REQUESTED", infoRequest: demande.slice(0, 500) },
      }),
      prisma.user.update({
        where: { id: account.userId },
        data: { professionalStatus: "INFO_REQUESTED" },
      }),
    ]);
    await log(id, "INFO_REQUESTED", adminId, demande.slice(0, 500));

    if (account.user.email) {
      await sendEmail({
        to: account.user.email,
        subject: "Informations complémentaires pour votre compte professionnel",
        html: proVerificationInfoRequestedEmail({
          name: account.user.name ?? "",
          request: demande.slice(0, 500),
        }),
      }).catch((err) => console.error("[verif-pro] email info:", err));
    }

    revalidatePath("/admin/verifications-pro");
  });
}

/**
 * Suspend une habilitation déjà accordée. `isPro` retombe : la fiche
 * professionnelle publique disparaît immédiatement, sans supprimer le compte
 * ni ses annonces.
 */
export async function suspendVerification(id: string, reason: string): Promise<ActionResult> {
  return guard("suspend", async () => {
    const adminId = await requireAdmin();
    const motif = reason.trim();
    if (motif.length < 5) throw new Error("Motif de suspension trop court");

    const account = await loadAccount(id);
    const now = new Date();

    await prisma.$transaction([
      prisma.proVerification.update({
        where: { id },
        data: {
          status: "SUSPENDED",
          suspendedAt: now,
          suspendedById: adminId,
          adminNote: motif.slice(0, 500),
        },
      }),
      prisma.user.update({
        where: { id: account.userId },
        data: { isPro: false, professionalStatus: "SUSPENDED" },
      }),
      prisma.proProfile.updateMany({
        where: { userId: account.userId },
        data: { isPublished: false },
      }),
    ]);
    await log(id, "SUSPENDED", adminId, motif.slice(0, 500));

    if (account.user.email) {
      await sendEmail({
        to: account.user.email,
        subject: "Votre compte professionnel a été suspendu",
        html: proVerificationSuspendedEmail({ name: account.user.name ?? "", reason: motif.slice(0, 500) }),
      }).catch((err) => console.error("[verif-pro] email suspension:", err));
    }

    revalidatePath("/admin/verifications-pro");
  });
}

/** Lève une suspension et rend l'habilitation. */
export async function reinstateVerification(id: string): Promise<ActionResult> {
  return guard("reinstate", async () => {
    const adminId = await requireAdmin();
    const account = await loadAccount(id);

    await prisma.$transaction([
      prisma.proVerification.update({
        where: { id },
        data: { status: "APPROVED", suspendedAt: null, suspendedById: null },
      }),
      prisma.user.update({
        where: { id: account.userId },
        data: { isPro: true, professionalStatus: "APPROVED" },
      }),
    ]);
    await log(id, "REINSTATED", adminId);

    revalidatePath("/admin/verifications-pro");
  });
}

/** Correction d'une donnée entreprise saisie de travers, tracée elle aussi. */
export async function updateVerificationFields(
  id: string,
  fields: Partial<{
    companyName: string;
    commercialName: string;
    siret: string;
    siren: string;
    businessAddress: string;
    businessActivity: string;
    businessCategory: string;
  }>,
): Promise<ActionResult> {
  return guard("update", async () => {
    const adminId = await requireAdmin();
    const clean = Object.fromEntries(
      Object.entries(fields)
        .filter(([, v]) => typeof v === "string" && v.trim().length > 0)
        .map(([k, v]) => [k, String(v).trim().slice(0, 300)]),
    );
    if (Object.keys(clean).length === 0) return;

    await prisma.proVerification.update({ where: { id }, data: clean });
    await log(id, "UPDATED", adminId, Object.keys(clean).join(", "));
    revalidatePath("/admin/verifications-pro");
  });
}

/** Note interne, jamais envoyée à l'utilisateur. */
export async function updateVerificationNote(id: string, note: string): Promise<ActionResult> {
  return guard("note", async () => {
    const adminId = await requireAdmin();
    await prisma.proVerification.update({
      where: { id },
      data: { adminNote: note.trim().slice(0, 2000) || null },
    });
    await log(id, "NOTE", adminId);
    revalidatePath("/admin/verifications-pro");
  });
}

/** Trace l'ouverture d'un compte — qui a consulté les pièces, et quand. */
export async function markCompteOpened(id: string): Promise<ActionResult> {
  return guard("opened", async () => {
    const adminId = await requireAdmin();
    await log(id, "OPENED", adminId);
  });
}
