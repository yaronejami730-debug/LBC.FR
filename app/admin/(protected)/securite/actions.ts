"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { auth } from "@/lib/auth";
import { getAuthUser } from "@/lib/auth-unified";
import { prisma } from "@/lib/prisma";
import { removeListing, restoreListing, purgeListing } from "@/lib/moderation/removal";
import { purgeBannedAccounts } from "@/lib/moderation/account-purge";
import { registerBan } from "@/lib/moderation/ban-registry";
import { sendEmail } from "@/lib/email";
import { listingRestoredEmail } from "@/lib/emails/listing-removed";
import { listingUnderReviewEmail } from "@/lib/emails/listing-review";
import { listingSlug } from "@/lib/listing-slug";

/**
 * Actions du centre de sécurité.
 *
 * Toutes passent par `requireAdmin`, et toute action irréversible écrit dans
 * `AdminAuditLog` — une suppression définitive sans trace de qui l'a demandée
 * n'est pas auditable, donc pas acceptable.
 *
 * Le mot de confirmation est vérifié **côté serveur**. Une double confirmation
 * qui ne vit que dans le navigateur ne protège de rien : elle se contourne en
 * appelant l'action directement.
 */

const CONFIRM_WORD = "SUPPRIMER";

/**
 * Verrou administrateur — session par cookie (site) ou jeton Bearer (mobile).
 *
 * Le rôle est toujours relu en base : un jeton signé il y a trois semaines ne
 * prouve pas que le compte est encore administrateur.
 */
async function requireAdmin() {
  const actor = await getAuthUser();
  const id = actor?.id;
  if (!id) throw new Error("Accès refusé");

  const dbUser = await prisma.user.findUnique({
    where: { id },
    select: { role: true, name: true },
  });
  if (dbUser?.role !== "ADMIN") throw new Error("Accès refusé");
  return { id, name: dbUser.name ?? null };
}

async function audit(entry: {
  action: string;
  adminId: string;
  adminName: string | null;
  targetType?: string;
  targetId?: string;
  count?: number;
  reason?: string;
  details?: Record<string, unknown>;
}) {
  await prisma.adminAuditLog
    .create({
      data: {
        action: entry.action,
        adminId: entry.adminId,
        adminName: entry.adminName,
        targetType: entry.targetType ?? null,
        targetId: entry.targetId ?? null,
        count: entry.count ?? 1,
        reason: entry.reason ?? null,
        detailsJson: JSON.stringify(entry.details ?? {}),
      },
    })
    .catch((err) => console.error("[securite] audit:", err));
}

function revalidateSecurity() {
  revalidatePath("/admin/securite");
  revalidatePath("/admin");
}

// ── Annonces ──────────────────────────────────────────────────────────────────

/** Retire une annonce : invisible immédiatement, 21 jours pour corriger. */
export async function removeListingAction(listingId: string, reason: string) {
  const admin = await requireAdmin();
  if (!reason.trim()) throw new Error("Un motif est obligatoire : il est envoyé à l'utilisateur.");

  const res = await removeListing({
    listingId,
    reason: reason.trim(),
    actor: `admin:${admin.id}`,
  });
  if (!res.removed) throw new Error("Annonce introuvable");

  await audit({
    action: "LISTING_REMOVED",
    adminId: admin.id,
    adminName: admin.name,
    targetType: "listing",
    targetId: listingId,
    reason: reason.trim(),
    details: { permanentDeletionAt: res.permanentDeletionAt?.toISOString() },
  });

  revalidateSecurity();
  revalidatePath("/admin/listings");
  revalidatePath(`/annonce/${listingId}`);
  revalidatePath("/", "layout");
  return { permanentDeletionAt: res.permanentDeletionAt };
}

