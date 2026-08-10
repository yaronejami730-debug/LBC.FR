/**
 * Destruction définitive d'un compte banni.
 *
 * Trois principes.
 *
 * **1. Le registre d'abord.** L'empreinte anti-réinscription est écrite avant
 * la moindre suppression. Si l'on effaçait le compte en premier et que
 * l'écriture échouait, l'email et le téléphone seraient perdus : la personne
 * pourrait se réinscrire immédiatement, et plus rien ne permettrait de le
 * savoir. Voir [ban-registry](./ban-registry.ts).
 *
 * **2. Les fichiers avant les lignes.** Le stockage objet ne se parcourt pas
 * par utilisateur : les chemins des fichiers ne sont connus que par les lignes
 * de la base. Supprimer la base en premier rendrait les fichiers introuvables
 * et donc indestructibles.
 *
 * **3. La comptabilité n'est pas supprimable.** Un paiement encaissé doit être
 * conservé plusieurs années, quelle que soit la décision de modération. Un
 * compte qui en porte n'est donc pas détruit mais **anonymisé** : les données
 * personnelles sont écrasées, la ligne comptable survit sans rattachement à une
 * personne identifiable. Les autres comptes sont réellement supprimés — pas de
 * `deleted = true`.
 */

import { del } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import { registerBan } from "@/lib/moderation/ban-registry";
import { deleteListingFromIndex } from "@/lib/opensearch-sync";
import { sendEmail } from "@/lib/email";
import { accountDeletedEmail } from "@/lib/emails/account-deleted";

export type PurgeMode = "deleted" | "anonymized";

export type PurgeAccountResult = {
  userId: string;
  mode: PurgeMode;
  listingsDeleted: number;
  filesDeleted: number;
  reason: string;
};

/** URLs hébergées sur Vercel Blob — les seules que `del` sait supprimer. */
function blobUrls(urls: (string | null | undefined)[]): string[] {
  return urls.filter(
    (u): u is string => !!u && /^https?:\/\/[^/]*\.(?:public\.)?blob\.vercel-storage\.com\//.test(u),
  );
}

