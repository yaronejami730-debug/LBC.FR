import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// POST /api/ads/track  { id, type: "click" | "impression" }
export async function POST(req: NextRequest) {
  const { id, type } = await req.json();
  if (!id || (type !== "click" && type !== "impression")) {
    return NextResponse.json({ error: "Invalid params" }, { status: 400 });
  }

  await prisma.advertisement.update({
    where: { id },
    data: type === "click"
      ? { clicks: { increment: 1 } }
      : { impressions: { increment: 1 } },
  });

  return NextResponse.json({ ok: true });
}