/**
 * « Laisser en ligne » : l'administrateur tranche en faveur de l'annonce.
 *
 * Tous les signalements ouverts sur ce contenu sont classés d'un coup — sinon
 * il faudrait cliquer dix fois pour une seule décision, et le compteur
 * resterait bloqué au-dessus du seuil.
 *
 * Le classement remet de fait le compteur à zéro : les utilisateurs peuvent
 * re-signaler, et il faudra à nouveau vingt signalements pour déclencher un
 * retrait automatique. C'est ce qui donne le dernier mot à l'humain sans
 * rendre l'annonce définitivement intouchable.
 */
export async function keepListingOnlineAction(listingId: string) {
  const admin = await requireAdmin();

  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    select: { id: true, status: true, userId: true },
  });
  if (!listing) throw new Error("Annonce introuvable");

  const { count } = await prisma.report.updateMany({
    where: { listingId, status: "OPEN" },
    data: { status: "DISMISSED", resolvedAt: new Date(), resolvedBy: admin.id },
  });

  // Une annonce mise hors ligne par un automatisme antérieur revient en
  // vitrine : décider de la garder et la laisser invisible n'aurait aucun sens.
  if (listing.status === "PENDING" || listing.status === "UNDER_REVIEW") {
    await prisma.listing.update({
      where: { id: listingId },
      data: { status: "APPROVED", adminNote: null, reviewPriority: 0, rejectionReason: null },
    });
  } else {
    await prisma.listing.update({
      where: { id: listingId },
      data: { adminNote: null, reviewPriority: 0 },
    });
  }

  await prisma.moderationEvent
    .create({
      data: {
        listingId,
        userId: listing.userId,
        actor: `admin:${admin.id}`,
        action: "reports_dismissed",
        reason: `${count} signalement(s) classé(s) sans suite`,
      },
    })
    .catch(() => {});

  await audit({
    action: "REPORTS_DISMISSED",
    adminId: admin.id,
    adminName: admin.name,
    targetType: "listing",
    targetId: listingId,
    reason: `${count} signalement(s) classé(s), annonce maintenue en ligne`,
  });

  revalidateSecurity();
  revalidatePath("/admin/listings");
  revalidatePath(`/annonce/${listingId}`);
  return { dismissed: count };
}

/**
 * Met une annonce en ligne « en revue ».
 *
 * Troisième voie entre laisser passer et retirer : l'annonce sort de la
 * vitrine, son auteur reçoit le motif écrit à la main, et il corrige. Rien
 * n'est programmé pour la supprimer — c'est toute la différence avec
 * `removeListingAction`, qui ouvre un compte à rebours de 21 jours.
 *
 * Le motif est obligatoire : un e-mail qui annonce un retrait sans dire quoi
 * corriger génère un ticket de support, pas une correction.
 */
export async function reviewListingAction(listingId: string, reason: string) {
  const admin = await requireAdmin();
  const motif = reason.trim();
  if (!motif) throw new Error("Un motif est obligatoire : il est envoyé à l'utilisateur.");

  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    select: {
      id: true,
      title: true,
      status: true,
      userId: true,
      user: { select: { email: true, name: true, companyName: true, isPro: true } },
    },
  });
  if (!listing) throw new Error("Annonce introuvable");

  await prisma.listing.update({
    where: { id: listingId },
    data: {
      status: "UNDER_REVIEW",
      rejectionReason: motif,
      reviewRequestedAt: new Date(),
      // Ni `removedAt` ni `permanentDeletionAt` : la mise en revue n'engage
      // aucune destruction. Ni `shadowBanned` : l'annonce n'est pas suspecte,
      // elle est incomplète.
    },
  });

  await prisma.moderationEvent
    .create({
      data: {
        listingId,
        userId: listing.userId,
        actor: `admin:${admin.id}`,
        action: "listing_under_review",
        reason: motif,
      },
    })
    .catch(() => {});

  await audit({
    action: "LISTING_UNDER_REVIEW",
    adminId: admin.id,
    adminName: admin.name,
    targetType: "listing",
    targetId: listingId,
    reason: motif,
  });

  if (listing.user?.email) {
    const baseUrl = process.env.NEXTAUTH_URL ?? "https://www.dealandcompany.fr";
    const displayName =
      listing.user.isPro && listing.user.companyName ? listing.user.companyName : listing.user.name;
    // L'envoi ne bloque pas la décision : une boîte pleine ne doit pas laisser
    // une annonce en ligne alors que la modération l'a mise en pause.
    sendEmail({
      to: listing.user.email,
      toName: displayName,
      subject: "Votre annonce demande une correction — Deal&Co",
      html: listingUnderReviewEmail({
        name: displayName,
        listingTitle: listing.title,
        reason: motif,
        editUrl: `${baseUrl}/annonce/${listingId}/edit`,
      }),
      adSource: "admin-listing-review",
    }).catch((err) => console.error("[review] e-mail non envoyé:", err));
  }

  revalidateSecurity();
  revalidatePath("/admin/listings");
  revalidatePath(`/annonce/${listingId}`);
  revalidatePath("/", "layout");
}

