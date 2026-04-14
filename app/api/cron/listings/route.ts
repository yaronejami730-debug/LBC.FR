import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { listingExpiringEmail } from "@/lib/emails/listing-expiring";

const DAYS_90 = 90 * 24 * 60 * 60 * 1000;
const DAYS_92 = 92 * 24 * 60 * 60 * 1000;

export async function GET(req: Request) {
  const secret = new URL(req.url).searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const cutoff90 = new Date(now.getTime() - DAYS_90);
  const cutoff92 = new Date(now.getTime() - DAYS_92);
  const baseUrl = process.env.NEXTAUTH_URL ?? "https://www.dealandcompany.fr";

  // ── 1. Supprimer définitivement les annonces expirées depuis +92 jours ──
  const toDelete = await prisma.listing.findMany({
    where: {
      status: "APPROVED",
      createdAt: { lte: cutoff92 },
      expiryNotifiedAt: { not: null },
    },
    select: { id: true, images: true },
  });

  for (const listing of toDelete) {
    // Supprimer les photos du stockage Vercel Blob si possible
    try {
      const imgs = JSON.parse(listing.images) as string[];
      for (const url of imgs) {
        if (url.includes("blob.vercel-storage.com")) {
          await fetch(url, { method: "DELETE" }).catch(() => {});
        }
      }
    } catch {}
    await prisma.listing.delete({ where: { id: listing.id } });
  }

  // ── 2. Notifier les annonces qui atteignent 90 jours (pas encore notifiées) ──
  const toNotify = await prisma.listing.findMany({
    where: {
      status: "APPROVED",
      deletedAt: null,
      createdAt: { lte: cutoff90 },
      expiryNotifiedAt: null,
    },
    include: {
      user: { select: { name: true, email: true, isPro: true, companyName: true } },
    },
    take: 50,
  });

  for (const listing of toNotify) {
    const imgs = (() => { try { return JSON.parse(listing.images) as string[]; } catch { return []; } })();
    const displayName = listing.user.isPro && listing.user.companyName ? listing.user.companyName : listing.user.name;
    const republishUrl = `${baseUrl}/annonce/${listing.id}/republier`;

    await sendEmail({
      to: listing.user.email,
      toName: displayName,
      subject: `Votre annonce "${listing.title}" expire dans 48h — Deal & Co`,
      html: listingExpiringEmail({
        name: displayName,
        listingTitle: listing.title,
        listingUrl: `${baseUrl}/annonce/${listing.id}`,
        republishUrl,
        imageUrl: imgs[0],
        price: listing.price,
      }),
    }).catch(() => {});

    await prisma.listing.update({
      where: { id: listing.id },
      data: { expiryNotifiedAt: now },
    });
  }

  return NextResponse.json({
    deleted: toDelete.length,
    notified: toNotify.length,
  });
}
