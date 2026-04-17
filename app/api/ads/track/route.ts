import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Placement = "carousel" | "rotator" | "grid";

// POST /api/ads/track  { id, type: "click" | "impression", placement?: Placement }
export async function POST(req: NextRequest) {
  const { id, type, placement } = await req.json();
  if (!id || (type !== "click" && type !== "impression")) {
    return NextResponse.json({ error: "Invalid params" }, { status: 400 });
  }

  const placementIncrement: Record<string, { increment: number }> = {};
  if (type === "impression" && placement) {
    if (placement === "carousel") placementIncrement.impCarousel = { increment: 1 };
    else if (placement === "rotator") placementIncrement.impRotator = { increment: 1 };
    else if (placement === "grid")    placementIncrement.impGrid    = { increment: 1 };
  }

  await prisma.advertisement.updateMany({
    where: { id, isActive: true },
    data: {
      ...(type === "click" ? { clicks: { increment: 1 } } : { impressions: { increment: 1 } }),
      ...placementIncrement,
    },
  });

  return NextResponse.json({ ok: true });
}
