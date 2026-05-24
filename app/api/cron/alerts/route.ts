import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildSearchWhere } from "@/lib/search-where";
import { sendEmail } from "@/lib/email";
import { sendPushNotification } from "@/lib/notifications/send";
import { savedSearchAlertEmail } from "@/lib/emails/saved-search-alert";
import { listingPhotoReminderEmail } from "@/lib/emails/listing-photo-reminder";
import { listingSlug } from "@/lib/listing-slug";
import { CATEGORIES } from "@/lib/categories";

const BASE = "https://www.dealandcompany.fr";
const MAX_LISTINGS_PER_EMAIL = 10;
// Minimum interval between two emails for the same alert (1 hour)
const MIN_INTERVAL_MS = 60 * 60 * 1000;

function buildSearchUrl(filters: Record<string, string>): string {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.category) {
    const cat = CATEGORIES.find((c) => c.id === filters.category || c.label === filters.category);
    params.set("category", cat ? cat.label : filters.category);
  }
  const skip = new Set(["q", "category"]);
  for (const [k, v] of Object.entries(filters)) {
    if (!skip.has(k) && v) params.set(k, v);
  }
  return `${BASE}/search?${params.toString()}`;
}

export async function GET(req: Request) {
  const secret = new URL(req.url).searchParams.get("secret");
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const minLastNotified = new Date(now.getTime() - MIN_INTERVAL_MS);

  // Load all saved searches not notified in the last hour
  const searches = await prisma.savedSearch.findMany({
    where: { lastNotifiedAt: { lte: minLastNotified } },
    include: { user: { select: { email: true, name: true } } },
  });

  let totalSent = 0;

  for (const search of searches) {
    const filters = JSON.parse(search.filters) as Record<string, string>;
    const where = buildSearchWhere(filters);

    const newListings = await prisma.listing.findMany({
      where: {
        ...where,
        createdAt: { gt: search.lastNotifiedAt },
      },
      select: {
        id: true,
        title: true,
        price: true,
        location: true,
        images: true,
      },
      orderBy: { createdAt: "desc" },
      take: MAX_LISTINGS_PER_EMAIL,
    });

    if (newListings.length === 0) continue;

    const alertListings = newListings.map((l) => {
      let imgs: string[] = [];
      try { imgs = JSON.parse(l.images); } catch { /* empty */ }
      return {
        id: l.id,
        title: l.title,
        price: l.price,
        location: l.location,
        imageUrl: imgs[0],
        url: `${BASE}/annonce/${l.id}/${listingSlug(l.title)}`,
      };
    });

    try {
      await sendEmail({
        to: search.user.email,
        toName: search.user.name,
        subject: `${newListings.length} nouvelle${newListings.length > 1 ? "s" : ""} annonce${newListings.length > 1 ? "s" : ""} pour "${search.name}" — Deal & Co`,
        html: savedSearchAlertEmail({
          name: search.user.name,
          searchName: search.name,
          searchUrl: buildSearchUrl(filters),
          listings: alertListings,
          manageUrl: `${BASE}/recherches`,
        }),
      });

      sendPushNotification({
        userId: search.userId,
        template: newListings.length > 1 ? "multiple_alert_matches" : "saved_alert_match",
        variables: {
          count: newListings.length,
          alertName: search.name,
          alertId: search.id,
          listingId: newListings[0].id,
        },
      }).catch(() => {});

      await prisma.savedSearch.update({
        where: { id: search.id },
        data: { lastNotifiedAt: now },
      });

      totalSent++;
    } catch (err) {
      console.error(`[cron/alerts] Failed to send for search ${search.id}:`, err);
    }
  }

  // ── Photo reminders ──────────────────────────────────────────────────────
  // Find approved listings with no photos, created 30min–6h ago, not yet reminded
  const photoReminderCutoffMin = new Date(now.getTime() - 30 * 60 * 1000);   // 30 min ago
  const photoReminderCutoffMax = new Date(now.getTime() - 6 * 60 * 60 * 1000); // 6h ago

  const noPhotoListings = await prisma.listing.findMany({
    where: {
      status: "APPROVED",
      deletedAt: null,
      photoReminderSentAt: null,
      images: { in: ["[]", "", "null"] },
      createdAt: {
        lte: photoReminderCutoffMin,
        gte: photoReminderCutoffMax,
      },
    },
    select: {
      id: true,
      title: true,
      user: { select: { email: true, name: true } },
    },
    take: 50,
  });

  let photoRemindersSent = 0;

  for (const listing of noPhotoListings) {
    try {
      await sendEmail({
        to: listing.user.email,
        toName: listing.user.name,
        subject: `Ajoutez des photos à "${listing.title}" pour plus de visibilité — Deal & Co`,
        html: listingPhotoReminderEmail({
          name: listing.user.name,
          listingTitle: listing.title,
          listingUrl: `${BASE}/annonce/${listing.id}/${listingSlug(listing.title)}`,
        }),
      });

      await prisma.listing.update({
        where: { id: listing.id },
        data: { photoReminderSentAt: now },
      });

      photoRemindersSent++;
    } catch (err) {
      console.error(`[cron/alerts] Photo reminder failed for ${listing.id}:`, err);
    }
  }

  return NextResponse.json({
    alerts: { checked: searches.length, sent: totalSent },
    photoReminders: { checked: noPhotoListings.length, sent: photoRemindersSent },
  });
}
