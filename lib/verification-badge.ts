/**
 * Badge de vérification — règles partagées.
 *
 * Le délai vit ici plutôt que dans la route cron : une route Next ne peut
 * exporter que ses handlers, et l'écran du profil a besoin de la même valeur
 * pour annoncer la date d'obtention.
 */

/** Jours d'observation entre la demande et l'octroi. */
export const BADGE_DELAY_DAYS = 14;
