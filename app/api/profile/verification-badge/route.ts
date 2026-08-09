import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Demande — ou refus — du badge de vérification.
 *
 * Le badge n'est pas accordé à la seconde où l'utilisateur dit oui : il arrive
 * après BADGE_DELAY_DAYS jours (cf. /api/cron/verification-badge). Ce délai
 * sert à voir venir : un compte qui dérape entre-temps ne l'obtient jamais, et
 * la modération peut le retirer à tout moment ensuite.
 *
 * Ouvert aux particuliers comme aux professionnels — dans les deux cas, le
 * badge dit la même chose : l'identité derrière le compte a été vérifiée.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { accept } = await req.json().catch(() => ({ accept: false }));

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { professionalStatus: true, emailVerified: true, verified: true, badgeRequestedAt: true },
  });
  if (!user) return NextResponse.json({ error: "Compte introuvable" }, { status: 404 });

  if (!accept) {
    // Refus explicite : on ne repose plus la question, sans rien accorder.
    await prisma.user.update({
      where: { id: session.user.id },
      data: { badgeRequestedAt: null, badgeGrantedAt: null },
    });
    return NextResponse.json({ ok: true, requested: false });
  }

  // Le badge suppose une identité vérifiée : compte professionnel approuvé, ou
  // au minimum une adresse email confirmée pour un particulier.
  if (user.professionalStatus !== "APPROVED" && !user.emailVerified) {
    return NextResponse.json(
      { error: "Vérifiez d'abord votre adresse email pour demander le badge." },
      { status: 403 },
    );
  }

  if (user.verified) return NextResponse.json({ ok: true, alreadyGranted: true });

  await prisma.user.update({
    where: { id: session.user.id },
    data: { badgeRequestedAt: user.badgeRequestedAt ?? new Date() },
  });

  return NextResponse.json({ ok: true, requested: true });
}
