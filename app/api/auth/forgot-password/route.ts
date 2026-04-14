import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { resetPasswordEmail } from "@/lib/emails/reset-password";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  const { email } = await req.json();
  if (!email) return NextResponse.json({ error: "Email requis" }, { status: 400 });

  const user = await prisma.user.findUnique({ where: { email } });

  // On répond toujours OK pour ne pas révéler si l'email existe
  if (!user) return NextResponse.json({ ok: true });

  // Invalider les anciens tokens
  await prisma.passwordResetToken.updateMany({
    where: { userId: user.id, used: false },
    data: { used: true },
  });

  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1h

  await prisma.passwordResetToken.create({
    data: { userId: user.id, token, expiresAt },
  });

  const resetUrl = `${process.env.NEXTAUTH_URL ?? "https://www.dealandcompany.fr"}/reset-password?token=${token}`;

  await sendEmail({
    to: user.email,
    toName: user.name,
    subject: "Réinitialisez votre mot de passe — Deal & Co",
    html: resetPasswordEmail({ name: user.name, resetUrl }),
  });

  return NextResponse.json({ ok: true });
}
