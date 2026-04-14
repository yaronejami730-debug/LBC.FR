import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { earlyAdopterConfirmationEmail } from "@/lib/emails/early-adopter-confirmation";

export async function POST(req: NextRequest) {
  const { companyName, siret, managerFirstName, email } = await req.json();

  if (!companyName || !managerFirstName || !email) {
    return NextResponse.json({ error: "Champs requis manquants" }, { status: 400 });
  }

  const normalizedEmail = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return NextResponse.json({ error: "Adresse email invalide" }, { status: 400 });
  }

  // Vérifier si déjà inscrit
  const existing = await prisma.earlyAdopter.findUnique({
    where: { email: normalizedEmail },
  });
  if (existing) {
    return NextResponse.json(
      { error: "Cette adresse email est déjà pré-inscrite" },
      { status: 409 }
    );
  }

  // Vérifier si les 50 places sont prises
  const count = await prisma.earlyAdopter.count();
  if (count >= 50) {
    return NextResponse.json(
      { error: "Les 50 places sont malheureusement toutes prises. Restez connecté !" },
      { status: 410 }
    );
  }

  const entry = await prisma.earlyAdopter.create({
    data: {
      companyName: companyName.trim(),
      siret: siret ?? null,
      managerFirstName: managerFirstName.trim(),
      email: normalizedEmail,
    },
  });

  const position = count + 1;

  // Envoi du mail de confirmation — fire and forget
  sendEmail({
    to: normalizedEmail,
    toName: managerFirstName.trim(),
    subject: `🎯 Votre place fondateur n°${position} est confirmée — Deal & Co`,
    html: earlyAdopterConfirmationEmail({
      firstName: managerFirstName.trim(),
      companyName: companyName.trim(),
      position,
    }),
  }).catch(() => {});

  // Si un compte existe déjà avec cet email, appliquer le discount immédiatement
  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (user) {
    await Promise.all([
      prisma.user.update({
        where: { id: user.id },
        data: { earlyAdopterDiscount: true },
      }),
      prisma.earlyAdopter.update({
        where: { id: entry.id },
        data: { claimedAt: new Date(), userId: user.id },
      }),
    ]);
  }

  return NextResponse.json({ success: true, position });
}
