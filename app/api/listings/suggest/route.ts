import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Suggestions d'autocomplétion : titres distincts d'annonces approuvées
// qui matchent le préfixe / contenu saisi. Léger, indexé.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim();
  if (q.length < 2) return NextResponse.json([]);

  const rows = await prisma.listing.findMany({
    where: {
      status: "APPROVED",
      deletedAt: null,
      shadowBanned: false,
      title: { contains: q, mode: "insensitive" },
    },
    select: { id: true, title: true, category: true, price: true },
    orderBy: { createdAt: "desc" },
    take: 8,
  });

  // Dédoublonne par titre + ajoute terme générique en tête si pas déjà présent.
  const seen = new Set<string>();
  const suggestions: { type: "query" | "listing"; value: string; sub?: string; id?: string }[] = [
    { type: "query", value: q },
  ];
  for (const r of rows) {
    const key = r.title.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    suggestions.push({ type: "listing", value: r.title, sub: r.category, id: r.id });
  }

  return NextResponse.json(suggestions);
}
