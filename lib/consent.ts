/**
 * Constantes du consentement aux cookies.
 *
 * Dans un fichier à part parce qu'un Route Handler Next.js n'accepte que des
 * exports connus — les méthodes HTTP et quelques options de segment. Y ajouter
 * une constante fait échouer la compilation. Les partager ici évite surtout de
 * réécrire le nom du cookie à trois endroits : le bandeau qui le lit, la route
 * qui le pose, et le script de Consent Mode qui décide d'activer la mesure
 * d'audience. Une faute de frappe dans l'un des trois redemanderait son
 * consentement au visiteur à chaque visite, sans erreur visible nulle part.
 */

export const CONSENT_COOKIE = "consent_v1";

/** 13 mois — durée maximale recommandée par la CNIL. */
export const CONSENT_MAX_AGE = 60 * 60 * 24 * 390;

export type ConsentState = "granted" | "denied";

export function isConsentState(value: unknown): value is ConsentState {
  return value === "granted" || value === "denied";
}
