import { NextRequest, NextResponse } from "next/server";
import { detectCategory } from "@/lib/autoCategory";
import { CATEGORIES } from "@/lib/categories";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const title = (searchParams.get("title") || "").trim();
  if (!title) return NextResponse.json({ categoryLabel: null, subcategory: null });

  const res = detectCategory(title);
  if (!res) return NextResponse.json({ categoryLabel: null, subcategory: null, confidence: 0 });

  const cat = CATEGORIES.find((c) => c.id === res.categoryId);
  return NextResponse.json({
    categoryLabel: cat?.label ?? null,
    subcategory: res.subcategory,
    confidence: res.confidence,
  });
}
