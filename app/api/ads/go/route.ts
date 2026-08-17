import { NextResponse, type NextRequest } from "next/server";
import { clickDestination, recordAdEvent } from "@/lib/ads/tracking";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BASE = process.env.NEXTAUTH_URL ?? "https://www.dealandcompany.fr";

/**
 * Clic sur une publicité d'e-mail.
 *
 * Le web poste son clic en arrière-plan puis ouvre la destination ; un e-mail
 * ne peut rien poster, le lien doit donc passer par le serveur, qui compte
 * puis redirige. La destination est relue en base à partir du jeton — l'URL
 * n'est jamais dans le lien, sinon n'importe qui fabriquerait un lien
 * Deal&Co menant où il veut.
 *
 * Jeton illisible ou périmé : on renvoie sur l'accueil plutôt que sur une page
 * d'erreur. Le destinataire a cliqué de bonne foi, il n'a pas à payer le prix
 * d'un e-mail vieux d'un mois.
 */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("t") ?? "";
  const sessionId = (req.nextUrl.searchParams.get("s") ?? "").slice(0, 64);
  const source = req.nextUrl.searchParams.get("src") ?? "email";

  if (!token || !sessionId) return NextResponse.redirect(BASE, { status: 302 });

  const [, destination] = await Promise.all([
    recordAdEvent({ type: "CLICK", token, sessionId }).catch(() => null),
    clickDestination(token),
  ]);

  if (!destination) return NextResponse.redirect(BASE, { status: 302 });

  const absolute = destination.startsWith("http") ? destination : `${BASE}${destination}`;
  let target: URL;
  try {
    target = new URL(absolute);
  } catch {
    return NextResponse.redirect(BASE, { status: 302 });
  }

  // Attribution : l'annonceur doit retrouver dans ses propres statistiques
  // d'où vient la visite, sans quoi il ne saura jamais ce que l'e-mail rapporte.
  target.searchParams.set("utm_source", "dealandco");
  target.searchParams.set("utm_medium", "email");
  target.searchParams.set("utm_campaign", source);

  return NextResponse.redirect(target.toString(), { status: 302 });
}
