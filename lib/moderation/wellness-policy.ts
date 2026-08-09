/**
 * Règles de contenu de la catégorie « Beauté & Bien-être ».
 *
 * Une rubrique massage attire deux publics : des praticiens (coiffeurs,
 * prothésistes ongulaires, masseurs, kinés) et des annonces de prostitution
 * déguisée. Le second groupe n'écrit jamais le mot : il utilise un vocabulaire
 * stable et reconnaissable — « naturiste », « body body », « finition »,
 * « sans tabou », « je reçois discrètement ». Ce module tient ce vocabulaire.
 *
 * Trois niveaux :
 *
 * - `BANNED` : rejet, sans discussion. Aucun salon déclaré n'écrit ces mots.
 * - `SUSPICIOUS` : formulations ambiguës (« reçoit 24h/24 », « hommes
 *   uniquement », « discrétion assurée »). Deux suffisent à envoyer l'annonce
 *   en validation humaine, une seule suffit dans les sous-catégories massage.
 * - Relecture systématique **en cas de doute** : une annonce de massage nette
 *   (type reconnu, aucun signal, photo présente) part en publication
 *   automatique comme les autres. Dès qu'il reste une incertitude — signal
 *   faible, type non identifié, texte trop vague, aucune photo — elle passe
 *   par un modérateur. Une relecture inutile ne coûte rien ; une annonce de
 *   prostitution publiée coûte le sérieux du site.
 *
 * Les termes bannis s'appliquent à *toutes* les catégories : déplacer
 * l'annonce dans « Services » ou « Divers » ne doit rien changer.
 */

export const WELLNESS_CATEGORY_ID = "beaute-bien-etre";
export const WELLNESS_CATEGORY_LABEL = "Beauté & Bien-être";

/**
 * Sous-catégories sensibles : ce sont celles que le vocabulaire de la
 * prostitution cible. Elles ne sont pas bloquées d'office, mais le moindre
 * doute y bascule l'annonce en relecture.
 */
export const SENSITIVE_SUBCATEGORIES = new Set([
  "Massage",
  "Spa & détente",
  "Sport & récupération",
]);

type Rule = { id: string; re: RegExp; label: string };

/**
 * Rejet immédiat. Les regex tolèrent les séparations (« body-body »,
 * « body body ») et les accents optionnels, mais restent ancrées sur des mots
 * entiers : « final » ne doit pas attraper « finalement ».
 */
const BANNED: Rule[] = [
  {
    id: "naturist",
    re: /\b(naturiste?s?|nud?iste?s?|(?:enti[eè]rement\s+)?d[ée]nud[ée]e?s?|sans\s+serviette|nu\s+int[ée]gral)\b/i,
    label: "Massage naturiste / nudité",
  },
  {
    id: "body_body",
    re: /\b(body[\s.\-_]*body|corps[\s.\-_]*[àa][\s.\-_]*corps|nuru)\b/i,
    label: "Massage body-body / corps à corps",
  },
  {
    id: "finish",
    re: /\b(finition[s]?\s*(?:manuelle|compl[èe]te|heureuse|incluse|offerte)?|happy\s*end(?:ing)?|final\s*happy|d[ée]tente\s*finale)\b/i,
    label: "« Finition » / happy ending",
  },
  {
    id: "erotic",
    re: /\b([ée]rotiques?|sensuel(?:le|s)?|coquin(?:e|s|es)?|libertin(?:e|s|es)?|tantrique|lingam|yoni|prostatique?|kama\s*sutra)\b/i,
    label: "Massage érotique / sensuel / tantrique",
  },
  {
    id: "sexual",
    re: /\b(sexe|sexuel(?:le|s|les)?|fellation|f[ée]lation|masturbation|jouissance|orgasme|[ée]jaculation|p[ée]n[ée]tration|GFE|full\s*service)\b/i,
    label: "Acte sexuel explicite",
  },
  {
    id: "prostitution",
    re: /\b(escorte?s?|escort[\s.\-_]*girls?|call[\s.\-_]*girls?|prostitu[ée]e?s?|passe\s*tarif[ée]e|moment\s*(?:intime|coquin|torride)|c[âa]lin(?:s)?\s*(?:tarif[ée]s?|payants?)|plan\s*cul)\b/i,
    label: "Prostitution / escorting",
  },
  {
    id: "no_taboo",
    re: /\b(sans\s*tabous?|tout\s*est\s*permis|open\s*mind(?:ed)?|pas\s*de\s*limites?|[àa]\s*volont[ée]\s*sans\s*limite)\b/i,
    label: "« Sans tabou » / absence de limites",
  },
  {
    id: "swinger",
    re: /\b(clubs?\s*(?:libertins?|[ée]changistes?|[àa]\s*th[èe]me\s*coquin)|sauna\s*libertin|soir[ée]es?\s*(?:[ée]changistes?|libertines?|coquines?)|partouze|gang[\s\-]?bang|[ée]changisme|candaulisme|wife\s*swap)\b/i,
    label: "Club libertin / échangiste",
  },
  {
    id: "adult_content",
    re: /\b(porno(?:graphique)?s?|porn|sex[\s\-]?(?:shop|cam|tape|toys?)|strip[\s\-]?tease|webcam\s*(?:hot|coquine)|contenu\s*adulte|only\s*fans|onlyfans)\b/i,
    label: "Contenu ou service pour adultes",
  },
  {
    id: "domination",
    re: /\b(domination|dominatrice|soumise?s?|fetichiste|f[ée]tichiste|BDSM|sado[\s\-]?maso)\b/i,
    label: "Pratiques BDSM / domination tarifée",
  },
];

