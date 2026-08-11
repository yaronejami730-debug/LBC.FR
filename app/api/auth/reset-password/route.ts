import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { passwordChangedEmail } from "@/lib/emails/password-changed";
import bcrypt from "bcryptjs";
import { guardRate } from "@/lib/rate-limit-guard";
import { getClientIp } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  const { token, password } = await req.json();
  if (!token || !password) {
    return NextResponse.json({ error: "Données manquantes" }, { status: 400 });
  }

  // Le jeton est devinable en theorie : on empeche de le brute-forcer.
  const limited = guardRate("credential", getClientIp(req));
  if (limited) return limited;

  const record = await prisma.passwordResetToken.findUnique({ where: { token } });

  if (!record || record.used || record.expiresAt < new Date()) {
    return NextResponse.json({ error: "Lien invalide ou expiré" }, { status: 400 });
  }

  const hashed = await bcrypt.hash(password, 12);

  const [user] = await Promise.all([
    prisma.user.update({ where: { id: record.userId }, data: { password: hashed }, select: { id: true, email: true, name: true, isPro: true, siret: true, consentGivenAt: true } }),
    prisma.passwordResetToken.update({ where: { id: record.id }, data: { used: true } }),
  ]);

  await sendEmail({
    to: user.email,
    toName: user.name,
    subject: "Votre mot de passe a été modifié — Deal & Co",
    html: passwordChangedEmail({ name: user.name }),
  });

  const needsSiret = user.isPro && !user.siret;
  const needsTerms = !user.consentGivenAt;
  return NextResponse.json({ ok: true, userId: user.id, needsSiret, needsTerms });
}
