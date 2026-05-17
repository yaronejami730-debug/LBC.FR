import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { runBlacklistImport } from "@/lib/moderation/jobs";

// Cron quotidien — importe les flux externes de domaines frauduleux.
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runBlacklistImport(prisma);
  return NextResponse.json({ ok: true, ...result, ranAt: new Date().toISOString() });
}
