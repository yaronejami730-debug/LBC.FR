import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUserId } from "@/lib/auth-unified";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Journalise une correction de catégorie.
 *
 * N'enregistre que les vraies divergences : si la personne confirme ce que le
 * moteur proposait, il n'y a rien à apprendre. Sans ce filtre, la table se
 * remplirait de confirmations et masquerait le signal utile.
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  const title = String(body.title ?? "").trim().slice(0, 200);
  const chosenCategoryId = String(body.chosenCategoryId ?? "").trim();
  if (!title || !chosenCategoryId) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const suggestedCategoryId = body.suggestedCategoryId ? String(body.suggestedCategoryId) : null;
  const suggestedSubcategory = body.suggestedSubcategory ? String(body.suggestedSubcategory) : null;
  const chosenSubcategory = body.chosenSubcategory ? String(body.chosenSubcategory) : null;

  const identical =
    suggestedCategoryId === chosenCategoryId && suggestedSubcategory === chosenSubcategory;
  if (identical) return NextResponse.json({ ok: true, ignored: true });

  await prisma.categoryFeedback
    .create({
      data: {
        title,
        suggestedCategoryId,
        suggestedSubcategory,
        confidence: typeof body.confidence === "number" ? body.confidence : null,
        chosenCategoryId,
        chosenSubcategory,
        userId: await getAuthUserId(req),
      },
    })
    // Une correction perdue ne doit jamais empêcher de publier une annonce.
    .catch((err) => console.error("[category/feedback] écriture impossible", err));

  return NextResponse.json({ ok: true });
}
