import { NextResponse } from "next/server";
import { getActiveAds } from "@/lib/ads";

export const dynamic = "force-dynamic";

export async function GET() {
  const now = Date.now();
  const ads = (await getActiveAds().catch(() => []))
    .filter((ad) => {
      const scheduled = ad.scheduledAt ? new Date(ad.scheduledAt).getTime() : null;
      const expires = ad.expiresAt ? new Date(ad.expiresAt).getTime() : null;
      const isScheduledNow = !scheduled || scheduled <= now;
      const isNotExpired = !expires || expires > now;
      return (ad.isActive || isScheduledNow) && isScheduledNow && isNotExpired;
    })
    .map((ad) => ({
      id: ad.id,
      title: ad.title,
      description: ad.description,
      imageUrl: ad.imageUrl,
      imageUrlWide: ad.imageUrlWide,
      destinationUrl: ad.destinationUrl,
    }));

  return NextResponse.json(ads);
}