/** Valide une annonce retirée : elle redevient visible, le compte à rebours s'arrête. */
export async function restoreListingAction(listingId: string) {
  const admin = await requireAdmin();
  const listing = await restoreListing(listingId, `admin:${admin.id}`);

  const owner = await prisma.user.findUnique({
    where: { id: listing.userId },
    select: { email: true, name: true, companyName: true, isPro: true },
  });
  if (owner?.email) {
    const baseUrl = process.env.NEXTAUTH_URL ?? "https://www.dealandcompany.fr";
    const displayName = owner.isPro && owner.companyName ? owner.companyName : owner.name;
    sendEmail({
      to: owner.email,
      toName: displayName,
      subject: "Votre annonce est de nouveau en ligne — Deal&Co",
      html: listingRestoredEmail({
        name: displayName,
        listingTitle: listing.title,
        listingUrl: `${baseUrl}/annonce/${listing.id}/${listingSlug(listing.title)}`,
      }),
    }).catch(() => {});
  }

  await audit({
    action: "LISTING_RESTORED",
    adminId: admin.id,
    adminName: admin.name,
    targetType: "listing",
    targetId: listingId,
  });

  revalidateSecurity();
  revalidatePath("/admin/listings");
  revalidatePath(`/annonce/${listingId}`);
  revalidatePath("/", "layout");
}

/** Destruction immédiate d'une annonce, sans attendre la fin du délai. */
export async function purgeListingAction(listingId: string, confirmation: string) {
  const admin = await requireAdmin();
  if (confirmation.trim().toUpperCase() !== CONFIRM_WORD) {
    throw new Error(`Confirmation invalide : tapez ${CONFIRM_WORD}.`);
  }

  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    select: { userId: true, status: true },
  });
  if (!listing) throw new Error("Annonce introuvable");

  const ok = await purgeListing(listingId);
  if (!ok) throw new Error("Suppression impossible");

  await audit({
    action: "PERMANENT_DELETE_LISTING",
    adminId: admin.id,
    adminName: admin.name,
    targetType: "listing",
    targetId: listingId,
    details: { statusBefore: listing.status },
  });

  revalidateSecurity();
  revalidatePath("/admin/listings");
  revalidatePath("/", "layout");
}

// ── Surveillance ──────────────────────────────────────────────────────────────

/**
 * Met un compte sous surveillance.
 *
 * Aucun effet sur le compte : ni restriction, ni signal envoyé à l'utilisateur.
 * C'est un marque-page, et c'est volontaire — un compte douteux mais pas fautif
 * ne mérite pas d'être puni, seulement d'être revu.
 */
