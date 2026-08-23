import { NextResponse, type NextRequest } from "next/server";
import { verifyEmailPrefToken } from "@/lib/email-token";
import { isAttributionSource, recordAttribution } from "@/lib/attribution";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Enregistrement d'une réponse au sondage d'acquisition.
 *
 * ── Pourquoi un POST, alors qu'un lien d'e-mail est un GET ────────────────
 *
 * Parce que les liens d'un e-mail ne sont pas cliqués que par des humains. Les
 * antivirus de messagerie et les passerelles d'entreprise ouvrent
 * systématiquement **toutes** les adresses d'un message pour les inspecter. Si
 * la réponse s'enregistrait sur le GET du lien, chaque message analysé
 * répondrait aux six questions à la fois, et le sondage mesurerait le
 * comportement des antivirus.
 *
 * Le lien de l'e-mail ouvre donc la page avec le choix pré-sélectionné, et
 * c'est un geste dans le navigateur qui enregistre. Une frappe de plus pour la
 * personne, des données qui veulent dire quelque chose.
 *
 * L'identité vient du jeton signé, jamais du corps de la requête : sans quoi
 * n'importe qui pourrait répondre à la place de n'importe qui.
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  const claim = typeof body.token === "string" ? verifyEmailPrefToken(body.token) : null;
  if (!claim) {
    return NextResponse.json({ error: "Lien expiré ou invalide." }, { status: 401 });
  }

  const source = String(body.source ?? "");
  if (!isAttributionSource(source)) {
    return NextResponse.json({ error: "Réponse inconnue." }, { status: 400 });
  }

  await recordAttribution({
    userId: claim.userId,
    source,
    detail: typeof body.detail === "string" ? body.detail : null,
  });

  return NextResponse.json({ ok: true });
}
