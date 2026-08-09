import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { baseEmail } from "@/lib/emails/base";

export const runtime = "nodejs";

/** Délai d'observation avant l'octroi du badge. */
export const BADGE_DELAY_DAYS = 14;

/**
 * Octroi différé du badge de vérification.
 *
 * Deux semaines séparent la demande de l'obtention : c'est le temps qu'il faut
 * pour qu'un compte qui allait mal tourner se signale — annonce refusée,
 * message bloqué, signalement. Le badge ne récompense donc pas un formulaire
 * rempli, mais deux semaines sans incident.
 */
export async function GET(req: Request) {
  const secret = new URL(req.url).searchParams.get("secret");
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const expected = process.env.CRON_SECRET;
  if (!expected || (secret !== expected && bearer !== expected)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cutoff = new Date(Date.now() - BADGE_DELAY_DAYS * 24 * 60 * 60 * 1000);

  const candidates = await prisma.user.findMany({
    where: {
      verified: false,
      badgeRequestedAt: { not: null, lte: cutoff },
      bannedAt: null,
      restrictedAt: null,
      professionalStatus: { notIn: ["SUSPENDED", "REJECTED"] },
    },
    select: {
      id: true,
      email: true,
      name: true,
      spamScore: true,
      totalReportsAgainst: true,
      rejectedListingCount: true,
    },
    take: 200,
  });

  let granted = 0;
  let held = 0;

  for (const u of candidates) {
    // Incident pendant la période d'observation : la demande reste en attente,
    // elle n'est pas refusée — la modération tranchera si besoin.
    const blockedMessages = await prisma.moderationEvent.count({
      where: { userId: u.id, action: "message_blocked" },
    });
    const risky =
      u.spamScore >= 20 ||
      u.totalReportsAgainst >= 2 ||
      u.rejectedListingCount >= 3 ||
      blockedMessages > 0;

    if (risky) {
      held++;
      continue;
    }

    await prisma.user.update({
      where: { id: u.id },
      data: { verified: true, badgeGrantedAt: new Date() },
    });
    granted++;

    if (u.email) {
      await sendEmail({
        to: u.email,
        toName: u.name,
        subject: "Votre badge de vérification est actif",
        html: baseEmail({
          title: "Badge de vérification — Deal & Co",
          heading: "Votre badge de vérification est actif",
          body: `
            <p style="margin:0 0 16px;">Bonjour ${u.name || ""},</p>
            <p style="margin:0 0 16px;">Le badge de vérification est désormais affiché sur votre profil et sur vos annonces. Il indique aux autres utilisateurs que votre identité a été vérifiée par notre équipe.</p>
            <p style="margin:0 0 16px;color:#777683;font-size:13px;">Ce badge peut être retiré à tout moment en cas de manquement aux règles de la plateforme.</p>
            <p style="margin:0;">L'équipe Deal&nbsp;&amp;&nbsp;Co</p>
          `,
          ctaLabel: "Voir mon profil",
          ctaUrl: "https://www.dealandcompany.fr/profile",
        }),
      }).catch(() => {});
    }
  }

  return NextResponse.json({ granted, held, examined: candidates.length });
}
