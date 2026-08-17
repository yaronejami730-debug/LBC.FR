/**
 * Avis à la modération : une annonce attend une décision humaine.
 *
 * Un seul point de passage, appelé aussi bien à la publication qu'à la
 * correction d'une annonce déjà refusée. C'est ce qui manquait : la création
 * prévenait l'équipe, la modification non. Une annonce refusée en janvier et
 * corrigée en juillet repassait en attente **en silence** — pour son auteur,
 * un refus sans réponse ni recours.
 *
 * Les deux canaux partent ensemble, et pour deux raisons différentes : la
 * notification pousse ceux qui ont l'application ouverte, l'e-mail laisse une
 * trace que l'on retrouve trois jours plus tard. Ni l'un ni l'autre ne doit
 * faire échouer l'enregistrement de l'annonce : tout est en `catch`.
 */
import { prisma } from "@/lib/prisma";
import { notifyAdmins } from "@/lib/expo-push";
import { sendEmail } from "@/lib/email";
import { listingResubmittedAdminEmail } from "@/lib/emails/listing-resubmitted-admin";

/** Libellés lisibles des champs, pour dire ce qui a bougé sans jargon. */
const FIELD_LABELS: Record<string, string> = {
  title: "Titre",
  description: "Description",
  price: "Prix",
  images: "Photos",
  category: "Catégorie",
  subcategory: "Sous-catégorie",
  location: "Localisation",
  condition: "État",
  metadata: "Caractéristiques",
};

export function describeChanges(fields: string[]): string[] {
  return fields.map((f) => FIELD_LABELS[f] ?? f);
}

export async function notifyReviewQueue(input: {
  listingId: string;
  /** Auteur de la modification : il ne s'alerte pas lui-même s'il est admin. */
  actorUserId: string;
  /** État avant modification. Sanctionné → l'avis est plus pressant. */
  previousStatus: string;
  /** Champs modifiés, noms techniques ; traduits ici. */
  changedFields: string[];
  previousReason?: string | null;
}): Promise<void> {
  const listing = await prisma.listing
    .findUnique({
      where: { id: input.listingId },
      select: {
        id: true,
        title: true,
        price: true,
        category: true,
        location: true,
        user: { select: { name: true, companyName: true, isPro: true } },
      },
    })
    .catch(() => null);
  if (!listing) return;

  const sanctioned = ["REJECTED", "REMOVED", "UNDER_REVIEW"].includes(input.previousStatus);
  const sellerName =
    (listing.user.isPro && listing.user.companyName) || listing.user.name || "Vendeur";

  notifyAdmins(
    {
      title: sanctioned ? "Annonce corrigée à revoir" : "Annonce modifiée à valider",
      body: `${listing.title} — ${sellerName}`,
      data: { type: "admin_listing_pending", listingId: listing.id },
    },
    { exceptUserId: input.actorUserId },
  ).catch(() => {});

  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) {
    console.error("[notifyReviewQueue] ADMIN_EMAIL absent — aucun e-mail de modération envoyé");
    return;
  }

  const baseUrl = process.env.NEXTAUTH_URL ?? "https://www.dealandcompany.fr";

  sendEmail({
    to: adminEmail,
    toName: "Administration Deal & Co",
    // Préfixe « admin » : ni encart publicitaire, ni pixel de suivi sur un
    // e-mail interne.
    adSource: "admin-listing-resubmitted",
    subject: sanctioned
      ? `Annonce corrigée à revoir : "${listing.title}"`
      : `Annonce modifiée à valider : "${listing.title}"`,
    html: listingResubmittedAdminEmail({
      sellerName,
      listingTitle: listing.title,
      price: listing.price,
      category: listing.category,
      location: listing.location,
      previousStatus: input.previousStatus,
      changedFields: describeChanges(input.changedFields),
      previousReason: input.previousReason ?? null,
      listingUrl: `${baseUrl}/annonce/${listing.id}`,
      adminUrl: `${baseUrl}/admin/listings?statut=PENDING`,
    }),
  }).catch((err) => console.error("[notifyReviewQueue] e-mail échec", err));
}