export async function watchAccountAction(userId: string, reason: string) {
  const admin = await requireAdmin();
  await prisma.user.update({
    where: { id: userId },
    data: {
      watchedAt: new Date(),
      watchReason: reason.trim() || null,
      watchedBy: admin.name ?? admin.id,
    },
  });

  await prisma.moderationEvent
    .create({
      data: {
        userId,
        actor: `admin:${admin.id}`,
        action: "account_watched",
        reason: reason.trim() || "Mise sous surveillance",
      },
    })
    .catch(() => {});

  await audit({
    action: "WATCH_ACCOUNT",
    adminId: admin.id,
    adminName: admin.name,
    targetType: "user",
    targetId: userId,
    reason: reason.trim(),
  });

  revalidateSecurity();
  revalidatePath("/admin/users");
}

export async function unwatchAccountAction(userId: string) {
  const admin = await requireAdmin();
  await prisma.user.update({
    where: { id: userId },
    data: { watchedAt: null, watchReason: null, watchedBy: null },
  });

  await audit({
    action: "UNWATCH_ACCOUNT",
    adminId: admin.id,
    adminName: admin.name,
    targetType: "user",
    targetId: userId,
  });

  revalidateSecurity();
  revalidatePath("/admin/users");
}

// ── Bannissement ──────────────────────────────────────────────────────────────

/**
 * Bannit un compte.
 *
 * Trois effets indissociables : le compte est marqué, ses annonces sont
 * retirées avec le même délai de conservation que les autres retraits, et
 * l'empreinte anti-réinscription est écrite immédiatement — pas seulement au
 * moment de la suppression définitive, sinon un compte banni jamais purgé
 * laisserait la porte ouverte à une réinscription.
 */
export async function banAccountAction(userId: string, reason: string) {
  const admin = await requireAdmin();
  if (!reason.trim()) throw new Error("Un motif de bannissement est obligatoire.");

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, phoneNumber: true, siret: true, role: true, bannedAt: true },
  });
  if (!user) throw new Error("Compte introuvable");
  if (user.role === "ADMIN") throw new Error("Un compte administrateur ne peut pas être banni.");

  await prisma.user.update({
    where: { id: userId },
    data: {
      bannedAt: user.bannedAt ?? new Date(),
      banReason: reason.trim(),
      banDecidedBy: admin.name ?? admin.id,
      watchedAt: null,
      watchReason: null,
      watchedBy: null,
    },
  });

  const devices = await prisma.deviceSession.findMany({
    where: { userId },
    select: { fingerprint: true, ipHash: true },
    take: 50,
  });
  await registerBan({
    email: user.email,
    phone: user.phoneNumber,
    siret: user.siret,
    deviceFingerprints: devices
      .map((d) => d.fingerprint ?? d.ipHash)
      .filter((f): f is string => !!f),
    reason: reason.trim(),
  }).catch((err) => console.error("[securite] registerBan:", err));

  const live = await prisma.listing.findMany({
    where: { userId, status: { in: ["APPROVED", "PENDING"] } },
    select: { id: true },
  });
  for (const l of live) {
    // Un seul email de bannissement suffit : inutile d'en envoyer un par annonce.
    await removeListing({
      listingId: l.id,
      reason: `Compte suspendu — ${reason.trim()}`,
      actor: `admin:${admin.id}`,
      notify: false,
      editable: false,
    }).catch((err) => console.error("[securite] retrait cascade:", err));
  }

  await prisma.moderationEvent
    .create({
      data: { userId, actor: `admin:${admin.id}`, action: "account_banned", reason: reason.trim() },
    })
    .catch(() => {});

  await audit({
    action: "BAN_ACCOUNT",
    adminId: admin.id,
    adminName: admin.name,
    targetType: "user",
    targetId: userId,
    reason: reason.trim(),
    details: { listingsRemoved: live.length },
  });

  // Sa fiche professionnelle sort de l'index et du sitemap au même titre que
  // ses annonces — un compte banni n'est plus une source fiable. Le retrait des
  // annonces le fait déjà, mais pas pour un pro qui n'en avait aucune.
  revalidateTag("listings");

  revalidateSecurity();
  revalidatePath("/admin/users");
  revalidatePath("/admin/listings");
  revalidatePath("/pro", "layout");
  revalidatePath("/", "layout");
}

