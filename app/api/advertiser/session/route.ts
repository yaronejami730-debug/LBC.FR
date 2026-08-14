import { NextResponse, type NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getClientIp, rateLimit } from "@/lib/rate-limit";
import {
  ADVERTISER_COOKIE,
  ADVERTISER_COOKIE_OPTIONS,
  createAdvertiserToken,
} from "@/lib/ads/advertiser-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Connexion d'un annonceur.
 *
 * Réponse volontairement identique que l'identifiant soit inconnu, le mot de
 * passe faux ou le compte suspendu : distinguer les trois donnerait à qui
 * essaie une liste d'identifiants valides.
 */
export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  if (!rateLimit(`advertiser-login:${ip}`, 10, 10 * 60 * 1000)) {
    return NextResponse.json(
      { error: "Trop de tentatives. Réessayez dans quelques minutes." },
      { status: 429 },
    );
  }

  const body = (await req.json().catch(() => ({}))) as { loginId?: unknown; password?: unknown };
  const loginId = String(body.loginId ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  const refused = NextResponse.json({ error: "Identifiant ou mot de passe incorrect." }, { status: 401 });

  if (!loginId || !password) return refused;

  const advertiser = await prisma.advertiser.findUnique({
    where: { loginId },
    select: { id: true, passwordHash: true, suspendedAt: true, mustChangePassword: true },
  });
  if (!advertiser?.passwordHash || advertiser.suspendedAt) return refused;

  const ok = await bcrypt.compare(password, advertiser.passwordHash);
  if (!ok) return refused;

  await prisma.advertiser.update({
    where: { id: advertiser.id },
    data: { lastLoginAt: new Date() },
  });

  const jar = await cookies();
  jar.set(ADVERTISER_COOKIE, createAdvertiserToken(advertiser.id), ADVERTISER_COOKIE_OPTIONS);

  return NextResponse.json({
    ok: true,
    // Le client sait ainsi où l'envoyer : l'espace reste fermé tant que le mot
    // de passe temporaire n'a pas été remplacé.
    mustChangePassword: advertiser.mustChangePassword,
  });
}

/** Déconnexion. */
export async function DELETE() {
  const jar = await cookies();
  jar.delete(ADVERTISER_COOKIE);
  return NextResponse.json({ ok: true });
}
