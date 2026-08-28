/**
 * Décisions de modération d'une annonce, indépendantes du canal.
 *
 * Le site les appelle depuis une Server Action (session par cookie),
 * l'application mobile depuis une route REST (jeton Bearer). Le verrou
 * administrateur est vérifié par l'appelant ; ici, on n'a que la décision et
 * ses conséquences — email, notification, index, SEO, purge de cache.
 *
 * Le code vivait en double avant : la version mobile aurait oublié un email ou
 * une sortie de sitemap au premier changement.
 */
import { revalidatePath } from "next/cache";
import { revalidateListing } from "@/lib/listing-cache";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { listingApprovedEmail } from "@/lib/emails/listing-approved";
import { deletionDateFrom } from "@/lib/moderation/removal";
import { onListingPublished, onListingRemoved } from "@/lib/seo/lifecycle";
import { sendPushNotification } from "@/lib/notifications/send";
import { notifyMatchingSavedSearches } from "@/lib/notify-saved-searches";

/** Met une annonce en ligne et arrête son compte à rebours de suppression. */
export async function approveListingCore(id: string) {
  const listing = await prisma.listing.update({
    where: { id },
    data: {
      status: "APPROVED",
      rejectionReason: null,
      removedAt: null,
      permanentDeletionAt: null,
      shadowBanned: false,
    },
    include: { user: { select: { name: true, email: true, companyName: true, isPro: true } } },
  });

  const baseUrl = process.env.NEXTAUTH_URL ?? "https://www.dealandcompany.fr";
  const displayName =
    listing.user.isPro && listing.user.companyName ? listing.user.companyName : listing.user.name;

  sendEmail({
    to: listing.user.email,
    toName: displayName,
    subject: `Votre annonce "${listing.title}" est en ligne — Deal & Co`,
    html: listingApprovedEmail({
      name: displayName,
      listingTitle: listing.title,
      listingUrl: `${baseUrl}/annonce/${listing.id}`,
    }),
  }).catch(() => {});

  sendPushNotification({
    userId: listing.userId,
    template: "listing_approved",
    variables: { listingTitle: listing.title, listingId: listing.id },
  }).catch(() => {});

  notifyMatchingSavedSearches(listing.id).catch(() => {});

  revalidatePath("/admin/listings");
  revalidatePath("/admin");
  revalidatePath("/");
  revalidatePath("/annonces", "layout");
  await revalidateListing(listing.id, listing.title);

  await onListingPublished(listing.id);
  return listing;
}

/**
 * Refuse une annonce.
 *
 * `permanentDeletionAt` n'est armé qu'une fois : un refus après correction ne
 * repousse pas l'échéance, sinon l'aller-retour refus/modification garderait
 * indéfiniment un contenu jamais publiable.
 */
export async function rejectListingCore(id: string, reason: string) {
  const current = await prisma.listing.findUnique({
    where: { id },
    select: { removedAt: true, permanentDeletionAt: true },
  });
  const removedAt = current?.removedAt ?? new Date();
  const permanentDeletionAt = current?.permanentDeletionAt ?? deletionDateFrom(removedAt);

  const listing = await prisma.listing.update({
    where: { id },
    data: {
      status: "REJECTED",
      rejectionReason: reason || null,
      removedAt,
      permanentDeletionAt,
    },
    select: { id: true, title: true, userId: true },
  });

  import("@/lib/opensearch-sync")
    .then((m) => m.deleteListingFromIndex(id))
    .catch(() => {});

  sendPushNotification({
    userId: listing.userId,
    template: "listing_rejected",
    variables: { listingTitle: listing.title, listingId: listing.id },
  }).catch(() => {});

  await onListingRemoved(id);

  revalidatePath("/admin/listings");
  revalidatePath("/admin/securite");
  revalidatePath("/admin");
  return listing;
}
