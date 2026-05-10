import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { welcomeEmail } from "@/lib/emails/welcome";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  if (!rateLimit(`verify-code:${ip}`, 10, 15 * 60 * 1000)) {
    return NextResponse.json({ error: "Trop de tentatives. Réessayez dans quelques minutes." }, { status: 429 });
  }

  const { email, code } = await req.json();
  if (!email || !code) {
    return NextResponse.json({ error: "Email et code requis." }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return NextResponse.json({ error: "Code invalide ou expiré." }, { status: 400 });
  }

  if (user.verified) {
    return NextResponse.json({ ok: true });
  }

  const record = await prisma.emailVerificationToken.findFirst({
    where: { userId: user.id, token: code.toString() },
  });

  if (!record) {
    return NextResponse.json({ error: "Code invalide ou expiré." }, { status: 400 });
  }

  if (record.expiresAt < new Date()) {
    await prisma.emailVerificationToken.delete({ where: { id: record.id } });
    return NextResponse.json({ error: "Code expiré. Demandez-en un nouveau." }, { status: 400 });
  }

  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { verified: true } }),
    prisma.emailVerificationToken.delete({ where: { id: record.id } }),
  ]);

  const displayName = user.isPro ? user.companyName ?? user.name : user.name;
  sendEmail({
    to: user.email,
    toName: displayName,
    subject: "Bienvenue sur Deal & Co 🎉",
    html: welcomeEmail({ name: displayName }),
  }).catch(() => {});

  return NextResponse.json({ ok: true });
}
