import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const { userId, marketingConsent } = await req.json();

  if (!userId) {
    return NextResponse.json({ error: "Données manquantes" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, consentGivenAt: true },
  });
  if (!user) {
    return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });
  }

  // Idempotent — accepting again just refreshes the timestamp.
  await prisma.user.update({
    where: { id: userId },
    data: {
      consentGivenAt: new Date(),
      marketingConsent: Boolean(marketingConsent),
    },
  });

  return NextResponse.json({ ok: true });
}
