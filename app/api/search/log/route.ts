import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const { query } = await req.json();
    if (!query || typeof query !== "string" || query.trim().length < 2) {
      return NextResponse.json({ ok: false });
    }
    await prisma.searchLog.create({ data: { query: query.trim().toLowerCase() } });
  } catch { /* fire and forget */ }
  return NextResponse.json({ ok: true });
}
