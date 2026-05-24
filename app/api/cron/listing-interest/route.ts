import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendPushNotification } from "@/lib/notifications/send";

const INTEREST_THRESHOLD = 700;
const BATCH = 100;

export async function GET(req: Request) {
  const secret = new URL(req.url).searchParams.get("secret");
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const candidates = await prisma.listing.findMany({
    where: {
      status: "APPROVED",
      deletedAt: null,
      viewCount: { gte: INTEREST_THRESHOLD },
      interestNotifiedAt: null,
    },
    select: { id: true, title: true, userId: true, viewCount: true },
    take: BATCH,
  });

  let notified = 0;
  for (const listing of candidates) {
    try {
      await sendPushNotification({
        userId: listing.userId,
        template: "listing_trending",
        variables: { listingTitle: listing.title, listingId: listing.id },
      });
      await prisma.listing.update({
        where: { id: listing.id },
        data: { interestNotifiedAt: new Date() },
      });
      notified++;
    } catch (err) {
      console.error("[cron/listing-interest]", listing.id, err);
    }
  }

  return NextResponse.json({ scanned: candidates.length, notified });
}
