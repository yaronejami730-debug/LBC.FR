/**
 * Réglages de la collecte de satisfaction.
 *
 * Tout ce qui est un choix — un délai, un seuil, une cadence — vit ici. Aucun
 * `90`, `150`, `24` ou `3` ne doit apparaître ailleurs dans le code : le jour
 * où le rythme change, il n'y a qu'un fichier à ouvrir, et l'écran
 * d'administration lit les mêmes valeurs que la tâche planifiée.
 *
 * Le principe qui gouverne l'ensemble : **pertinence avant fréquence**. Chaque
 * réglage ci-dessous existe pour empêcher un envoi, jamais pour en provoquer un.
 */

export const SATISFACTION_CONFIG = {
  /** Coupe-circuit global. À `false`, plus rien ne part, ni périodique ni activité. */
  enabled: true,

  /** La campagne périodique est-elle active ? */
  periodicEnabled: true,
  /** La campagne déclenchée par l'activité est-elle active ? */
  activityEnabled: true,

  /**
   * Fenêtre de la campagne périodique, en jours.
   *
   * Une valeur unique ferait revenir tout le monde le même jour, année après
   * année. On tire une date dans l'intervalle, ce qui étale naturellement les
   * envois et rend la sollicitation moins mécanique.
   */
  periodicMinDays: 90,
  periodicMaxDays: 150,

  /**
   * Nombre d'annonces publiées qui rend une sollicitation pertinente.
   *
   * En dessous, le compte n'a pas assez utilisé la plateforme pour avoir un
   * avis construit sur la publication.
   */
  activityThreshold: 3,

  /**
   * Fenêtre de regroupement, en heures.
   *
   * C'est le cœur de l'anti-spam. Le seuil atteint ne déclenche pas un envoi :
   * il ouvre une fenêtre. Tout ce qui se passe pendant cette fenêtre — trois
   * annonces de plus, dix — se fond dans la même sollicitation. Un vendeur qui
   * met son stock en ligne un matin reçoit un email, pas sept.
   */
  burstWindowHours: 24,

  /**
   * Silence obligatoire après un envoi, en jours. Partagé par les deux
   * déclencheurs : c'est ce qui empêche l'activité de rattraper le périodique.
   */
  cooldownDays: 90,

  /**
   * Envois maximum par exécution.
   *
   * Étale la campagne périodique sur plusieurs jours plutôt que d'expédier un
   * lot massif d'un coup : moins de pics chez Brevo, des réponses réparties
   * dans le temps, et aucune sensation de campagne de masse.
   */
  maxSendsPerRun: 40,

  /** Ancienneté minimale du compte, en jours. On ne demande pas son avis à qui vient d'arriver. */
  minAccountAgeDays: 14,

  /** Validité du lien contenu dans l'email, en jours. */
  tokenLifetimeDays: 60,
} as const;

/** Type d'email — sert au tracking, aux préférences et à la cadence. */
export const SATISFACTION_EMAIL_TYPE = "satisfaction";

/** Ce qui a motivé la sollicitation. */
export type SatisfactionTrigger = "PERIODIC" | "ACTIVITY";

/** Où en est la campagne. */
export type SatisfactionStatus = "PENDING" | "SCHEDULED" | "SENT" | "CANCELLED" | "FAILED";

/**
 * Les états qui occupent la place.
 *
 * Un compte ne peut avoir qu'une campagne dans l'un de ces états à la fois —
 * c'est une contrainte de base, pas une convention. Deux exécutions
 * simultanées du planificateur ne peuvent donc pas créer deux sollicitations.
 */
export const OPEN_STATUSES: SatisfactionStatus[] = ["PENDING", "SCHEDULED"];

/**
 * Date d'envoi tirée dans la fenêtre périodique.
 *
 * Le tirage se fait à partir de l'identifiant du compte plutôt qu'au hasard :
 * deux exécutions du planificateur pour le même compte donnent la même date,
 * ce qui garde le système rejouable et prévisible.
 */
export function periodicDelayDays(
  userId: string,
  cfg: { periodicMinDays: number; periodicMaxDays: number } = SATISFACTION_CONFIG,
): number {
  const { periodicMinDays, periodicMaxDays } = cfg;
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash * 31 + userId.charCodeAt(i)) % 100_000;
  }
  return periodicMinDays + (hash % (periodicMaxDays - periodicMinDays + 1));
}

/**
 * Forme des réglages modifiables depuis l'administration.
 *
 * Déclarée ici, avec les bornes, parce que le formulaire d'administration est
 * un composant client : importer `settings.ts` — qui ouvre Prisma — y ferait
 * entrer le pilote PostgreSQL dans le bundle du navigateur, et la compilation
 * échoue sur `Can't resolve 'fs'`.
 */
export type SatisfactionSettings = {
  enabled: boolean;
  periodicEnabled: boolean;
  activityEnabled: boolean;
  periodicMinDays: number;
  periodicMaxDays: number;
  activityThreshold: number;
  burstWindowHours: number;
  cooldownDays: number;
  maxSendsPerRun: number;
};

/**
 * Limites acceptables. Le minimum protège les destinataires, le maximum évite
 * les valeurs absurdes qui feraient croire à une panne — un silence de dix ans
 * ressemble à un système éteint.
 *
 * Ces bornes existent parce que ce formulaire décide du volume d'emails envoyés
 * à toute la base : une faute de frappe ne doit pas pouvoir la transformer en
 * campagne de masse.
 */
export const BOUNDS = {
  periodicMinDays: { min: 30, max: 365 },
  periodicMaxDays: { min: 30, max: 730 },
  /** Sous trois annonces, le compte n'a pas assez publié pour avoir un avis. */
  activityThreshold: { min: 3, max: 50 },
  /** Moins d'une heure de regroupement ne regrouperait plus rien. */
  burstWindowHours: { min: 1, max: 168 },
  /** Le silence est la protection principale : jamais moins d'un mois. */
  cooldownDays: { min: 30, max: 730 },
  maxSendsPerRun: { min: 1, max: 500 },
} as const;

export type BoundedKey = keyof typeof BOUNDS;
