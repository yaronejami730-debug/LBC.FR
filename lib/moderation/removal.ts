/**
 * Cycle de vie d'une annonce retirée.
 *
 *   VISIBLE → RETIRÉE (invisible immédiatement) → 21 jours pour corriger
 *      → validée : redevient visible
 *      → délai écoulé : destruction définitive
 *
 * Deux choix structurent ce fichier.
 *
 * **Le retrait n'est pas un `deletedAt`.** L'annonce passe en `status =
 * REMOVED`. Comme toutes les requêtes publiques filtrent sur
 * `status = "APPROVED"`, elle disparaît des recherches, des catégories, du
 * profil public et des recommandations sans qu'aucune de ces requêtes ait à
 * connaître le retrait. Elle reste lisible par son auteur, ce qu'un
 * soft-delete ne permettrait pas d'exprimer.
 *
 * **`permanentDeletionAt` n'est jamais repoussé.** Une annonce refusée,
 * corrigée, refusée à nouveau garde son échéance d'origine. Sans cette règle,
 * l'aller-retour modification/refus repousserait la date à l'infini et
 * l'annonce ne serait jamais purgée. La date ne s'efface qu'à l'approbation.
 */

import { del } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import { deleteListingFromIndex } from "@/lib/opensearch-sync";
import { sendEmail } from "@/lib/email";
import { listingRemovedEmail } from "@/lib/emails/listing-removed";
import { sendPushNotification } from "@/lib/notifications/send";

/** Durée de conservation d'une annonce retirée, en jours. */
export const REMOVAL_RETENTION_DAYS = 21;

export function deletionDateFrom(removedAt: Date): Date {
  return new Date(removedAt.getTime() + REMOVAL_RETENTION_DAYS * 24 * 60 * 60 * 1000);
}

/** Jours restants avant destruction — 0 si l'échéance est passée. */
export function daysUntilDeletion(permanentDeletionAt: Date | null | undefined): number | null {
  if (!permanentDeletionAt) return null;
  const ms = permanentDeletionAt.getTime() - Date.now();
  return ms <= 0 ? 0 : Math.ceil(ms / (24 * 60 * 60 * 1000));
}

export function formatDeadline(date: Date): string {
  return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export type RemoveListingInput = {
  listingId: string;
  reason: string;
  /** "admin:{id}" | "system" | "cron:{name}" */
  actor: string;
  /** Faux pour un retrait en cascade (bannissement) déjà notifié globalement. */
  notify?: boolean;
  /** Faux quand la décision est définitive : l'annonce ne peut plus être corrigée. */
  editable?: boolean;
};

/**
 * Retire une annonce de la diffusion et arme son délai de conservation.
 *
 * Idempotent sur la date : retirer deux fois la même annonce ne redémarre pas
 * le compte à rebours.
 */
export async function removeListing({
  listingId,
  reason,
  actor,
  notify = true,
  editable = true,
}: RemoveListingInput): Promise<{ removed: boolean; permanentDeletionAt: Date | null }> {
  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    select: {
      id: true,
      title: true,
      userId: true,
      status: true,
      removedAt: true,
      permanentDeletionAt: true,
      user: { select: { email: true, name: true, companyName: true, isPro: true } },
    },
  });
  if (!listing) return { removed: false, permanentDeletionAt: null };

  const removedAt = listing.removedAt ?? new Date();
  const permanentDeletionAt = listing.permanentDeletionAt ?? deletionDateFrom(removedAt);

  await prisma.listing.update({
    where: { id: listingId },
    data: {
      status: "REMOVED",
      rejectionReason: reason || null,
      removedAt,
      permanentDeletionAt,
      shadowBanned: true,
    },
  });

  // L'index de recherche est la seule surface qui ne relit pas le statut :
  // il faut l'expurger explicitement, sinon l'annonce reste trouvable.
  deleteListingFromIndex(listingId).catch((err) =>
    console.error("[removal] désindexation:", err),
  );

  await prisma.moderationEvent
    .create({
      data: {
        listingId,
        userId: listing.userId,
        actor,
        action: "listing_removed",
        reason,
      },
    })
    .catch(() => {});

  if (notify && listing.user?.email) {
    const baseUrl = process.env.NEXTAUTH_URL ?? "https://www.dealandcompany.fr";
    const displayName =
      listing.user.isPro && listing.user.companyName ? listing.user.companyName : listing.user.name;

    sendEmail({
      to: listing.user.email,
      toName: displayName,
      subject: "Votre annonce a été retirée de Deal&Co",
      html: listingRemovedEmail({
        name: displayName,
        listingTitle: listing.title,
        reason,
        deadline: formatDeadline(permanentDeletionAt),
        editUrl: `${baseUrl}/annonce/${listingId}/edit`,
        canEdit: editable,
      }),
    }).catch((err) => console.error("[removal] email:", err));

    sendPushNotification({
      userId: listing.userId,
      template: "listing_rejected",
      variables: { listingTitle: listing.title, listingId },
    }).catch(() => {});
  }

  return { removed: true, permanentDeletionAt };
}

