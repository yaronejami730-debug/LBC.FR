import { NextRequest, NextResponse } from "next/server";
import { detectCategory } from "@/lib/autoCategory";
import { extractAttributes } from "@/lib/extract-attributes";
import { CATEGORIES } from "@/lib/categories";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const title = (searchParams.get("title") || "").trim();
  if (!title) {
    return NextResponse.json({
      categoryLabel: null,
      subcategory: null,
      attributes: { brand: null, model: null, year: null },
    });
  }

  const cat = detectCategory(title);
  const attrs = extractAttributes(title);
  const found = cat ? CATEGORIES.find((c) => c.id === cat.categoryId) : null;

  return NextResponse.json({
    categoryLabel: found?.label ?? null,
    subcategory: cat?.subcategory ?? null,
    confidence: cat?.confidence ?? 0,
    attributes: {
      brand: attrs.brand,
      model: attrs.model,
      year: attrs.year,
      brands: attrs.brands.slice(0, 5),
      models: attrs.models.slice(0, 5),
    },
  });
}
