import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { siret, companyName } = await req.json();

  if (!siret || !companyName) {
    return NextResponse.json({ error: "Données manquantes" }, { status: 400 });
  }

  // Check SIRET not already used
  const existing = await prisma.user.findUnique({ where: { siret } });
  if (existing && existing.id !== session.user.id) {
    return NextResponse.json({ error: "Ce SIRET est déjà associé à un compte" }, { status: 409 });
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { isPro: true, siret, companyName },
  });

  return NextResponse.json({ ok: true });
}
