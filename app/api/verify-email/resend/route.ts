import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { verifyEmail } from "@/lib/emails/verify-email";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  if (!rateLimit(`resend-verify:${ip}`, 3, 15 * 60 * 1000)) {
    return NextResponse.json({ error: "Trop de tentatives. Réessayez dans quelques minutes." }, { status: 429 });
  }

  const { email } = await req.json();
  if (!email) return NextResponse.json({ ok: true }); // réponse silencieuse

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.verified) return NextResponse.json({ ok: true });

  await prisma.emailVerificationToken.deleteMany({ where: { userId: user.id } });

  const token = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await prisma.emailVerificationToken.create({ data: { userId: user.id, token, expiresAt } });

  const displayName = user.isPro ? user.companyName ?? user.name : user.name;

  sendEmail({
    to: user.email,
    toName: displayName,
    subject: "Confirmez votre adresse email — Deal & Co",
    html: verifyEmail({ name: displayName, code: token }),
  }).catch(() => {});

  return NextResponse.json({ ok: true });
}
