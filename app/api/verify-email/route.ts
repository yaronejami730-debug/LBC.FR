import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { welcomeEmail } from "@/lib/emails/welcome";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  const base = process.env.NEXTAUTH_URL ?? "https://www.dealandcompany.fr";

  if (!token) {
    return NextResponse.redirect(`${base}/login?error=token_invalide`);
  }

  const record = await prisma.emailVerificationToken.findUnique({ where: { token }, include: { user: true } });

  if (!record) {
    return NextResponse.redirect(`${base}/login?error=token_invalide`);
  }

  if (record.expiresAt < new Date()) {
    await prisma.emailVerificationToken.delete({ where: { token } });
    return NextResponse.redirect(`${base}/verifier-email?expired=1&email=${encodeURIComponent(record.user.email)}`);
  }

  await prisma.$transaction([
    prisma.user.update({ where: { id: record.userId }, data: { verified: true } }),
    prisma.emailVerificationToken.delete({ where: { token } }),
  ]);

  const displayName = record.user.isPro ? record.user.companyName ?? record.user.name : record.user.name;
  sendEmail({
    to: record.user.email,
    toName: displayName,
    subject: "Bienvenue sur Deal & Co 🎉",
    html: welcomeEmail({ name: displayName }),
  }).catch(() => {});

  return NextResponse.redirect(`${base}/login?verified=1`);
}
