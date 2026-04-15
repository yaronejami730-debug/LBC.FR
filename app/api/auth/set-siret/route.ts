import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const { userId, siret, companyName } = await req.json();

  if (!userId || !siret) {
    return NextResponse.json({ error: "Données manquantes" }, { status: 400 });
  }

  const cleanSiret = String(siret).replace(/\s/g, "");
  if (!/^\d{14}$/.test(cleanSiret)) {
    return NextResponse.json({ error: "SIRET invalide (14 chiffres requis)" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, isPro: true } });
  if (!user || !user.isPro) {
    return NextResponse.json({ error: "Utilisateur introuvable ou non professionnel" }, { status: 404 });
  }

  // Check SIRET not already taken by another account
  const conflict = await prisma.user.findFirst({ where: { siret: cleanSiret, id: { not: userId } } });
  if (conflict) {
    return NextResponse.json({ error: "Ce SIRET est déjà associé à un autre compte" }, { status: 409 });
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      siret: cleanSiret,
      companyName: companyName?.trim() || null,
    },
  });

  return NextResponse.json({ ok: true });
}
