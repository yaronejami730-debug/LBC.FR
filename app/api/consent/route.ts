/**
 * Enregistrement du choix de consentement aux cookies.
 *
 * Le cookie est posé **par le serveur**, et c'est tout l'intérêt de cette
 * route. Un cookie écrit en JavaScript (`document.cookie`) est plafonné à
 * 7 jours par la protection anti-pistage de Safari, quelle que soit la durée
 * demandée. Le bandeau annonce « votre choix est conservé 13 mois » : sans
 * en-tête `Set-Cookie` venant du serveur, cette phrase était fausse pour tous
 * les visiteurs Safari, qui revoyaient le bandeau une semaine plus tard.
 *
 * Le cookie n'est délibérément pas `httpOnly` : le script de Consent Mode doit
 * le relire pour initialiser gtag avant le chargement de la page. Il ne contient
 * qu'un mot — `granted` ou `denied` — aucune donnée personnelle, aucun
 * identifiant. Le rendre lisible ne révèle donc rien.
 *
 * Aucune écriture en base : identifier un visiteur anonyme pour retenir son
 * refus des traceurs demanderait précisément de le tracer. Le cookie est ici la
 * réponse juste, pas un pis-aller.
 */

import { NextRequest, NextResponse } from "next/server";
import { CONSENT_COOKIE, CONSENT_MAX_AGE, isConsentState } from "@/lib/consent";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let value: unknown;
  try {
    ({ value } = await req.json());
  } catch {
    return NextResponse.json({ error: "Corps de requête illisible" }, { status: 400 });
  }

  if (!isConsentState(value)) {
    return NextResponse.json({ error: "Valeur de consentement invalide" }, { status: 400 });
  }

  const res = NextResponse.json({ ok: true, value });

  res.cookies.set({
    name: CONSENT_COOKIE,
    value,
    maxAge: CONSENT_MAX_AGE,
    path: "/",
    sameSite: "lax",
    httpOnly: false,
    // `Secure` uniquement en HTTPS. Un cookie `Secure` posé sur une origine en
    // clair est rejeté sans le moindre avertissement : c'était le cas en
    // développement sur l'IP du réseau local, où le bandeau réapparaissait à
    // chaque rechargement parce que le choix n'était jamais enregistré.
    secure: req.nextUrl.protocol === "https:",
  });

  return res;
}
