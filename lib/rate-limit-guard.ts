import { NextResponse } from "next/server";
import { rateLimit } from "./rate-limit";

/**
 * Garde de débit prête à poser en tête de route.
 *
 * `rateLimit()` renvoie un booléen : chaque appelant devait donc écrire lui-même
 * le `if`, le code 429 et le message. Résultat, la fonction existait depuis
 * longtemps mais n'était branchée que sur 11 routes sur 140 — le coût
 * d'écriture était supérieur au bénéfice ressenti. Une ligne suffit désormais.
 *
 * Limite volontairement large : il s'agit d'arrêter l'automate qui publie
 * quatre cents annonces dans la nuit, pas de gêner quelqu'un qui vide son
 * grenier un dimanche.
 *
 * ⚠️ Le compteur est en mémoire, donc par instance (cf. `lib/rate-limit.ts`).
 * Il stoppe l'abus concentré, pas une attaque répartie. Un magasin partagé
 * (Redis) reste à faire pour une garantie stricte.
 */
export const QUOTAS = {
  /** Publication d'annonces : le vecteur n°1 de spam SEO sur une marketplace. */
  listingCreate: { limit: 20, windowMs: 60 * 60 * 1000, message: "Trop d'annonces publiées coup sur coup. Réessayez dans une heure." },
  /** Ouverture de conversations : sert à arroser les vendeurs en masse. */
  conversationCreate: { limit: 30, windowMs: 60 * 60 * 1000, message: "Trop de conversations ouvertes coup sur coup." },
  /** Réservations : une place bloquée est une place volée à un vrai client. */
  bookingCreate: { limit: 15, windowMs: 60 * 60 * 1000, message: "Trop de réservations coup sur coup." },
  /** Traitements coûteux en CPU ou facturés à l'appel. */
  compute: { limit: 40, windowMs: 60 * 60 * 1000, message: "Limite d'utilisation atteinte, réessayez plus tard." },
  /** Formulaires publics sans compte. */
  publicForm: { limit: 5, windowMs: 15 * 60 * 1000, message: "Trop de tentatives. Réessayez dans quelques minutes." },
  /** Gestes touchant au mot de passe : on borne le tâtonnement. */
  credential: { limit: 10, windowMs: 15 * 60 * 1000, message: "Trop de tentatives. Réessayez dans quelques minutes." },
} as const;

/**
 * Renvoie une réponse 429 quand le quota est dépassé, `null` sinon.
 *
 * @param quota  Clé de `QUOTAS` — le nom dit l'intention, pas le chiffre.
 * @param identity Compte connecté de préférence, IP à défaut. Un compte est
 *   plus stable qu'une IP : en mobile l'IP change de cellule en cellule, et
 *   deux personnes derrière la même box partagent la leur.
 */
export function guardRate(quota: keyof typeof QUOTAS, identity: string): NextResponse | null {
  const { limit, windowMs, message } = QUOTAS[quota];
  if (rateLimit(`${quota}:${identity}`, limit, windowMs)) return null;
  return NextResponse.json({ error: message }, { status: 429 });
}
