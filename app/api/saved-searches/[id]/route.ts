import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUserId } from "@/lib/auth-unified";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getAuthUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  // Ensure this search belongs to the user
  const existing = await prisma.savedSearch.findFirst({
    where: { id, userId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.savedSearch.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

/**
 * Marque la recherche comme consultée.
 *
 * Appelé au moment où l'on ouvre les résultats : le compteur de nouveautés
 * retombe à zéro, et repart de cet instant. C'est un `PATCH` sans corps — il
 * n'y a rien à décrire, seulement un instant à enregistrer.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await getAuthUserId(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  // `updateMany` plutôt que `update` : le filtre porte l'appartenance, donc
  // une recherche qui n'est pas la sienne ne renvoie simplement aucune ligne.
  const { count } = await prisma.savedSearch.updateMany({
    where: { id, userId },
    data: { lastViewedAt: new Date() },
  });
  if (count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ ok: true });
}
