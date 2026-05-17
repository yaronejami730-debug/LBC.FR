/**
 * Réputation et validation des numéros de téléphone (FR).
 *
 * Trois signaux :
 *   1. numéro invalide / impossible        → faux contact probable
 *   2. préfixe surtaxé ou non-géographique  → vendeur particulier suspect
 *   3. numéro réutilisé sur plusieurs comptes → multi-comptes / fraude organisée
 *
 * Le numéro n'est jamais stocké en clair côté réputation : on indexe son
 * hash (`Listing.phoneHash`), conforme RGPD et suffisant pour le matching.
 */

import type { PrismaClient } from "@prisma/client";
import { createHash } from "crypto";
import { signal, type SignalHit } from "@/lib/moderation/risk-engine";

/**
 * Normalise un numéro FR au format E.164 (`+33XXXXXXXXX`).
 * Renvoie `null` si le numéro est inexploitable.
 */
export function normalizePhone(raw: string): string | null {
  const digits = (raw ?? "").replace(/\D/g, "");
  if (!digits) return null;

  let national: string;
  if (digits.startsWith("0033")) national = digits.slice(4);
  else if (digits.startsWith("33") && digits.length === 11) national = digits.slice(2);
  else if (digits.startsWith("0") && digits.length === 10) national = digits.slice(1);
  else if (digits.length === 9) national = digits;
  else return null;

  // 9 chiffres, premier chiffre 1–9 (le 0 de tête a été retiré).
  if (national.length !== 9 || !/^[1-9]/.test(national)) return null;
  return `+33${national}`;
}

/** Hash SHA-256 tronqué d'un numéro normalisé — clé de réputation. */
export function hashPhone(normalized: string): string {
  return createHash("sha256").update(normalized).digest("hex").slice(0, 32);
}

export type PhoneCheck = {
  normalized: string | null;
  hash: string | null;
  valid: boolean;
  category: "mobile" | "fixe" | "voip" | "surtaxe" | "invalide";
};

/**
 * Analyse statique d'un numéro : validité + nature du préfixe.
 *
 * Préfixes FR (après `+33`) :
 *   6,7 → mobile · 1–5 → fixe géographique
 *   8   → numéro surtaxé (atypique pour un vendeur particulier)
 *   9   → non-géographique / VoIP (souvent légitime, signal faible)
 */
export function checkPhone(raw: string): PhoneCheck {
  const normalized = normalizePhone(raw);
  if (!normalized) {
    return { normalized: null, hash: null, valid: false, category: "invalide" };
  }
  const lead = normalized[3]; // premier chiffre national
  let category: PhoneCheck["category"];
  if (lead === "6" || lead === "7") category = "mobile";
  else if (lead >= "1" && lead <= "5") category = "fixe";
  else if (lead === "8") category = "surtaxe";
  else category = "voip"; // 9

  return { normalized, hash: hashPhone(normalized), valid: true, category };
}

/** Signal de risque dérivé de l'analyse statique. `null` si rien à signaler. */
export function phoneStaticSignal(check: PhoneCheck, rawProvided: boolean): SignalHit | null {
  if (!rawProvided) return null;
  if (!check.valid) {
    return signal("phone.invalid", "scam", 30, { reason: "numero_impossible" });
  }
  if (check.category === "surtaxe") {
    return signal("phone.premium", "scam", 35, { reason: "prefixe_surtaxe_08" });
  }
  if (check.category === "voip") {
    return signal("phone.voip", "scam", 15, { reason: "prefixe_non_geographique_09" });
  }
  return null;
}

/**
 * Signal de réutilisation : le même numéro apparaît-il sur les annonces
 * d'autres comptes ? Réutilisation large = multi-comptes / fraude organisée.
 */
export async function phoneReuseSignal(
  prisma: PrismaClient,
  phoneHash: string,
  ownerId: string,
): Promise<SignalHit | null> {
  const rows = await prisma.listing.findMany({
    where: { phoneHash, deletedAt: null, userId: { not: ownerId } },
    select: { userId: true },
    take: 200,
  });
  const otherUsers = new Set(rows.map((r) => r.userId));
  if (otherUsers.size === 0) return null;

  // +15 par compte distinct partageant le numéro (plafonné).
  const score = Math.min(70, otherUsers.size * 15);
  return signal(
    otherUsers.size >= 3 ? "phone.ring" : "phone.shared",
    otherUsers.size >= 3 ? "fraud_ring" : "scam",
    score,
    { otherAccounts: otherUsers.size },
  );
}
