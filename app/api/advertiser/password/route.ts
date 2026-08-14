import { NextResponse, type NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getAdvertiserSession } from "@/lib/ads/advertiser-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Longueur minimale. Le mot de passe temporaire en fait 12, on n'exige pas plus. */
const MIN_LENGTH = 10;

/**
 * Changement de mot de passe.
 *
 * Sert aussi bien au passage obligatoire de la première connexion qu'aux
 * changements ultérieurs : même contrôle, même code. L'ancien mot de passe est
 * exigé dans les deux cas — une session volée ne doit pas suffire à verrouiller
 * le compte de son propriétaire.
 */
export async function POST(req: NextRequest) {
  const session = await getAdvertiserSession();
  if (!session) return NextResponse.json({ error: "Session expirée." }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as {
    currentPassword?: unknown;
    newPassword?: unknown;
  };
  const current = String(body.currentPassword ?? "");
  const next = String(body.newPassword ?? "");

  if (next.length < MIN_LENGTH) {
    return NextResponse.json(
      { error: `Le nouveau mot de passe doit contenir au moins ${MIN_LENGTH} caractères.` },
      { status: 400 },
    );
  }
  if (next === current) {
    return NextResponse.json(
      { error: "Choisissez un mot de passe différent du précédent." },
      { status: 400 },
    );
  }

  const advertiser = await prisma.advertiser.findUnique({
    where: { id: session.advertiserId },
    select: { id: true, passwordHash: true, suspendedAt: true },
  });
  if (!advertiser?.passwordHash || advertiser.suspendedAt) {
    return NextResponse.json({ error: "Accès indisponible." }, { status: 403 });
  }

  const ok = await bcrypt.compare(current, advertiser.passwordHash);
  if (!ok) return NextResponse.json({ error: "Mot de passe actuel incorrect." }, { status: 400 });

  await prisma.advertiser.update({
    where: { id: advertiser.id },
    data: { passwordHash: await bcrypt.hash(next, 12), mustChangePassword: false },
  });

  return NextResponse.json({ ok: true });
}
