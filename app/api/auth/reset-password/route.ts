import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { passwordChangedEmail } from "@/lib/emails/password-changed";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
  const { token, password } = await req.json();
  if (!token || !password) {
    return NextResponse.json({ error: "Données manquantes" }, { status: 400 });
  }

  const record = await prisma.passwordResetToken.findUnique({ where: { token } });

  if (!record || record.used || record.expiresAt < new Date()) {
    return NextResponse.json({ error: "Lien invalide ou expiré" }, { status: 400 });
  }

  const hashed = await bcrypt.hash(password, 12);

  const [user] = await Promise.all([
    prisma.user.update({ where: { id: record.userId }, data: { password: hashed }, select: { id: true, email: true, name: true, isPro: true, siret: true } }),
    prisma.passwordResetToken.update({ where: { id: record.id }, data: { used: true } }),
  ]);

  await sendEmail({
    to: user.email,
    toName: user.name,
    subject: "Votre mot de passe a été modifié — Deal & Co",
    html: passwordChangedEmail({ name: user.name }),
  });

  const needsSiret = user.isPro && !user.siret;
  return NextResponse.json({ ok: true, userId: user.id, needsSiret });
}
