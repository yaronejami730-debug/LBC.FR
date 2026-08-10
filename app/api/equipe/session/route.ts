import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import {
  MEMBER_COOKIE,
  MEMBER_COOKIE_OPTIONS,
  createMemberToken,
  getMemberSession,
} from "@/lib/pro-member-auth";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";

/**
 * Connexion et déconnexion d'un membre d'équipe.
 *
 * Réponse volontairement identique que l'identifiant soit inconnu, l'accès
 * révoqué ou le mot de passe faux : distinguer les cas dirait à un inconnu
 * quels identifiants existent dans quel salon.
 */
const GENERIC_ERROR = "Identifiant ou mot de passe incorrect.";

export async function POST(req: NextRequest) {
  // Un identifiant court et un mot de passe de dix caractères se devinent par
  // force brute : la limite est le vrai garde-fou ici.
  const allowed = rateLimit(`equipe-login:${getClientIp(req)}`, 10, 15 * 60 * 1000);
  if (!allowed) {
    return NextResponse.json(
      { error: "Trop de tentatives. Réessayez dans quelques minutes." },
      { status: 429 },
    );
  }

  const body = await req.json().catch(() => ({}));
  const loginId = String(body.loginId ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  if (!loginId || !password) {
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 401 });
  }

  const member = await prisma.proMember.findUnique({
    where: { loginId },
    select: {
      id: true,
      passwordHash: true,
      accessRevokedAt: true,
      isActive: true,
      mustChangePassword: true,
      profile: { select: { user: { select: { bannedAt: true, professionalStatus: true } } } },
    },
  });

  const salonActive =
    member?.profile.user.professionalStatus === "APPROVED" && !member.profile.user.bannedAt;

  if (
    !member ||
    !member.passwordHash ||
    member.accessRevokedAt ||
    !member.isActive ||
    !salonActive ||
    !(await bcrypt.compare(password, member.passwordHash))
  ) {
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 401 });
  }

  await prisma.proMember.update({
    where: { id: member.id },
    data: { lastLoginAt: new Date() },
  });

  const res = NextResponse.json({ ok: true, mustChangePassword: member.mustChangePassword });
  res.cookies.set(MEMBER_COOKIE, createMemberToken(member.id), MEMBER_COOKIE_OPTIONS);
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(MEMBER_COOKIE, "", { ...MEMBER_COOKIE_OPTIONS, maxAge: 0 });
  return res;
}

/** Changement du mot de passe temporaire, par le membre lui-même. */
export async function PATCH(req: NextRequest) {
  const session = await getMemberSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const password = String(body.password ?? "");
  if (password.length < 8) {
    return NextResponse.json({ error: "Mot de passe trop court (8 caractères minimum)." }, { status: 400 });
  }

  await prisma.proMember.update({
    where: { id: session.memberId },
    data: { passwordHash: await bcrypt.hash(password, 12), mustChangePassword: false },
  });

  return NextResponse.json({ ok: true });
}
