import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const results = await prisma.$queryRaw<{ query: string; count: bigint }[]>`
    SELECT query, COUNT(*) as count
    FROM "SearchLog"
    WHERE "createdAt" > ${since}
      AND LENGTH(query) >= 2
    GROUP BY query
    ORDER BY count DESC
    LIMIT 6
  `;

  const popular = results.map((r) => r.query);

  // Si pas encore assez de données, compléter avec des catégories populaires
  const fallbacks = ["voiture", "iphone", "vélo", "canapé", "appartement", "moto"];
  const merged = [...new Set([...popular, ...fallbacks])].slice(0, 6);

  return NextResponse.json(merged);
}
