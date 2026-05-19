/**
 * Brouillon de publication — un seul actif par utilisateur.
 *
 * GET    → récupère le brouillon courant (reprise de saisie)
 * PUT    → upsert (sauvegarde automatique débattue côté formulaire)
 * DELETE → suppression (annonce publiée, ou abandon volontaire)
 *
 * Le brouillon alimente le moteur anti-friction : un brouillon dont
 * `updatedAt` traîne sans annonce publiée derrière = formulaire abandonné.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const MAX_PAYLOAD_BYTES = 200_000;

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ draft: null });

  const draft = await prisma.draft.findUnique({
    where: { userId: session.user.id as string },
  });
  return NextResponse.json({ draft });
}

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const payload =
    typeof body.payload === "string" ? body.payload : JSON.stringify(body.payload ?? {});
  if (payload.length > MAX_PAYLOAD_BYTES) {
    return NextResponse.json({ error: "Brouillon trop volumineux" }, { status: 413 });
  }

  const category = typeof body.category === "string" ? body.category : null;
  const step = Number.isInteger(body.step) ? body.step : 0;
  const completeness = Math.max(0, Math.min(100, Math.round(Number(body.completeness) || 0)));

  const userId = session.user.id as string;
  const draft = await prisma.draft.upsert({
    where: { userId },
    create: { userId, payload, category, step, completeness },
    update: { payload, category, step, completeness },
  });
  return NextResponse.json({ ok: true, draftId: draft.id });
}

export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await prisma.draft.deleteMany({ where: { userId: session.user.id as string } });
  return NextResponse.json({ ok: true });
}
