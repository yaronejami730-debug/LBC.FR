import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { sendEmail } from "@/lib/email";
import { verifyEmail } from "@/lib/emails/verify-email";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { signMobileToken } from "@/lib/mobile-auth";

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    if (!rateLimit(`mobile-register:${ip}`, 5, 10 * 60 * 1000)) {
      return NextResponse.json({ error: "Trop de tentatives. Réessayez plus tard." }, { status: 429 });
    }

    const { name, email, password, isPro, siret, companyName, marketingConsent } = await req.json();

    if (!name || !email || !password) {
      return NextResponse.json({ error: "Champs requis manquants" }, { status: 400 });
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

    const normalizedEmail = email.trim().toLowerCase();
    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) {
      return NextResponse.json({ error: "Email déjà utilisé" }, { status: 409 });
    }
    if (isPro && siret) {
      const siretUsed = await prisma.user.findUnique({ where: { siret } });
      if (siretUsed) {
        return NextResponse.json({ error: "Ce SIRET est déjà associé à un compte" }, { status: 409 });
      }
    }

    const earlyAdopter = await prisma.earlyAdopter.findUnique({ where: { email: normalizedEmail } });

    const hashed = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: {
        name,
        email: normalizedEmail,
        password: hashed,
        memberSince: new Date().getFullYear(),
        consentGivenAt: new Date(),
        marketingConsent: marketingConsent === true,
        ...(isPro && siret && companyName ? { isPro: true, siret, companyName } : {}),
        ...(earlyAdopter ? { earlyAdopterDiscount: true } : {}),
      },
    });

    if (earlyAdopter && !earlyAdopter.claimedAt) {
      prisma.earlyAdopter.update({
        where: { id: earlyAdopter.id },
        data: { claimedAt: new Date(), userId: user.id },
      }).catch(() => {});
    }

    const verifToken = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await prisma.emailVerificationToken.create({ data: { userId: user.id, token: verifToken, expiresAt } });

    const displayName = user.isPro ? user.companyName ?? user.name : user.name;
    sendEmail({
      to: user.email,
      toName: displayName,
      subject: "Confirmez votre adresse email — Deal & Co",
      html: verifyEmail({ name: displayName, code: verifToken }),
    }).catch((err) => console.error("[MOBILE REGISTER] sendEmail failed:", err?.message ?? err));

    const { token, expiresIn } = await signMobileToken({
      sub: user.id,
      email: user.email,
      role: user.role,
      isPro: user.isPro,
    });

    return NextResponse.json({
      token,
      expiresIn,
      pendingVerification: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        isPro: user.isPro,
        emailVerified: false,
        companyName: user.companyName,
      },
    }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/mobile/auth/register]", err);
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
  }
}
