/**
 * Filtre des contenus à caractère sexuel dans la messagerie.
 *
 * Deux problèmes distincts, deux réponses :
 *
 * 1. **Le contournement.** Personne n'écrit « prostitution » en toutes lettres
 *    après un premier blocage : on écrit « l i b e r t i n », « dom1nation »,
 *    « échang... », « s3xe ». Le texte est donc *désobfusqué* avant analyse —
 *    leet speak, lettres espacées, caractères répétés, points de suspension
 *    intercalés — et l'analyse tourne sur les deux versions.
 *
 * 2. **Le faux positif.** « Je cherche un massage sportif après une
 *    compétition » doit passer. « Domination » dans une discussion sur un
 *    livre aussi. Les termes sont donc classés en deux familles :
 *    - `HARD` : bloqué quel qu'en soit le contexte. Aucun échange légitime
 *      entre acheteur et vendeur de petites annonces ne contient « escort »,
 *      « body body » ou « happy ending ».
 *    - `AMBIGUOUS` : bloqué seulement accompagné d'un signal d'intention —
 *      une proposition (« je propose », « dispo pour »), un tarif, une
 *      demande de rendez-vous discret. Sans cela, le mot passe.
 *
 * Le blocage est *dur* : contrairement au filtre anti-arnaque, qui laisse
 * passer en signalant, ici le message n'est pas remis. Un faux négatif expose
 * un utilisateur à une sollicitation sexuelle non désirée.
 */

import { foldAccents } from "@/lib/normalize-fr";

export type AdultCategory = "sexual_service" | "adult_content" | "swinger" | "solicitation";

export type AdultMatch = {
  id: string;
  label: string;
  category: AdultCategory;
  /** Extrait fautif tel que trouvé après normalisation. */
  term: string;
  /** Le terme n'apparaissait qu'après désobfuscation. */
  viaObfuscation: boolean;
};

export type AdultScan = {
  blocked: boolean;
  matches: AdultMatch[];
  /** Catégorie dominante, pour le journal de modération. */
  category: AdultCategory | null;
  /** Une tentative de contournement a été détectée. */
  obfuscated: boolean;
};

const LEET: Record<string, string> = {
  "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "8": "b", "9": "g",
  "@": "a", "$": "s", "€": "e", "!": "i", "+": "t", "(": "c",
};

/** Minuscules, sans accents, ponctuation réduite. */
function baseNormalize(text: string): string {
  return ` ${foldAccents(text).replace(/\s+/g, " ").trim()} `;
}

/**
 * Reconstruit le mot derrière le camouflage.
 *
 * - « l i b e r t i n », « l.i.b.e.r.t.i.n », « l-i-b-e-r-t-i-n » → « libertin »
 * - « dom1nation » → « domination »
 * - « sexeeee » → « sexe »
 * - « échang... » garde son radical, suffisant pour les motifs à radical court
 */
export function deobfuscate(text: string): string {
  let s = foldAccents(text);

  // Leet speak
  s = s.replace(/[0134578()@$€!+]/g, (c) => LEET[c] ?? c);

  // Séparateurs insérés entre lettres isolées : on les retire quand au moins
  // trois lettres seules se suivent, pour ne pas coller des mots normaux.
  s = s.replace(/(?:\b[a-z][\s._\-*]+){2,}[a-z]\b/g, (m) => m.replace(/[\s._\-*]/g, ""));

  // Caractères répétés (« sexeeee », « libertiiin »)
  s = s.replace(/(.)\1{2,}/g, "$1$1");

  // Ponctuation de camouflage restante
  s = s.replace(/[._\-*]{2,}/g, " ").replace(/\s+/g, " ");

  return ` ${s.trim()} `;
}

type Rule = { id: string; label: string; category: AdultCategory; re: RegExp };

