import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const VALID_CATEGORIES = new Set([
  "scam",
  "spam",
  "illegal",
  "offensive",
  "fake",
  "wrong_category",
  "duplicate",
  "personal_data",
  "stolen_photos",
  "other",
]);

const FLAG_THRESHOLD = 3;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const reporterId = session.user.id;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { listingId, category, message } = body as {
    listingId?: string;
    category?: string;
    message?: string;
  };

  if (!listingId || typeof listingId !== "string") {
    return NextResponse.json({ error: "listingId required" }, { status: 400 });
  }
  if (!category || !VALID_CATEGORIES.has(category)) {
    return NextResponse.json({ error: "Invalid category" }, { status: 400 });
  }
  if (message && message.length > 500) {
    return NextResponse.json({ error: "Message too long" }, { status: 400 });
  }

  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    select: { id: true, userId: true, status: true, reportCount: true } as any,
  }) as any;
  if (!listing) {
    return NextResponse.json({ error: "Listing not found" }, { status: 404 });
  }
  if (listing.userId === reporterId) {
    return NextResponse.json({ error: "Cannot report own listing" }, { status: 400 });
  }

  // De-dup: one open report per (listing, reporter, category)
  const existing = await prisma.report.findFirst({
    where: { listingId, reporterId, category, status: "OPEN" } as any,
  }).catch(() => null);
  if (existing) {
    return NextResponse.json({ ok: true, dedup: true });
  }

  // Rate limit: reporter cannot file >5 reports in 1h
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recent = await prisma.report.count({
    where: { reporterId, createdAt: { gte: oneHourAgo } } as any,
  }).catch(() => 0);
  if (recent >= 5) {
    return NextResponse.json(
      { error: "Trop de signalements. Réessayez plus tard." },
      { status: 429 },
    );
  }

  await prisma.report.create({
    data: {
      listingId,
      userId: listing.userId,
      reporterId,
      category,
      message: message?.trim() || null,
    } as any,
  });

  // Increment listing reportCount + user totalReportsAgainst
  const updatedListing = await prisma.listing.update({
    where: { id: listingId },
    data: { reportCount: { increment: 1 } } as any,
    select: { reportCount: true, status: true, userId: true } as any,
  }) as any;

  await prisma.user.update({
    where: { id: listing.userId },
    data: { totalReportsAgainst: { increment: 1 } } as any,
  }).catch(() => {});

  // Auto-flag listing when threshold reached and currently approved
  if (
    updatedListing.reportCount >= FLAG_THRESHOLD &&
    updatedListing.status === "APPROVED"
  ) {
    await prisma.listing.update({
      where: { id: listingId },
      data: {
        status: "PENDING",
        adminNote: `[AUTO_FLAGGED] ${updatedListing.reportCount} signalements`,
        reviewPriority: 7,
      } as any,
    }).catch(() => {});

    await prisma.moderationEvent.create({
      data: {
        listingId,
        userId: listing.userId,
        actor: "system",
        action: "report_flagged",
        reason: `Reached ${FLAG_THRESHOLD}+ reports`,
        flagsJson: JSON.stringify([{ category }]),
      } as any,
    }).catch(() => {});
  }

  return NextResponse.json({ ok: true });
}
