/**
 * Inspecteur du moteur comportemental — admin uniquement.
 * GET /api/behavioral/decide?userId=... → renvoie la décision (lecture seule,
 * pas d'envoi d'email). Sert à debugger les nudges sans déclencher d'effet.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { decideForUser } from "@/lib/behavioral/decide";

async function isAdmin(): Promise<boolean> {
  const session = await auth();
  if (!session?.user?.id) return false;
  const user = await prisma.user.findUnique({
    where: { id: session.user.id as string },
    select: { role: true },
  });
  return user?.role === "ADMIN";
}

export async function GET(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const userId = new URL(req.url).searchParams.get("userId");
  if (!userId) {
    return NextResponse.json({ error: "userId manquant" }, { status: 400 });
  }
  const decision = await decideForUser(prisma, userId);
  return NextResponse.json(decision);
}