/** Bloqué quel que soit le contexte. */
const HARD: Rule[] = [
  {
    id: "prostitution",
    label: "Prostitution / escorting",
    category: "sexual_service",
    re: /\b(escorte?s?|escort\s*girls?|call\s*girls?|prostitu(?:e|ee|tion|ees?)|passe\s*tarifee|plan\s*cul|michetonn?age|gfe\b|full\s*service)\b/,
  },
  {
    id: "sexual_act",
    label: "Acte sexuel explicite",
    category: "sexual_service",
    re: /\b(fellation|felation|masturbation|cunnilingus|sodomie|penetration|ejaculation|orgasme|jouissance|branlette|levrette)\b/,
  },
  {
    id: "body_body",
    label: "Massage body-body / naturiste",
    category: "sexual_service",
    re: /\b(body\s*body|corps\s*a\s*corps|nuru|massage\s*naturiste|naturiste|nudiste)\b/,
  },
  {
    id: "happy_ending",
    label: "« Finition » / happy ending",
    category: "sexual_service",
    re: /\b(happy\s*end(?:ing)?|finition\s*(?:manuelle|complete|heureuse|incluse|offerte)|final\s*happy)\b/,
  },
  {
    id: "swinger",
    label: "Club libertin / échangisme",
    category: "swinger",
    re: /\b(club\s*(?:libertin|echangiste)|soiree\s*(?:libertine|echangiste|coquine)|echangisme|candaulisme|partouze|gang\s*bang|wife\s*swap|echange\s*de\s*partenaires?)\b/,
  },
  {
    id: "porn",
    label: "Contenu pornographique",
    category: "adult_content",
    re: /\b(porno(?:graphique)?s?|porn\b|sex\s*(?:tape|cam|shop|toys?)|onlyfans|only\s*fans|nudes?\b|dick\s*pic)\b/,
  },
  {
    id: "sexual_offer",
    label: "Proposition de service sexuel",
    category: "solicitation",
    re: /\b(services?\s*sexuels?|prestations?\s*sexuelles?|rapport\s*sexuel|relation\s*tarifee|contre\s*(?:de\s*l\s*argent|remuneration)\s*(?:sexe|rapport))\b/,
  },
];

/**
 * Bloqué uniquement avec un signal d'intention. « domination » dans une
 * conversation sur un article de sport n'a rien à faire ici, mais
 * « domination, 100 € la séance, discrétion » si.
 */
const AMBIGUOUS: Rule[] = [
  { id: "domination", label: "Domination / BDSM", category: "sexual_service", re: /\b(domination|dominatrice|soumise|bdsm|sado\s*maso|fetichiste)\b/ },
  { id: "sensual", label: "Massage sensuel / érotique", category: "sexual_service", re: /\b(sensuel(?:le|s)?|erotiques?|coquin(?:e|s|es)?|tantrique|lingam|yoni)\b/ },
  { id: "libertin", label: "Libertinage", category: "swinger", re: /\b(libertin(?:e|s|es)?|libertinage)\b/ },
  { id: "sex_word", label: "Contexte sexuel", category: "solicitation", re: /\b(sexe|sexuel(?:le|s|les)?|sexy|hot\b)\b/ },
  { id: "no_taboo", label: "« Sans tabou »", category: "solicitation", re: /\b(sans\s*tabous?|open\s*minded?|pas\s*de\s*limites?)\b/ },
];

/**
 * Signaux d'intention : ce qui transforme un mot en proposition. Un tarif, une
 * offre de service, un rendez-vous discret.
 */
const INTENT: RegExp[] = [
  /\b(je\s*propose|je\s*fais|dispo(?:nible)?\s*pour|je\s*re[cç]ois|je\s*me\s*deplace|tu\s*veux|ca\s*t\s*interesse|interesse\?)\b/,
  /\b\d{2,4}\s*(?:€|euros?|eur)\b/,
  /\b(tarif|prix|paiement|paye|cash|espece)\b/,
  /\b(discret|discretion|entre\s*nous|pas\s*de\s*jaloux|sans\s*prise\s*de\s*tete)\b/,
  /\b(rdv|rendez\s*vous|hotel|chez\s*toi|chez\s*moi|ce\s*soir|maintenant)\b/,
];

