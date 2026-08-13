import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { adminErrorResponse, requireMobileAdmin } from "@/lib/admin/mobile-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUSES = ["PENDING", "UNDER_REVIEW", "APPROVED", "REJECTED", "REMOVED"];

/** File de modération des annonces, telle que la voit l'administrateur mobile. */
export async function GET(req: NextRequest) {
  try {
    await requireMobileAdmin(req);

    const url = new URL(req.url);
    const status = url.searchParams.get("status") ?? "PENDING";
    if (!STATUSES.includes(status)) {
      return NextResponse.json({ error: "Statut inconnu." }, { status: 400 });
    }
    const take = Math.min(Number(url.searchParams.get("take") ?? 40) || 40, 100);
    const cursor = url.searchParams.get("cursor");

    const listings = await prisma.listing.findMany({
      where: { status, deletedAt: null },
      orderBy:
        status === "PENDING"
          ? [{ reviewPriority: "desc" }, { createdAt: "desc" }]
          : { createdAt: "desc" },
      take: take + 1,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      select: {
        id: true,
        title: true,
        price: true,
        images: true,
        category: true,
        subcategory: true,
        location: true,
        status: true,
        createdAt: true,
        rejectionReason: true,
        riskScore: true,
        user: { select: { id: true, name: true, email: true, isPro: true, verified: true } },
      },
    });

    const hasMore = listings.length > take;
    const page = hasMore ? listings.slice(0, take) : listings;

    return NextResponse.json({
      listings: page.map((l) => ({
        ...l,
        // L'application n'a pas à connaître notre encodage : on lui sert un
        // tableau, pas une chaîne JSON.
        images: parseImages(l.images),
      })),
      nextCursor: hasMore ? (page[page.length - 1]?.id ?? null) : null,
    });
  } catch (error) {
    return adminErrorResponse(error);
  }
}

function parseImages(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}
