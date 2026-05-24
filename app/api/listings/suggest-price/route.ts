import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function median(sorted: number[]): number {
  const n = sorted.length;
  if (n === 0) return 0;
  const m = Math.floor(n / 2);
  return n % 2 === 0 ? (sorted[m - 1] + sorted[m]) / 2 : sorted[m];
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor((p / 100) * sorted.length)));
  return sorted[idx];
}

function roundPrice(n: number): number {
  if (n < 50) return Math.round(n);
  if (n < 500) return Math.round(n / 5) * 5;
  if (n < 5000) return Math.round(n / 10) * 10;
  return Math.round(n / 50) * 50;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const category = (searchParams.get("category") || "").trim();
  const subcategory = (searchParams.get("subcategory") || "").trim();
  const brand = (searchParams.get("brand") || "").trim();
  const condition = (searchParams.get("condition") || "").trim();

  if (!category) {
    return NextResponse.json({ suggested: null, range: null, sampleSize: 0 });
  }

  const where: Record<string, unknown> = {
    category,
    status: "APPROVED",
    price: { gt: 0, lt: 1_000_000 },
  };
  if (subcategory) where.subcategory = subcategory;
  if (brand) where.brand = { equals: brand, mode: "insensitive" };
  if (condition) where.condition = condition;

  // Récupère prix bruts (limite 500 pour éviter charge)
  let rows = await prisma.listing.findMany({
    where,
    select: { price: true },
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  // Si pas assez d'échantillon avec brand+condition, relâche progressivement
  if (rows.length < 10 && (brand || condition)) {
    const wider: Record<string, unknown> = { category, status: "APPROVED", price: { gt: 0, lt: 1_000_000 } };
    if (subcategory) wider.subcategory = subcategory;
    if (brand) wider.brand = { equals: brand, mode: "insensitive" };
    rows = await prisma.listing.findMany({ where: wider, select: { price: true }, orderBy: { createdAt: "desc" }, take: 500 });
  }
  if (rows.length < 10 && subcategory) {
    const wider: Record<string, unknown> = { category, status: "APPROVED", price: { gt: 0, lt: 1_000_000 } };
    if (subcategory) wider.subcategory = subcategory;
    rows = await prisma.listing.findMany({ where: wider, select: { price: true }, orderBy: { createdAt: "desc" }, take: 500 });
  }
  if (rows.length < 10) {
    rows = await prisma.listing.findMany({
      where: { category, status: "APPROVED", price: { gt: 0, lt: 1_000_000 } },
      select: { price: true },
      orderBy: { createdAt: "desc" },
      take: 500,
    });
  }

  if (rows.length < 5) {
    return NextResponse.json({ suggested: null, range: null, sampleSize: rows.length });
  }

  const sorted = rows.map((r) => r.price).sort((a, b) => a - b);
  const med = median(sorted);
  const p25 = percentile(sorted, 25);
  const p75 = percentile(sorted, 75);

  return NextResponse.json({
    suggested: roundPrice(med),
    range: { low: roundPrice(p25), high: roundPrice(p75) },
    sampleSize: sorted.length,
  });
}
