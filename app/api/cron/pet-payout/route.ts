import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { runPayoutRelease } from "@/lib/pet/jobs";

// Daily cron — releases escrowed Deal&Co Pet funds to pet-sitters once the
// service has ended (J+1). The platform keeps the 10% commission.
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runPayoutRelease(prisma);
  return NextResponse.json({ ok: true, ...result, ranAt: new Date().toISOString() });
}
