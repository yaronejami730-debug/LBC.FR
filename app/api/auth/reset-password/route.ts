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

  await Promise.all([
    prisma.user.update({ where: { id: record.userId }, data: { password: hashed } }),
    prisma.passwordResetToken.update({ where: { id: record.id }, data: { used: true } }),
  ]);

  const user = await prisma.user.findUnique({ where: { id: record.userId } });
  if (user) {
    await sendEmail({
      to: user.email,
      toName: user.name,
      subject: "Votre mot de passe a été modifié — Deal & Co",
      html: passwordChangedEmail({ name: user.name }),
    });
  }

  return NextResponse.json({ ok: true });
}
