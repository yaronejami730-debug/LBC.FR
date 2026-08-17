/**
 * Vocabulaire du support, sans dépendance serveur.
 *
 * `lib/support/tickets` tire Prisma, l'envoi d'e-mails et les notifications :
 * un composant client qui aurait besoin d'une simple liste de rubriques
 * embarquerait tout cela. Les libellés vivent donc ici, et le module métier les
 * réexporte pour que rien ne change côté serveur.
 */

/** Rubriques proposées à l'ouverture. Libellés affichés tels quels. */
export const SUPPORT_CATEGORIES = [
  { value: "compte", label: "Mon compte" },
  { value: "annonce", label: "Une annonce" },
  { value: "securite", label: "Sécurité, arnaque" },
  { value: "paiement", label: "Paiement, facturation" },
  { value: "pro", label: "Compte professionnel" },
  { value: "technique", label: "Problème technique" },
  { value: "autre", label: "Autre" },
] as const;

export const SUPPORT_STATUSES = {
  OPEN: "À traiter",
  WAITING_USER: "En attente du client",
  RESOLVED: "Résolu",
  CLOSED: "Clos",
} as const;

export type SupportStatus = keyof typeof SUPPORT_STATUSES;
