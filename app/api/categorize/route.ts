
/**
 * POST /api/categorize
 *
 * Pipeline de catégorisation server-side, sans IA générative :
 *   texte → expansion abréviations → classifier (index inversé) → attributs
 *
 * Body : { title: string, description?: string }
 * Réponse : { category, attributes, normalized }
 */

import { NextResponse } from "next/server";
import { classifyTitle } from "@/lib/category/engine";
import { extractAttributes } from "@/lib/extract-attributes";
import { expandAbbreviations } from "@/lib/normalize-fr";
import { guardRate } from "@/lib/rate-limit-guard";
import { getClientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const limited = guardRate("compute", getClientIp(req));
  if (limited) return limited;

  const { title, description } = (body ?? {}) as { title?: unknown; description?: unknown };
  const titleStr = typeof title === "string" ? title : "";
  const descStr = typeof description === "string" ? description : "";

  if (titleStr.trim().length < 3) {
    return NextResponse.json({ error: "Titre trop court (min. 3 caractères)" }, { status: 400 });
  }

  const detection = classifyTitle(titleStr, descStr);
  const attributes = extractAttributes(`${titleStr} ${descStr}`);

  return NextResponse.json({
    category: detection
      ? {
        id: detection.categoryId,
        subcategory: detection.subcategory,
        confidence: detection.confidence,
      }
      : null,
    attributes,
    normalized: expandAbbreviations(`${titleStr} ${descStr}`),
  });
}