function parseJsonArray(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/**
 * Détruit (ou anonymise) un compte banni et l'inscrit au registre.
 *
 * Lève si le compte n'est pas banni : la suppression définitive est une suite
 * de bannissement, jamais un raccourci pour se débarrasser d'un compte actif.
 */
export async function purgeBannedAccount(
  userId: string,
  actor: string,
): Promise<PurgeAccountResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      phoneNumber: true,
      siret: true,
      avatar: true,
      bannedAt: true,
      banReason: true,
      role: true,
      name: true,
      companyName: true,
      isPro: true,
    },
  });
  if (!user) throw new Error("Compte introuvable");
  if (!user.bannedAt) throw new Error("Seul un compte banni peut être supprimé définitivement");
  if (user.role === "ADMIN") throw new Error("Un compte administrateur ne peut pas être supprimé ici");

  const reason = user.banReason ?? "Bannissement";
  const displayName = user.isPro && user.companyName ? user.companyName : user.name;

  // ── 1. Registre anti-réinscription ────────────────────────────────────────
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
    reason,
    bannedAt: user.bannedAt,
    purged: true,
  });

  // ── 2. Inventaire des fichiers ────────────────────────────────────────────
  const [listings, listingImages, proProfile, petService, proVerifications] = await Promise.all([
    prisma.listing.findMany({ where: { userId }, select: { id: true, images: true } }),
    prisma.listingImage.findMany({ where: { listing: { userId } }, select: { url: true } }),
    prisma.proProfile.findFirst({ where: { userId }, select: { photos: true, coverImage: true } }),
    prisma.petProService.findUnique({ where: { userId }, select: { id: true, photos: true } }),
    prisma.proVerification.findMany({
      where: { userId },
      select: { id: true, idDocumentPath: true, idDocumentBackPath: true, companyDocPath: true },
    }),
  ]);

  const files = blobUrls([
    user.avatar,
    ...listings.flatMap((l) => parseJsonArray(l.images)),
    ...listingImages.map((i) => i.url),
    ...parseJsonArray(proProfile?.photos),
    proProfile?.coverImage,
    ...parseJsonArray(petService?.photos),
  ]);

  // Les justificatifs professionnels sont en blob privé : `del` les accepte par
  // pathname, pas par URL, d'où la liste distincte.
  const docPaths = proVerifications
    .flatMap((v) => [v.idDocumentPath, v.idDocumentBackPath, v.companyDocPath])
    .filter((p): p is string => !!p && !p.startsWith("deleted:"));

  if (files.length > 0) {
    await del(files).catch((err) => console.error("[account-purge] blobs:", err));
  }
  if (docPaths.length > 0) {
    await del(docPaths).catch((err) => console.error("[account-purge] documents:", err));
  }

  for (const l of listings) {
    deleteListingFromIndex(l.id).catch(() => {});
  }

  // ── 3. Base de données ────────────────────────────────────────────────────
  const paidBookings = await prisma.petPayment.count({
    where: {
      booking: {
        OR: [{ clientId: userId }, { proService: { userId } }],
      },
      status: { in: ["SUCCEEDED", "HELD", "RELEASED", "REFUNDED"] },
    },
  });
  const mode: PurgeMode = paidBookings > 0 ? "anonymized" : "deleted";

  const listingIds = listings.map((l) => l.id);

  await prisma.$transaction(async (tx) => {
    // Conversations portées par les annonces du compte, ou auxquelles il
    // participe : dans les deux cas les messages partent avec.
    const convIds = (
      await tx.conversation.findMany({
        where: {
          OR: [
            { listingId: { in: listingIds } },
            { participants: { some: { userId } } },
          ],
        },
        select: { id: true },
      })
    ).map((c) => c.id);

    if (convIds.length > 0) {
      await tx.message.deleteMany({ where: { conversationId: { in: convIds } } });
      await tx.conversationParticipant.deleteMany({ where: { conversationId: { in: convIds } } });
      await tx.conversation.deleteMany({ where: { id: { in: convIds } } });
    }
    await tx.message.deleteMany({ where: { senderId: userId } });
    await tx.conversationParticipant.deleteMany({ where: { userId } });

    // Annonces et tout ce qui s'y accroche.
    if (listingIds.length > 0) {
      await tx.report.deleteMany({ where: { listingId: { in: listingIds } } });
      await tx.moderationEvent.deleteMany({ where: { listingId: { in: listingIds } } });
      await tx.favorite.deleteMany({ where: { listingId: { in: listingIds } } });
      await tx.listingImage.deleteMany({ where: { listingId: { in: listingIds } } });
      await tx.listing.deleteMany({ where: { id: { in: listingIds } } });
    }

    // Traces personnelles du compte.
    await tx.favorite.deleteMany({ where: { userId } });
    await tx.savedSearch.deleteMany({ where: { userId } });
    await tx.report.deleteMany({ where: { OR: [{ reporterId: userId }, { userId }] } });
    await tx.deviceSession.deleteMany({ where: { userId } });
    await tx.rateLimitBucket.deleteMany({ where: { userId } });
    await tx.passwordResetToken.deleteMany({ where: { userId } });
    await tx.emailVerificationToken.deleteMany({ where: { userId } });
    await tx.pushSubscription.deleteMany({ where: { userId } });
    await tx.expoPushToken.deleteMany({ where: { userId } });
    await tx.apiKey.deleteMany({ where: { userId } });
    await tx.draft.deleteMany({ where: { userId } });
    await tx.externalSource.deleteMany({ where: { ownerId: userId } });
    await tx.subscription.deleteMany({ where: { OR: [{ followerId: userId }, { sellerId: userId }] } });
    await tx.emailEvent.deleteMany({ where: { userId } });
    await tx.userEvent.deleteMany({ where: { userId } });

    // Espace professionnel.
    await tx.proProfile.deleteMany({ where: { userId } });
    for (const v of proVerifications) {
      await tx.proVerificationLog.deleteMany({ where: { verificationId: v.id } });
    }
    await tx.proVerification.deleteMany({ where: { userId } });

    // Le journal de modération du *compte* survit à l'annonce mais pas au
    // compte : il ne référence plus rien d'exploitable une fois l'utilisateur
    // parti.
    await tx.moderationEvent.deleteMany({ where: { userId } });

    if (mode === "deleted") {
      await tx.petReview.deleteMany({ where: { authorId: userId } });
      const bookingIds = (
        await tx.petBooking.findMany({
          where: { OR: [{ clientId: userId }, { proService: { userId } }] },
          select: { id: true },
        })
      ).map((b) => b.id);
      if (bookingIds.length > 0) {
        await tx.petPayment.deleteMany({ where: { bookingId: { in: bookingIds } } });
        await tx.petReview.deleteMany({ where: { bookingId: { in: bookingIds } } });
        await tx.petBooking.deleteMany({ where: { id: { in: bookingIds } } });
      }
      await tx.petProService.deleteMany({ where: { userId } });
      await tx.user.delete({ where: { id: userId } });
    } else {
      // Anonymisation : la ligne survit uniquement pour porter les paiements.
      // Tout ce qui identifie une personne est écrasé, l'accès est neutralisé.
      const tag = `supprime-${userId.slice(-8)}`;
      await tx.user.update({
        where: { id: userId },
        data: {
          email: `${tag}@compte-supprime.invalid`,
          password: "",
          name: "Compte supprimé",
          firstName: null,
          lastName: null,
          civility: null,
          birthDate: null,
          avatar: null,
          phoneNumber: null,
          phoneVerified: false,
          emailVerified: false,
          addressLine: null,
          addressCity: null,
          addressPostal: null,
          companyName: null,
          siret: null,
          adminNote: null,
          banReason: reason,
          notificationPreferences: undefined,
          marketingConsent: false,
        },
      });
      await tx.petProService.updateMany({
        where: { userId },
        data: { displayName: "Compte supprimé", bio: "", photos: "[]", isPublished: false },
      });
    }
  });

  // ── 4. Dernier message ────────────────────────────────────────────────────
  //
  // Envoyé après la suppression, pas avant : une purge qui échoue en cours de
  // route ne doit pas annoncer une destruction qui n'a pas eu lieu. L'adresse
  // vient de la copie en mémoire — elle n'existe plus en base à cet instant,
  // et c'est la dernière fois qu'on peut écrire à cette personne.
  if (user.email) {
    const fmt = (d: Date) =>
      d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
    await sendEmail({
      to: user.email,
      toName: displayName,
      subject: "Votre compte Deal&Co a été supprimé définitivement",
      html: accountDeletedEmail({
        name: displayName,
        bannedAt: fmt(user.bannedAt),
        deletedAt: fmt(new Date()),
        reason: user.banReason,
      }),
    }).catch((err) => console.error("[account-purge] email:", err));
  }

  return {
    userId,
    mode,
    listingsDeleted: listingIds.length,
    filesDeleted: files.length + docPaths.length,
    reason,
  };
}

/**
 * Supprime un lot de comptes bannis.
 *
 * Un échec isolé n'annule pas le lot : chaque compte est traité séparément et
 * les erreurs sont remontées à l'appelant, qui décide quoi en dire.
 */
export async function purgeBannedAccounts(
  userIds: string[],
  actor: string,
): Promise<{ purged: PurgeAccountResult[]; failed: { userId: string; error: string }[] }> {
  const purged: PurgeAccountResult[] = [];
  const failed: { userId: string; error: string }[] = [];

  for (const id of userIds) {
    try {
      purged.push(await purgeBannedAccount(id, actor));
    } catch (err) {
      failed.push({ userId: id, error: err instanceof Error ? err.message : "Erreur inconnue" });
    }
  }

  return { purged, failed };
}
