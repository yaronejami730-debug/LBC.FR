import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyEmailPrefToken } from "@/lib/email-token";

export async function POST(req: Request) {
  const { token, marketingConsent } = await req.json();

  if (typeof token !== "string" || typeof marketingConsent !== "boolean") {
    return NextResponse.json({ error: "Paramètres invalides." }, { status: 400 });
  }

  const decoded = verifyEmailPrefToken(token);
  if (!decoded) {
    return NextResponse.json({ error: "Lien invalide ou expiré." }, { status: 401 });
  }

  const user = await prisma.user.update({
    where: { id: decoded.userId },
    data: {
      marketingConsent,
      consentGivenAt: marketingConsent ? new Date() : undefined,
    },
    select: { id: true, marketingConsent: true },
  });

  return NextResponse.json({ ok: true, marketingConsent: user.marketingConsent });
}
