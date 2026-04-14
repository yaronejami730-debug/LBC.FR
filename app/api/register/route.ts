import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { sendEmail } from "@/lib/email";
import { welcomeEmail } from "@/lib/emails/welcome";

export async function POST(req: NextRequest) {
  const { name, email, password, isPro, siret, companyName } = await req.json();

  if (!name || !email || !password) {
    return NextResponse.json({ error: "All fields required" }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "Email already in use" }, { status: 409 });
  }

  // Validate SIRET uniqueness for pro accounts
  if (isPro && siret) {
    const siretUsed = await prisma.user.findUnique({ where: { siret } });
    if (siretUsed) {
      return NextResponse.json({ error: "Ce SIRET est déjà associé à un compte" }, { status: 409 });
    }
  }

  const hashed = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: {
      name,
      email,
      password: hashed,
      memberSince: new Date().getFullYear(),
      ...(isPro && siret && companyName
        ? { isPro: true, siret, companyName }
        : {}),
    },
  });

  // Email de bienvenue — fire and forget
  sendEmail({
    to: user.email,
    toName: user.isPro ? user.companyName ?? user.name : user.name,
    subject: "Bienvenue sur Deal & Co 🎉",
    html: welcomeEmail({ name: user.isPro ? user.companyName ?? user.name : user.name }),
  }).catch(() => {});

  return NextResponse.json({ id: user.id }, { status: 201 });
}