/**
 * Contextes légitimes : formulations professionnelles ou sportives qui
 * doivent passer même si un mot ambigu apparaît à proximité.
 */
const LEGITIMATE: RegExp[] = [
  /\b(massage\s*(?:sportif|suedois|thai|thailandais|californien|balinais|ayurvedique|decontractant|du\s*dos|assis|prenatal))\b/,
  /\b(kine|kinesitherapeute|osteopathe|physiotherapeute|reflexologie|drainage\s*lymphatique)\b/,
  /\b(competition|entrainement|marathon|courbatures?|recuperation\s*musculaire|preparation\s*physique)\b/,
  /\b(diplome|certifie|institut|salon|cabinet|sur\s*rendez\s*vous\s*au\s*salon)\b/,
];

function matchRules(rules: Rule[], text: string, viaObfuscation: boolean): AdultMatch[] {
  const out: AdultMatch[] = [];
  for (const r of rules) {
    const m = text.match(r.re);
    if (m) out.push({ id: r.id, label: r.label, category: r.category, term: m[0], viaObfuscation });
  }
  return out;
}

/**
 * Analyse un message. `blocked` à vrai ⇒ le message ne doit pas être remis.
 */
export function scanAdultContent(text: string): AdultScan {
  const plain = baseNormalize(text);
  const deob = deobfuscate(text);
  const obfuscationChanged = deob.replace(/\s/g, "") !== plain.replace(/\s/g, "");

  const hard = [
    ...matchRules(HARD, plain, false),
    ...matchRules(HARD, deob, true).filter((m) => !plain.includes(m.term)),
  ];

  const ambiguous = [
    ...matchRules(AMBIGUOUS, plain, false),
    ...matchRules(AMBIGUOUS, deob, true).filter((m) => !plain.includes(m.term)),
  ];

  const hasIntent = INTENT.some((re) => re.test(plain) || re.test(deob));
  const looksLegitimate = LEGITIMATE.some((re) => re.test(plain) || re.test(deob));

  // Un terme ambigu ne bloque qu'accompagné d'une intention, et jamais dans un
  // échange manifestement professionnel. Deux termes ambigus ensemble
  // (« sensuel » + « sans tabou ») valent une intention à eux seuls.
  const ambiguousBlocks =
    ambiguous.length > 0 && !looksLegitimate && (hasIntent || ambiguous.length >= 2);

  const matches = hard.length > 0 ? hard : ambiguousBlocks ? ambiguous : [];
  const blocked = hard.length > 0 || ambiguousBlocks;

  return {
    blocked,
    matches,
    category: matches[0]?.category ?? null,
    obfuscated: obfuscationChanged && matches.some((m) => m.viaObfuscation),
  };
}

/** Message affiché à l'expéditeur. Volontairement sobre : pas de mode d'emploi. */
export const ADULT_BLOCK_MESSAGE =
  "Ce message contient un contenu qui n'est pas autorisé sur Deal&Co. " +
  "Les échanges à caractère sexuel ou adulte ne sont pas autorisés sur la plateforme.";

/** Paliers de récidive appliqués au compte. */
export type RecidiveAction = "warn" | "watch" | "suspend" | "ban";

/**
 * Palier atteint pour un nombre total de messages bloqués (celui-ci compris).
 * Le bannissement reste une décision humaine : le moteur le propose, il ne
 * l'exécute pas.
 */
export function recidiveAction(blockedCount: number): RecidiveAction {
  if (blockedCount >= 8) return "ban";
  if (blockedCount >= 5) return "suspend";
  if (blockedCount >= 3) return "watch";
  return "warn";
}
