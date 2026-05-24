import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { type } = await req.json().catch(() => ({} as { type?: string }));

  if (type !== "phone" && type !== "message") {
    return NextResponse.json({ error: "type doit être 'phone' ou 'message'" }, { status: 400 });
  }

  const field = type === "phone" ? "phoneClickCount" : "messageClickCount";
  try {
    await prisma.listing.update({
      where: { id },
      data: { [field]: { increment: 1 } },
    });
  } catch {
    return NextResponse.json({ error: "Annonce introuvable" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
