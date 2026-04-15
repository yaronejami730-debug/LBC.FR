import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { sendEmail } from "@/lib/email";
import { welcomeEmail } from "@/lib/emails/welcome";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  if (!rateLimit(`register:${ip}`, 5, 10 * 60 * 1000)) {
    return NextResponse.json({ error: "Trop de tentatives. Réessayez dans quelques minutes." }, { status: 429 });
  }

  const { name, email, password, isPro, siret, companyName } = await req.json();

  if (!name || !email || !password) {
    return NextResponse.json({ error: "All fields required" }, { status: 400 });
  }

  if (typeof password !== "string" || password.length < 8) {
    return NextResponse.json({ error: "Le mot de passe doit contenir au moins 8 caractères" }, { status: 400 });
  }

  if (typeof name !== "string" || name.trim().length < 2 || name.trim().length > 100) {
    return NextResponse.json({ error: "Nom invalide" }, { status: 400 });
  }

  if (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    return NextResponse.json({ error: "Email invalide" }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "Email already in use" }, { status: 409 });
  }

  // Validate SIRET uniqueness for pro accounts
  if (isPro && siret) {
    const siretUsed = await prisma.user.findUnique({ where: { siret } });
    if (siretUsed) {
      return NextResponse.json({ error: "Ce SIRET est déjà associé à un compte" }, { status: 409 });
    }
  }

  // Vérifier si cet email est pré-inscrit early adopter
  const earlyAdopter = await prisma.earlyAdopter.findUnique({
    where: { email: email.trim().toLowerCase() },
  });

  const hashed = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: {
      name,
      email,
      password: hashed,
      memberSince: new Date().getFullYear(),
      ...(isPro && siret && companyName
        ? { isPro: true, siret, companyName }
        : {}),
      ...(earlyAdopter ? { earlyAdopterDiscount: true } : {}),
    },
  });

  // Marquer l'early adopter comme réclamé
  if (earlyAdopter && !earlyAdopter.claimedAt) {
    prisma.earlyAdopter.update({
      where: { id: earlyAdopter.id },
      data: { claimedAt: new Date(), userId: user.id },
    }).catch(() => {});
  }

  // Email de bienvenue — fire and forget
  sendEmail({
    to: user.email,
    toName: user.isPro ? user.companyName ?? user.name : user.name,
    subject: "Bienvenue sur Deal & Co 🎉",
    html: welcomeEmail({ name: user.isPro ? user.companyName ?? user.name : user.name }),
  }).catch(() => {});

  return NextResponse.json({ id: user.id }, { status: 201 });
}