export async function unbanAccountAction(userId: string) {
  const admin = await requireAdmin();
  await prisma.user.update({
    where: { id: userId },
    data: { bannedAt: null, banReason: null, banDecidedBy: null },
  });

  // Le registre doit suivre la décision : laisser l'empreinte bloquerait une
  // réinscription alors que le compte vient d'être rétabli.
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
  if (user?.email) {
    const { hashEmail } = await import("@/lib/moderation/ban-registry");
    const emailHash = hashEmail(user.email);
    if (emailHash) {
      await prisma.banRegistry.deleteMany({ where: { emailHash } }).catch(() => {});
    }
  }

  await audit({
    action: "UNBAN_ACCOUNT",
    adminId: admin.id,
    adminName: admin.name,
    targetType: "user",
    targetId: userId,
  });

  // Le compte redevient une source légitime : sa fiche peut réintégrer le
  // sitemap sans attendre l'expiration de l'instantané.
  revalidateTag("listings");

  revalidateSecurity();
  revalidatePath("/admin/users");
  revalidatePath("/pro", "layout");
}

// ── Suppression définitive ────────────────────────────────────────────────────

/**
 * Supprime définitivement un ou plusieurs comptes bannis.
 *
 * `expectedCount` est vérifié contre la liste réellement transmise : si un
 * compte a été débanni entre l'affichage de la page et la confirmation, le
 * nombre annoncé au modérateur ne correspond plus à ce qui va être détruit, et
 * l'opération s'arrête. Sur une action irréversible, mieux vaut redemander.
 */
export async function purgeBannedAccountsAction(
  userIds: string[],
  confirmation: string,
  expectedCount: number,
) {
  const admin = await requireAdmin();

  if (confirmation.trim().toUpperCase() !== CONFIRM_WORD) {
    throw new Error(`Confirmation invalide : tapez ${CONFIRM_WORD}.`);
  }
  if (userIds.length === 0) throw new Error("Aucun compte sélectionné.");
  if (userIds.length !== expectedCount) {
    throw new Error("La liste a changé depuis l'affichage. Rechargez la page et recommencez.");
  }

  // Ne détruire que ce qui est réellement banni, quoi que dise le client.
  const eligible = await prisma.user.findMany({
    where: { id: { in: userIds }, bannedAt: { not: null }, role: { not: "ADMIN" } },
    select: { id: true },
  });
  if (eligible.length !== userIds.length) {
    throw new Error("Certains comptes ne sont plus bannis. Rechargez la page et recommencez.");
  }

  const { purged, failed } = await purgeBannedAccounts(
    eligible.map((u) => u.id),
    `admin:${admin.id}`,
  );

  await audit({
    action: "PERMANENT_DELETE_BANNED_ACCOUNTS",
    adminId: admin.id,
    adminName: admin.name,
    targetType: "user",
    count: purged.length,
    details: {
      deleted: purged.filter((p) => p.mode === "deleted").length,
      anonymized: purged.filter((p) => p.mode === "anonymized").length,
      listingsDeleted: purged.reduce((n, p) => n + p.listingsDeleted, 0),
      filesDeleted: purged.reduce((n, p) => n + p.filesDeleted, 0),
      failed: failed.length,
    },
  });

  revalidateSecurity();
  revalidatePath("/admin/users");
  revalidatePath("/", "layout");

  return {
    purged: purged.length,
    anonymized: purged.filter((p) => p.mode === "anonymized").length,
    failed,
  };
}

/** Récupère la liste courante des comptes bannis — sert à confirmer le nombre exact. */
export async function listBannedAccountIds(): Promise<string[]> {
  await requireAdmin();
  const rows = await prisma.user.findMany({
    where: { bannedAt: { not: null }, role: { not: "ADMIN" } },
    select: { id: true },
    orderBy: { bannedAt: "asc" },
  });
  return rows.map((r) => r.id);
}
