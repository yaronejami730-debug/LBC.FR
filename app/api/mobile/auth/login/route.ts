import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { signMobileToken } from "@/lib/mobile-auth";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    if (!rateLimit(`mobile-login:${ip}`, 10, 10 * 60 * 1000)) {
      return NextResponse.json({ error: "Trop de tentatives. Réessayez plus tard." }, { status: 429 });
    }

    const { email, password } = await req.json();
    if (typeof email !== "string" || typeof password !== "string") {
      return NextResponse.json({ error: "Champs requis manquants" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
    if (!user || user.bannedAt) {
      return NextResponse.json({ error: "Identifiants invalides" }, { status: 401 });
    }
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) {
      return NextResponse.json({ error: "Identifiants invalides" }, { status: 401 });
    }

    prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date(), reengagementSentAt: null },
    }).catch(() => {});

    const { token, expiresIn } = await signMobileToken({
      sub: user.id,
      email: user.email,
      role: user.role,
      isPro: user.isPro,
    });

    return NextResponse.json({
      token,
      expiresIn,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        isPro: user.isPro,
        emailVerified: !!user.emailVerified,
        companyName: user.companyName,
        verified: user.verified,
        image: user.image,
      },
    });
  } catch (err) {
    console.error("[POST /api/mobile/auth/login]", err);
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
  }
}
