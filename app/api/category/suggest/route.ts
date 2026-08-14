import { NextResponse, type NextRequest } from "next/server";
import { classifyTitle } from "@/lib/category/engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Suggestion de catégorie à partir d'un titre.
 *
 * Route serveur, et c'est le point important : l'index pèse 537 Ko et le jeu
 * d'exemples 9,3 Mo. L'ancien chemin importait le classifieur dans un composant
 * client, donc dans le bundle du navigateur. Ici le navigateur n'envoie qu'un
 * titre et reçoit une décision.
 *
 * Aucune authentification : suggérer une catégorie ne révèle rien qui ne soit
 * déjà public, et l'imposer bloquerait la publication d'un visiteur qui n'a pas
 * encore de compte. Le débit est borné pour éviter qu'on s'en serve comme d'un
 * service de classification gratuit.
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { title?: unknown; description?: unknown };
  const title = String(body.title ?? "").slice(0, 200);
  const description = String(body.description ?? "").slice(0, 500);

  if (title.trim().length < 3) {
    return NextResponse.json({ result: null });
  }

  const result = classifyTitle(title, description);
  return NextResponse.json({ result }, { headers: { "Cache-Control": "no-store" } });
}