/**
 * Signaux faibles. Chacun est courant chez des annonceurs honnêtes pris
 * isolément — c'est leur accumulation qui envoie en relecture, jamais un seul
 * hors massage.
 */
const SUSPICIOUS: Rule[] = [
  {
    id: "men_only",
    re: /\b(hommes?\s*(?:uniquement|seulement)|r[ée]serv[ée]\s*aux\s*hommes|messieurs\s*uniquement|for\s*men\s*only)\b/i,
    label: "Clientèle masculine exclusive",
  },
  {
    id: "discretion",
    re: /\b(discr[ée]tion\s*(?:assur[ée]e|garantie|totale)|en\s*toute\s*discr[ée]tion|cadre\s*discret)\b/i,
    label: "Insistance sur la discrétion",
  },
  {
    id: "night_hours",
    re: /\b(24\s*h\s*\/?\s*24|jour\s*et\s*nuit|jusqu['’]?[àa]\s*(?:minuit|2h|3h|4h)|tard\s*le\s*soir|nuit\s*possible)\b/i,
    label: "Disponibilité nocturne permanente",
  },
  {
    id: "private_place",
    re: /\b(appartement\s*priv[ée]|salon\s*priv[ée]|je\s*re[çc]ois(?:\s*chez\s*moi)?|re[çc]ois\s*en\s*priv[ée]|h[ôo]tel\s*possible)\b/i,
    label: "Réception en lieu privé / hôtel",
  },
  {
    id: "private_photos",
    re: /\b(photos?\s*(?:priv[ée]es?|suppl[ée]mentaires?|sur\s*demande)|plus\s*de\s*photos?\s*(?:par|en)\s*(?:sms|whatsapp|priv[ée]))\b/i,
    label: "Photos supplémentaires en privé",
  },
  {
    id: "price_on_request",
    re: /\b(tarifs?\s*(?:sur|[àa])\s*demande|prix\s*[àa]\s*convenir\s*par\s*(?:sms|t[ée]l[ée]phone|whatsapp))\b/i,
    label: "Tarif communiqué hors annonce",
  },
  {
    id: "suggestive_emoji",
    re: /[\u{1F351}\u{1F4A6}\u{1F445}\u{1F608}\u{1F457}]/u,
    label: "Émojis à connotation sexuelle",
  },
];

export type WellnessScreening = {
  /** Termes bannis relevés — non vide ⇒ rejet. */
  banned: { id: string; label: string }[];
  /** Signaux faibles relevés. */
  suspicious: { id: string; label: string }[];
  /** L'annonce doit passer par un modérateur humain. */
  requiresManualReview: boolean;
};

/**
 * Analyse un texte d'annonce au regard de la politique bien-être.
 *
 * `category` et `subcategory` sont les libellés (pas les identifiants), tels
 * que stockés sur l'annonce.
 */
export function screenWellnessListing({
  text,
  category,
  subcategory,
  confidence,
  hasImages = true,
}: {
  text: string;
  category: string;
  subcategory?: string | null;
  /** Confiance du classifieur bien-être (lib/wellness). */
  confidence?: number | null;
  /** Une annonce de prestation sans photo est invérifiable. */
  hasImages?: boolean;
}): WellnessScreening {
  const banned = BANNED.filter((r) => r.re.test(text)).map(({ id, label }) => ({ id, label }));
  const suspicious = SUSPICIOUS.filter((r) => r.re.test(text)).map(({ id, label }) => ({ id, label }));

  const isWellness = category === WELLNESS_CATEGORY_LABEL || category === WELLNESS_CATEGORY_ID;
  const isSensitive = !!subcategory && SENSITIVE_SUBCATEGORIES.has(subcategory);

  // Ce qui constitue un doute dans une rubrique sensible : le classifieur n'a
  // pas su nommer la prestation, ou l'annonce n'a pas de photo. Une annonce
  // franche (« Massage californien 1 h, institut, 60 € », photos à l'appui)
  // n'en déclenche aucun et se publie seule.
  const vagueOffer = isSensitive && typeof confidence === "number" && confidence < 0.7;
  const noProof = isSensitive && !hasImages;
  const shortText = isSensitive && text.trim().length < 80;

  const requiresManualReview =
    banned.length === 0 &&
    ((isWellness && suspicious.length >= 1) ||
      suspicious.length >= 2 ||
      vagueOffer ||
      noProof ||
      shortText);

  return { banned, suspicious, requiresManualReview };
}

/**
 * Nombre d'annonces bien-être qu'un compte particulier peut publier avant
 * qu'on l'invite à passer en compte professionnel. Quatre passent sans rien
 * demander : au-delà, c'est un salon, et un salon se vérifie.
 */
export const WELLNESS_PRO_THRESHOLD = 4;

/** Invitation affichée au particulier qui dépasse le seuil. Jamais un refus. */
export const PRO_UPGRADE_INVITE =
  "Vous publiez régulièrement des prestations de bien-être. Passez en compte professionnel " +
  "pour faire vérifier votre activité : votre salon affiche alors un badge vérifié, vos annonces " +
  "sont publiées plus vite et vos clients savent à qui ils ont affaire.";

/** Motif public affiché à l'auteur d'une annonce rejetée. */
export const WELLNESS_REJECTION_REASON =
  "Les prestations à connotation sensuelle ou sexuelle sont interdites sur Deal&Co. " +
  "La catégorie Beauté & Bien-être accueille uniquement des prestations de salon : " +
  "coiffure, onglerie, maquillage, soins, épilation, massage de bien-être ou sportif.";