/**
 * Remet une annonce retirée en diffusion.
 *
 * Efface les deux dates : c'est le seul point du cycle où le compte à rebours
 * s'arrête.
 */
export async function restoreListing(listingId: string, actor: string, reason = "Validée après modification") {
  const listing = await prisma.listing.update({
    where: { id: listingId },
    data: {
      status: "APPROVED",
      rejectionReason: null,
      removedAt: null,
      permanentDeletionAt: null,
      shadowBanned: false,
    },
  });

  await prisma.moderationEvent
    .create({
      data: { listingId, userId: listing.userId, actor, action: "listing_restored", reason },
    })
    .catch(() => {});

  return listing;
}

/** URLs hébergées sur Vercel Blob — les seules que `del` sait supprimer. */
function blobUrls(urls: (string | null | undefined)[]): string[] {
  return urls.filter(
    (u): u is string => !!u && /^https?:\/\/[^/]*\.(?:public\.)?blob\.vercel-storage\.com\//.test(u),
  );
}

/**
 * Destruction définitive d'une annonce : fichiers d'abord, base ensuite.
 *
 * L'ordre compte. Si l'on supprimait la ligne en premier et que l'effacement
 * des fichiers échouait, les photos resteraient dans le stockage sans plus
 * aucune référence permettant de les retrouver — des orphelines indétectables.
 * En commençant par le stockage, un échec laisse la ligne en base, donc une
 * seconde chance au passage suivant du cron.
 *
 * Ce n'est pas un `deleted = true` : les lignes sont réellement retirées.
 */
export async function purgeListing(listingId: string): Promise<boolean> {
  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    select: { id: true, images: true, listingImages: { select: { url: true } } },
  });
  if (!listing) return false;

  let inlineImages: string[] = [];
  try {
    inlineImages = JSON.parse(listing.images || "[]");
  } catch {
    inlineImages = [];
  }

  const files = blobUrls([...inlineImages, ...listing.listingImages.map((i) => i.url)]);
  if (files.length > 0) {
    await del(files).catch((err) => console.error("[purge] blob annonce:", err));
  }

  await deleteListingFromIndex(listingId).catch(() => {});

  // Les relations sans ON DELETE CASCADE doivent partir explicitement, et les
  // conversations avant l'annonce dont elles dépendent.
  await prisma.$transaction(async (tx) => {
    const convIds = (
      await tx.conversation.findMany({ where: { listingId }, select: { id: true } })
    ).map((c) => c.id);

    if (convIds.length > 0) {
      await tx.message.deleteMany({ where: { conversationId: { in: convIds } } });
      await tx.conversationParticipant.deleteMany({ where: { conversationId: { in: convIds } } });
      await tx.conversation.deleteMany({ where: { id: { in: convIds } } });
    }

    await tx.report.deleteMany({ where: { listingId } });
    await tx.moderationEvent.deleteMany({ where: { listingId } });
    await tx.favorite.deleteMany({ where: { listingId } });
    await tx.listingImage.deleteMany({ where: { listingId } });
    await tx.listing.delete({ where: { id: listingId } });
  });

  return true;
}

/**
 * Purge le lot d'annonces dont le délai de conservation est écoulé.
 *
 * `limit` borne le travail d'une exécution : mieux vaut plusieurs passages
 * courts qu'un cron qui expire au milieu d'une suppression.
 */
export async function purgeExpiredListings(limit = 200): Promise<{
  examined: number;
  purged: number;
  failed: number;
}> {
  // REJECTED et REMOVED partagent le même délai : dans les deux cas l'annonce
  // n'est plus diffusée et son auteur a eu le temps de la corriger. Les autres
  // statuts n'ont jamais d'échéance armée.
  const due = await prisma.listing.findMany({
    where: {
      status: { in: ["REMOVED", "REJECTED"] },
      permanentDeletionAt: { lte: new Date() },
    },
    select: { id: true, userId: true, title: true },
    take: limit,
  });

  let purged = 0;
  let failed = 0;

  for (const listing of due) {
    try {
      const ok = await purgeListing(listing.id);
      if (ok) {
        purged++;
        // Trace conservée au niveau du compte : l'annonce n'existe plus, donc
        // aucun listingId ne peut plus être référencé.
        await prisma.moderationEvent
          .create({
            data: {
              userId: listing.userId,
              actor: "cron:listing-purge",
              action: "listing_purged",
              reason: `Délai de conservation de ${REMOVAL_RETENTION_DAYS} jours écoulé`,
            },
          })
          .catch(() => {});
      }
    } catch (err) {
      failed++;
      console.error(`[purge] annonce ${listing.id}:`, err);
    }
  }

  return { examined: due.length, purged, failed };
}
