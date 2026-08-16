/**
 * Lien d'accès au questionnaire.
 *
 * Le jeton porte l'identifiant de la campagne, jamais celui du compte ni son
 * adresse : une URL circule, se retrouve dans un historique de navigation, dans
 * les journaux d'un serveur mandataire, parfois dans un message transféré.
 * L'identifiant d'une campagne ne dit rien de la personne, et il n'ouvre que ce
 * formulaire.
 *
 * La signature réutilise le mécanisme HMAC déjà en place pour les liens
 * d'email — même secret, même format, même vérification à temps constant. Il n'y
 * avait aucune raison d'en écrire un second.
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import { SATISFACTION_CONFIG } from "./config";

const SECRET = process.env.AUTH_SECRET;
if (!SECRET) throw new Error("AUTH_SECRET missing");

function sign(payload: string): string {
  return createHmac("sha256", SECRET!).update(payload).digest("base64url");
}

/** Jeton signé : `<campaignId b64>.<expiration>.<signature>`. */
export function createSatisfactionToken(campaignId: string): string {
  const exp = Math.floor(Date.now() / 1000) + SATISFACTION_CONFIG.tokenLifetimeDays * 86_400;
  const payload = `${Buffer.from(campaignId).toString("base64url")}.${exp}`;
  return `${payload}.${sign(payload)}`;
}

export function verifySatisfactionToken(token: string): { campaignId: string } | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [idB64, expStr, sig] = parts;
  const expected = sign(`${idB64}.${expStr}`);

  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  // Comparaison à temps constant : une comparaison ordinaire laisse deviner la
  // signature octet par octet.
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) return null;

  try {
    return { campaignId: Buffer.from(idB64, "base64url").toString("utf8") };
  } catch {
    return null;
  }
}

export function satisfactionUrl(
  campaignId: string,
  baseUrl = "https://www.dealandcompany.fr",
): string {
  return `${baseUrl}/satisfaction?t=${createSatisfactionToken(campaignId)}`;
}
