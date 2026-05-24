import { prisma } from "@/lib/prisma";
import { buildSearchWhere } from "@/lib/search-where";
import { sendPushNotification } from "@/lib/notifications/send";

// Quand une annonce passe en ligne, prévient (push) les utilisateurs dont une
// alerte (recherche sauvegardée) correspond. N'envoie pas au propriétaire.
export async function notifyMatchingSavedSearches(listingId: string): Promise<void> {
  try {
    const listing = await prisma.listing.findUnique({
      where: { id: listingId },
      select: { id: true, title: true, userId: true, status: true, deletedAt: true },
    });
    if (!listing || listing.status !== "APPROVED" || listing.deletedAt) return;

    const searches = await prisma.savedSearch.findMany({
      select: { id: true, userId: true, name: true, filters: true },
    });

    for (const s of searches) {
      if (s.userId === listing.userId) continue;
      let filters: Record<string, string>;
      try {
        filters = JSON.parse(s.filters);
      } catch {
        continue;
      }
      const where = buildSearchWhere(filters) as Record<string, unknown>;
      const match = await prisma.listing.count({ where: { ...where, id: listingId } });
      if (match > 0) {
        await sendPushNotification({
          userId: s.userId,
          template: "saved_alert_match",
          variables: { alertName: s.name, alertId: s.id, listingId: listing.id, listingTitle: listing.title },
        });
      }
    }
  } catch (err) {
    console.error("[notifyMatchingSavedSearches]", err);
  }
}
