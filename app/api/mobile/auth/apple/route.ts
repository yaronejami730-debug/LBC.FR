import { NextRequest, NextResponse } from "next/server";
import { jwtVerify, createRemoteJWKSet, decodeJwt } from "jose";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { signMobileToken } from "@/lib/mobile-auth";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

const APPLE_BUNDLE_ID = "fr.dealandcompany.app";
const APPLE_ISSUER = "https://appleid.apple.com";
const JWKS = createRemoteJWKSet(new URL("https://appleid.apple.com/auth/keys"));

type AppleFullName = { givenName?: string | null; familyName?: string | null } | null;

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    if (!rateLimit(`mobile-apple:${ip}`, 10, 10 * 60 * 1000)) {
      return NextResponse.json({ error: "Trop de tentatives. Réessayez plus tard." }, { status: 429 });
    }

    const { identityToken, fullName, email: emailFromClient } = (await req.json()) as {
      identityToken?: string;
      fullName?: AppleFullName;
      email?: string | null;
    };

    if (!identityToken || typeof identityToken !== "string") {
      return NextResponse.json({ error: "identityToken manquant" }, { status: 400 });
    }

    let decodedForDebug: Record<string, unknown> = {};
    try {
      decodedForDebug = decodeJwt(identityToken) as Record<string, unknown>;
    } catch {}
    console.log("[apple] decoded token claims:", {
      iss: decodedForDebug.iss,
      aud: decodedForDebug.aud,
      sub: decodedForDebug.sub,
      email: decodedForDebug.email,
      exp: decodedForDebug.exp,
      iat: decodedForDebug.iat,
      now: Math.floor(Date.now() / 1000),
    });

    let payload: { sub?: string; email?: string; email_verified?: boolean | string };
    try {
      const { payload: p } = await jwtVerify(identityToken, JWKS, {
        issuer: APPLE_ISSUER,
        audience: APPLE_BUNDLE_ID,
      });
      payload = p as typeof payload;
    } catch (err) {
      console.error("[apple] verify failed", {
        message: err instanceof Error ? err.message : String(err),
        code: (err as { code?: string })?.code,
        expectedAud: APPLE_BUNDLE_ID,
        actualAud: decodedForDebug.aud,
        actualIss: decodedForDebug.iss,
      });
      return NextResponse.json({ error: "Token Apple invalide" }, { status: 401 });
    }

    const appleSub = payload.sub;
    if (!appleSub) {
      return NextResponse.json({ error: "Token Apple invalide" }, { status: 401 });
    }

    const email = (payload.email || emailFromClient || `${appleSub}@privaterelay.appleid.com`).toLowerCase();

    let user = await prisma.user.findUnique({ where: { email } });
    if (user?.bannedAt) {
      return NextResponse.json({ error: "Compte suspendu" }, { status: 403 });
    }

    if (!user) {
      const displayName =
        [fullName?.givenName, fullName?.familyName].filter(Boolean).join(" ").trim() ||
        email.split("@")[0];
      const randomPassword = crypto.randomBytes(32).toString("hex");
      const hashed = await bcrypt.hash(randomPassword, 12);

      user = await prisma.user.create({
        data: {
          email,
          name: displayName,
          password: hashed,
          memberSince: new Date().getFullYear(),
          consentGivenAt: new Date(),
          emailVerified: true,
        },
      });
    } else {
      prisma.user
        .update({
          where: { id: user.id },
          data: { lastLoginAt: new Date(), reengagementSentAt: null },
        })
        .catch(() => {});
    }

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
        image: user.avatar,
      },
    });
  } catch (err) {
    console.error("[POST /api/mobile/auth/apple]", err);
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
  }
}
