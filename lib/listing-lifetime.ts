/**
 * Durée de vie d'une annonce — source unique.
 *
 * La valeur était recopiée à cinq endroits (cron de purge, compte à rebours de
 * la fiche, page de republication, email d'expiration, CGU). Une modification
 * en oubliait forcément un, et le site annonçait une durée que le cron ne
 * respectait pas.
 *
 * 300 jours : une annonce qui disparaît au bout de trois mois casse le
 * référencement de la page au moment précis où elle commence à remonter, et
 * oblige le vendeur à republier pour rien. Le délai de grâce de 2 jours entre
 * l'email d'avertissement et la suppression définitive reste inchangé — c'est
 * lui qui laisse au vendeur la possibilité de republier.
 */

export const LISTING_LIFETIME_DAYS = 300;

/** Jours entre l'email « votre annonce expire » et la suppression définitive. */
export const LISTING_GRACE_DAYS = 2;

const DAY_MS = 24 * 60 * 60 * 1000;

export const LISTING_LIFETIME_MS = LISTING_LIFETIME_DAYS * DAY_MS;
export const LISTING_GRACE_MS = LISTING_GRACE_DAYS * DAY_MS;

/** Date d'expiration théorique d'une annonce publiée à `createdAt`. */
export function listingExpiresAt(createdAt: Date | string | number): Date {
  return new Date(new Date(createdAt).getTime() + LISTING_LIFETIME_MS);
}

/** Date de suppression définitive — expiration + délai de grâce. */
export function listingPurgeAt(createdAt: Date | string | number): Date {
  return new Date(new Date(createdAt).getTime() + LISTING_LIFETIME_MS + LISTING_GRACE_MS);
}

/** Millisecondes restantes avant expiration. Négatif si déjà expirée. */
export function listingTimeLeftMs(createdAt: Date | string | number, now: number = Date.now()): number {
  return listingExpiresAt(createdAt).getTime() - now;
}

/**
 * Compte à rebours prêt à afficher : « 287 j », « 14 h », « Expirée ».
 * Volontairement court — la colonne d'un tableau d'administration n'a pas la
 * place d'une phrase.
 */
export function formatTimeLeft(createdAt: Date | string | number, now: number = Date.now()): string {
  const ms = listingTimeLeftMs(createdAt, now);
  if (ms <= 0) {
    const purgeIn = listingPurgeAt(createdAt).getTime() - now;
    return purgeIn > 0 ? `Purge dans ${Math.ceil(purgeIn / (60 * 60 * 1000))} h` : "Expirée";
  }
  const days = Math.floor(ms / DAY_MS);
  if (days >= 1) return `${days} j`;
  const hours = Math.floor(ms / (60 * 60 * 1000));
  if (hours >= 1) return `${hours} h`;
  return `${Math.max(1, Math.floor(ms / (60 * 1000)))} min`;
}

/** Palier d'alerte, pour colorer l'affichage sans dupliquer les seuils. */
export function timeLeftLevel(
  createdAt: Date | string | number,
  now: number = Date.now(),
): "ok" | "bientot" | "urgent" | "expire" {
  const ms = listingTimeLeftMs(createdAt, now);
  if (ms <= 0) return "expire";
  if (ms <= 7 * DAY_MS) return "urgent";
  if (ms <= 30 * DAY_MS) return "bientot";
  return "ok";
}
