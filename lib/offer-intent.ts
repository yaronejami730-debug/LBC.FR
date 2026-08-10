/**
 * Moteur d'intention — qu'est-ce que cette annonce vend réellement ?
 *
 * Le défaut historique : la nature de l'offre était déduite de la *catégorie*
 * choisie. Or le titre est saisi avant la catégorie, et l'annonceur se trompe
 * souvent de rubrique. Résultat, une manucure publiée dans « Divers » se voyait
 * demander « État du produit — Neuf / Bon état / Pour pièces », valeur fausse
 * qui partait en base puis polluait recherche, filtres et recommandations.
 *
 * Ici le texte prime et la catégorie arbitre : un signal lexical franc gagne
 * contre la rubrique, une rubrique sans signal donne une intention correcte mais
 * peu confiante, et un conflit franc fait chuter la confiance — l'interface
 * propose alors au lieu d'imposer.
 *
 * Aucun modèle génératif, aucun appel réseau : index de motifs construit une
 * fois au chargement, comparaison sur texte normalisé. Ce code tourne sur le
 * chemin de publication et sur celui de la recherche.
 */

import { foldAccents, expandAbbreviations } from "@/lib/normalize-fr";
import { classifyWellness } from "@/lib/wellness/classify";
import { getCategoryById, getCategoryByLabel } from "@/lib/categories";
import { WELLNESS_CATEGORY_ID } from "@/lib/moderation/wellness-policy";
import type { FieldSetId, Lexicon } from "@/lib/offer-fields";
import { FIELD_SETS, suppressedFields } from "@/lib/offer-fields";

/** Ce que l'annonce transfère à l'acheteur. */
export type OfferNature =
  /** Objet physique cédé définitivement — un canapé, un iPhone. */
  | "bien"
  /** Du temps ou un savoir-faire — manucure, cours de piano, dépannage. */
  | "prestation"
  /** L'usage temporaire d'un bien — gîte, perceuse, utilitaire. */
  | "location"
  /** Un poste de travail. */
  | "emploi"
  /** Logement à vendre ou à louer — régime de champs à part. */
  | "immobilier"
  /** L'annonceur ne propose rien, il demande. */
  | "demande"
  /** Cédé sans contrepartie. */
  | "don"
  /** Rendez-vous, sortie, association — ni bien ni prestation. */
  | "evenement";

export type OfferIntent = {
  nature: OfferNature;
  /** 0–1. Sous 0.5 l'interface propose sans imposer. */
  confidence: number;
  /** Motifs déclencheurs, dans l'ordre de poids. Sert au debug et au support. */
  signals: string[];
  /** Jeu de champs que le formulaire doit rendre. */
  fieldSet: FieldSetId;
  /** Champs qu'il ne faut surtout pas demander — « condition » en tête. */
  suppressed: string[];
  /** Vocabulaire de l'interface : « article », « prestation », « logement »… */
  lexicon: Lexicon;
  /** Version du moteur, persistée avec l'annonce pour pouvoir rejouer. */
  version: number;
};

export const OFFER_INTENT_VERSION = 1;

export const NATURE_LABELS: Record<OfferNature, string> = {
  bien: "Objet à vendre",
  prestation: "Prestation",
  location: "Location",
  emploi: "Emploi",
  immobilier: "Bien immobilier",
  demande: "Recherche",
  don: "Don",
  evenement: "Événement",
};

// ─────────────────────────────────────────────────────────────
// Normalisation
// ─────────────────────────────────────────────────────────────

/**
 * Texte comparable : abréviations étendues (« tbe » → « tres bon etat »),
 * accents pliés, ponctuation réduite. Encadré d'espaces pour que les motifs
 * puissent exiger des frontières de mot par simple `includes`.
 */
function normalize(text: string): string {
  return ` ${expandAbbreviations(foldAccents(text))
    .replace(/[^a-z0-9€%+/]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()} `;
}

// ─────────────────────────────────────────────────────────────
// Motifs
// ─────────────────────────────────────────────────────────────

type Pattern = { p: string | RegExp; w: number; why: string };

/**
 * Poids : 3 = le mot dit à lui seul ce qui est vendu (« manucure »,
 * « à louer »). 2 = signal net mais partageable. 1 = indice d'appoint.
 * Un motif trouvé dans le titre compte double — c'est là que l'annonceur dit
 * l'essentiel.
 */
const PATTERNS: Partial<Record<OfferNature, Pattern[]>> = {
  prestation: [
    // Actes et métiers — un nom d'acte ne se vend pas en objet.
    { p: "manucure", w: 3, why: "acte : manucure" },
    { p: "pedicure", w: 3, why: "acte : pédicure" },
    { p: "beaute des pieds", w: 3, why: "acte : beauté des pieds" },
    { p: "prothesiste ongulaire", w: 3, why: "métier : prothésiste ongulaire" },
    { p: "pose ongles", w: 3, why: "acte : pose d'ongles" },
    { p: "pose d ongles", w: 3, why: "acte : pose d'ongles" },
    { p: "massage", w: 2.5, why: "acte : massage" },
    { p: "epilation", w: 3, why: "acte : épilation" },
    { p: "soin du visage", w: 3, why: "acte : soin du visage" },
    { p: "extension de cils", w: 3, why: "acte : extension de cils" },
    { p: "rehaussement de cils", w: 3, why: "acte : rehaussement de cils" },
    { p: "microblading", w: 3, why: "acte : microblading" },
    { p: "brushing", w: 3, why: "acte : brushing" },
    { p: "coiffure a domicile", w: 3, why: "acte : coiffure à domicile" },
    { p: "maquillage mariee", w: 3, why: "acte : maquillage mariée" },
    { p: "reflexologie", w: 3, why: "acte : réflexologie" },
    { p: "naturopathe", w: 3, why: "métier : naturopathe" },
    { p: "osteopathe", w: 3, why: "métier : ostéopathe" },
    // Services du quotidien.
    { p: "depannage", w: 3, why: "service : dépannage" },
    { p: "demenagement", w: 2.5, why: "service : déménagement" },
    { p: "menage", w: 2.5, why: "service : ménage" },
    { p: "repassage", w: 2.5, why: "service : repassage" },
    { p: "garde d enfant", w: 3, why: "service : garde d'enfants" },
    { p: "baby sitting", w: 3, why: "service : baby-sitting" },
    { p: "aide a domicile", w: 3, why: "service : aide à domicile" },
    { p: "jardinage", w: 2.5, why: "service : jardinage" },
    { p: "taille de haie", w: 3, why: "service : taille de haie" },
    { p: "plomberie", w: 2.5, why: "service : plomberie" },
    { p: "serrurier", w: 3, why: "métier : serrurier" },
    { p: "maconnerie", w: 2.5, why: "service : maçonnerie" },
    { p: "peintre en batiment", w: 3, why: "métier : peintre en bâtiment" },
    { p: "pose de", w: 2, why: "service : pose" },
    { p: "installation de", w: 2, why: "service : installation" },
    { p: "reparation", w: 2.5, why: "service : réparation" },
    { p: "entretien", w: 1.5, why: "service : entretien" },
    // Enseignement et accompagnement.
    { p: "cours de", w: 3, why: "enseignement : cours de…" },
    { p: "cours particuliers", w: 3, why: "enseignement : cours particuliers" },
    { p: "soutien scolaire", w: 3, why: "enseignement : soutien scolaire" },
    { p: "prof de", w: 2.5, why: "enseignement : professeur" },
    { p: "coaching", w: 2.5, why: "accompagnement : coaching" },
    { p: "formation", w: 2, why: "accompagnement : formation" },
    // Prestations créatives et événementielles.
    { p: "photographe", w: 2.5, why: "métier : photographe" },
    { p: "traiteur", w: 3, why: "métier : traiteur" },
    { p: "wedding planner", w: 3, why: "métier : wedding planner" },
    { p: "graphiste", w: 2.5, why: "métier : graphiste" },
    { p: "developpeur web", w: 2.5, why: "métier : développeur web" },
    { p: "traduction", w: 2, why: "prestation : traduction" },
    // Marqueurs de facturation d'un temps de travail.
    { p: "prestation", w: 2.5, why: "mot « prestation »" },
    { p: "sur devis", w: 2.5, why: "tarification sur devis" },
    { p: "devis gratuit", w: 2.5, why: "tarification sur devis" },
    { p: "a domicile", w: 2, why: "intervention à domicile" },
    { p: "je me deplace", w: 2.5, why: "intervention à domicile" },
    { p: "la seance", w: 2.5, why: "prix à la séance" },
    { p: "par seance", w: 2.5, why: "prix à la séance" },
    { p: "de l heure", w: 2, why: "prix horaire" },
    { p: "tarif horaire", w: 2.5, why: "prix horaire" },
    { p: /\d\s*€?\s*\/\s*h\b/, w: 2.5, why: "prix horaire (€/h)" },
    { p: "en institut", w: 2, why: "lieu : institut" },
    { p: "sur rendez vous", w: 2, why: "sur rendez-vous" },
  ],

  bien: [
    // Verbes et formules de cession d'objet.
    { p: "a vendre", w: 2.5, why: "formule « à vendre »" },
    { p: "je vends", w: 2.5, why: "formule « je vends »" },
    { p: "vends", w: 2, why: "verbe « vends »" },
    { p: "a saisir", w: 1.5, why: "formule « à saisir »" },
    // L'état d'un objet ne se dit que d'un objet.
    { p: "tres bon etat", w: 2.5, why: "état déclaré" },
    { p: "bon etat", w: 2, why: "état déclaré" },
    { p: "excellent etat", w: 2.5, why: "état déclaré" },
    { p: "etat neuf", w: 2.5, why: "état déclaré" },
    { p: "jamais servi", w: 2.5, why: "état déclaré" },
    { p: "neuf", w: 1.5, why: "état déclaré" },
    { p: "occasion", w: 1.5, why: "état déclaré" },
    { p: "pour pieces", w: 2.5, why: "état déclaré" },
    // Conditionnement et logistique — propres à un objet physique.
    { p: "lot de", w: 2.5, why: "conditionnement : lot" },
    { p: "sous blister", w: 3, why: "conditionnement : blister" },
    { p: "emballage d origine", w: 3, why: "conditionnement d'origine" },
    { p: "boite d origine", w: 2.5, why: "conditionnement d'origine" },
    { p: "stock de", w: 2, why: "conditionnement : stock" },
    { p: "remise en main propre", w: 2.5, why: "remise en main propre" },
    { p: "envoi possible", w: 2.5, why: "envoi postal" },
    { p: "mondial relay", w: 3, why: "envoi postal" },
    { p: "colissimo", w: 3, why: "envoi postal" },
    { p: "port compris", w: 2.5, why: "envoi postal" },
    { p: "sous garantie", w: 2, why: "garantie constructeur" },
    { p: "facture d achat", w: 2, why: "facture d'achat" },
    { p: /\bpointure\s*\d/, w: 2.5, why: "pointure" },
    { p: /\btaille\s*(x?s|m|l|x{0,3}l|\d{2})\b/, w: 2, why: "taille de vêtement" },
    // Fiche technique d'un véhicule — décrit un objet, jamais une prestation.
    { p: "controle technique", w: 2.5, why: "contrôle technique" },
    { p: "premiere main", w: 2.5, why: "première main" },
    { p: "carnet d entretien", w: 2.5, why: "carnet d'entretien" },
    { p: "boite automatique", w: 2, why: "boîte automatique" },
    { p: /\b\d{2,3}\s*000\s*km\b|\b\d{1,6}\s*km\b/, w: 2, why: "kilométrage" },
    { p: /\b(essence|diesel|hybride|electrique)\b/, w: 1.5, why: "motorisation" },
  ],

  location: [
    { p: "a louer", w: 3, why: "formule « à louer »" },
    { p: "je loue", w: 3, why: "formule « je loue »" },
    { p: /\bloue\b(?!r)/, w: 2.5, why: "verbe « loue »" },
    { p: "en location", w: 3, why: "formule « en location »" },
    { p: "location de", w: 3, why: "formule « location de »" },
    { p: "mise a disposition", w: 2, why: "mise à disposition" },
    { p: "caution", w: 2, why: "caution demandée" },
    { p: "depot de garantie", w: 2.5, why: "dépôt de garantie" },
    { p: "par nuit", w: 3, why: "prix à la nuitée" },
    { p: "la nuit", w: 2, why: "prix à la nuitée" },
    { p: "par semaine", w: 2, why: "prix à la semaine" },
    { p: "week end", w: 1.5, why: "séjour week-end" },
    { p: "location saisonniere", w: 3, why: "location saisonnière" },
    { p: "gite", w: 2.5, why: "hébergement : gîte" },
    { p: "chambre d hote", w: 3, why: "hébergement : chambre d'hôte" },
    { p: "duree minimum", w: 2, why: "durée minimale de location" },
  ],

  emploi: [
    { p: "offre d emploi", w: 3, why: "offre d'emploi" },
    { p: "recrutement", w: 3, why: "recrutement" },
    { p: "recrute", w: 3, why: "recrutement" },
    { p: "poste a pourvoir", w: 3, why: "poste à pourvoir" },
    { p: /\bcdi\b/, w: 3, why: "contrat CDI" },
    { p: /\bcdd\b/, w: 3, why: "contrat CDD" },
    { p: "interim", w: 2.5, why: "contrat intérim" },
    { p: "alternance", w: 2.5, why: "contrat en alternance" },
    { p: "apprentissage", w: 2, why: "contrat d'apprentissage" },
    { p: "temps plein", w: 2, why: "temps de travail" },
    { p: "temps partiel", w: 2, why: "temps de travail" },
    { p: /\bh\s*\/\s*f\b/, w: 2.5, why: "mention H/F" },
    { p: "profil recherche", w: 2, why: "profil recherché" },
    { p: "envoyer votre cv", w: 3, why: "candidature par CV" },
    { p: "salaire", w: 2, why: "salaire annoncé" },
  ],

  immobilier: [
    { p: "metre carre", w: 2, why: "surface annoncée" },
    { p: /\bt[1-9]\b/, w: 2, why: "typologie T1–T9" },
    { p: /\bf[1-9]\b/, w: 2, why: "typologie F1–F9" },
    { p: "appartement", w: 2.5, why: "type de bien : appartement" },
    { p: "studio", w: 2, why: "type de bien : studio" },
    { p: "maison de", w: 2, why: "type de bien : maison" },
    { p: "charges comprises", w: 2.5, why: "charges comprises" },
    { p: /\bdpe\b/, w: 2.5, why: "diagnostic DPE" },
    { p: "rez-de-chaussee", w: 2, why: "étage annoncé" },
    { p: "terrain constructible", w: 3, why: "terrain constructible" },
    { p: "viager", w: 3, why: "vente en viager" },
  ],

  don: [
    { p: "a donner", w: 4, why: "formule « à donner »" },
    { p: "donne contre", w: 3, why: "don contre reprise" },
    { p: "cede gratuitement", w: 4, why: "cession gratuite" },
    { p: "gratuit", w: 2, why: "mot « gratuit »" },
  ],

  evenement: [
    { p: "soiree", w: 2, why: "événement : soirée" },
    { p: "concert", w: 2.5, why: "événement : concert" },
    { p: "vide grenier", w: 3, why: "événement : vide-grenier" },
    { p: "brocante", w: 2.5, why: "événement : brocante" },
    { p: "association", w: 2, why: "vie associative" },
    { p: "benevoles", w: 2.5, why: "appel à bénévoles" },
    { p: "rencontre", w: 1.5, why: "rencontre" },
    { p: "covoiturage", w: 3, why: "covoiturage" },
  ],
};

/**
 * Verbes de tête de titre : ce ne sont pas des indices, ce sont des actes de
 * langage qui qualifient tout ce qui suit. « Cherche prothésiste ongulaire »
 * reste une demande même si « prothésiste ongulaire » crie « prestation », et
 * « Loue table de manucure » reste une location même si « manucure » crie le
 * contraire. Les traiter comme de simples motifs pondérés fait perdre à tous
 * les coups contre le vocabulaire métier qui suit — d'où l'écrasement.
 *
 * L'ancrage au début est essentiel : « salon recherche sa clientèle » n'est
 * pas une demande.
 */
const DEMAND_LEAD =
  /^\s*(?:urgent\s+)?(?:je\s+)?(?:recherche|cherche|rech|achete|rachete|recherchons|cherchons|suis a la recherche)\b/;

const RENTAL_LEAD = /^\s*(?:je\s+)?(?:loue|a louer|location de|location d|mets? en location)\b/;

const DEMAND_ANYWHERE: Pattern[] = [
  { p: "je recherche", w: 2.5, why: "formule « je recherche »" },
  { p: "je cherche", w: 2.5, why: "formule « je cherche »" },
  { p: "suis a la recherche", w: 2.5, why: "formule « à la recherche de »" },
  { p: "recherche modele", w: 3, why: "recherche de modèle" },
  { p: "cherche modele", w: 3, why: "recherche de modèle" },
  { p: "achete vos", w: 3, why: "rachat" },
  { p: "recherchons", w: 2, why: "formule « recherchons »" },
];

// ─────────────────────────────────────────────────────────────
// Priors de catégorie
// ─────────────────────────────────────────────────────────────

/**
 * Ce que la rubrique laisse présumer, quand le texte ne dit rien. Volontairement
 * plus faible qu'un motif lexical franc : la rubrique arbitre, elle ne décide
 * pas. Elle est souvent choisie à la va-vite, ou pas encore choisie du tout.
 */
const CATEGORY_PRIORS: Record<string, Partial<Record<OfferNature, number>>> = {
  immobilier: { immobilier: 4 },
  vehicules: { bien: 2.5 },
  maison: { bien: 2 },
  multimedia: { bien: 2 },
  mode: { bien: 2.5 },
  loisirs: { bien: 2 },
  animaux: { bien: 1.5 },
  services: { prestation: 2.5 },
  [WELLNESS_CATEGORY_ID]: { prestation: 2.5 },
  emploi: { emploi: 4 },
  communaute: { evenement: 3 },
  "materiel-pro": { bien: 2 },
  "bebe-enfant": { bien: 2 },
  vacances: { location: 3 },
  divers: {},
};

/** Sous-catégories qui contredisent leur rubrique — le cas est réel, pas théorique. */
const SUBCATEGORY_PRIORS: Record<string, Partial<Record<OfferNature, number>>> = {
  Locations: { immobilier: 2 },
  Colocations: { immobilier: 2 },
  "Locations de vacances": { location: 2 },
  "Locations saisonnières": { location: 2 },
  "Cours particuliers": { prestation: 3 },
  Réparations: { prestation: 3 },
  Événementiel: { prestation: 2 },
  "Services à la personne": { prestation: 3 },
  "Services divers": { prestation: 2 },
  "Offres d'emploi": { emploi: 3 },
  Événements: { evenement: 3 },
  Associations: { evenement: 3 },
  Rencontres: { evenement: 3 },
  "Location d'espace bien-être": { location: 3 },
};

// ─────────────────────────────────────────────────────────────
// Moteur
// ─────────────────────────────────────────────────────────────

export type OfferIntentInput = {
  title: string;
  description?: string | null;
  /** Identifiant ou libellé de catégorie — les deux sont acceptés. */
  categoryId?: string | null;
  subcategory?: string | null;
  price?: number | null;
  isPro?: boolean;
};

type Tally = { score: number; signals: { why: string; w: number }[] };

function add(tally: Record<string, Tally>, nature: OfferNature, w: number, why: string) {
  const t = (tally[nature] ??= { score: 0, signals: [] });
  t.score += w;
  t.signals.push({ why, w });
}

function matches(text: string, p: string | RegExp): boolean {
  return typeof p === "string" ? text.includes(` ${p} `) || text.includes(`${p} `) : p.test(text);
}

/**
 * Déduit ce que l'annonce vend. Fonction pure : ni I/O, ni Prisma, ni réseau.
 *
 * @example
 *   inferOfferIntent({ title: "Manucure pédicure à domicile 35€" })
 *     → { nature: "prestation", suppressed: ["condition", …], lexicon: "prestation" }
 *   inferOfferIntent({ title: "Vernis semi permanent neuf lot de 12" })
 *     → { nature: "bien" }
 */
export function inferOfferIntent(input: OfferIntentInput): OfferIntent {
  const title = input.title ?? "";
  const description = input.description ?? "";
  const text = normalize(`${title} ${description}`);
  const titleText = normalize(title);
  const tally: Record<string, Tally> = {};

  // 1. Motifs lexicaux. Le titre pèse double : c'est la phrase que
  //    l'annonceur soigne, la description part souvent en digressions.
  for (const [nature, patterns] of Object.entries(PATTERNS) as [OfferNature, Pattern[]][]) {
    for (const { p, w, why } of patterns) {
      if (matches(titleText, p)) add(tally, nature, w * 2, why);
      else if (matches(text, p)) add(tally, nature, w, why);
    }
  }

  // 2. Actes de langage en tête de titre — appliqués après l'arbitrage, en
  //    écrasement. Ailleurs dans le texte, ce ne sont que des indices.
  const trimmedTitle = titleText.trim();
  const demandLead = DEMAND_LEAD.test(trimmedTitle);
  const rentalLead = RENTAL_LEAD.test(trimmedTitle);
  for (const { p, w, why } of DEMAND_ANYWHERE) {
    if (matches(titleText, p)) add(tally, "demande", w * 2, why);
    else if (matches(text, p)) add(tally, "demande", w, why);
  }

  // 3. Don — un prix à zéro seul ne suffit pas (les annonceurs le laissent vide
  //    par paresse), mais combiné à un mot de don il tranche.
  if (input.price === 0 && (tally.don?.score ?? 0) > 0) {
    add(tally, "don", 3, "prix à 0 € et vocabulaire de don");
  }

  // 4. Classifieur bien-être : il connaît déjà finement la frontière entre
  //    vendre un massage, vendre une table de massage et louer une cabine.
  //    Réutilisé ici plutôt que réécrit — une seule table de motifs à maintenir.
  const wellness = classifyWellness({ title, description, price: input.price ?? null });
  if (wellness) {
    const w = 2 + wellness.confidence * 3;
    if (wellness.offerKind === "vente_produit") add(tally, "bien", w, "bien-être : vente de matériel");
    else if (wellness.offerKind === "location_espace") add(tally, "location", w, "bien-être : location d'espace");
    else if (wellness.offerKind === "recherche_modele") add(tally, "demande", w, "bien-être : recherche de modèle");
    else add(tally, "prestation", w, `bien-être : ${wellness.subcategory.toLowerCase()}`);
  }

  // 5. Priors de rubrique.
  const category = input.categoryId
    ? (getCategoryById(input.categoryId) ?? getCategoryByLabel(input.categoryId))
    : null;
  if (category) {
    for (const [nature, w] of Object.entries(CATEGORY_PRIORS[category.id] ?? {})) {
      add(tally, nature as OfferNature, w!, `rubrique « ${category.label} »`);
    }
  }
  if (input.subcategory) {
    for (const [nature, w] of Object.entries(SUBCATEGORY_PRIORS[input.subcategory] ?? {})) {
      add(tally, nature as OfferNature, w!, `sous-rubrique « ${input.subcategory} »`);
    }
  }

  // 6. Arbitrage.
  const ranked = (Object.entries(tally) as [OfferNature, Tally][])
    .filter(([, t]) => t.score > 0)
    .sort((a, b) => b[1].score - a[1].score);

  if (ranked.length === 0) {
    // Rien de lisible : on retombe sur le régime le plus large plutôt que
    // d'inventer. Confiance nulle — l'interface ne préremplit rien.
    if (demandLead) return build("demande", 0.7, ["titre ouvert par « recherche / cherche »"], input, wellness);
    if (rentalLead) return build("location", 0.7, ["titre ouvert par « loue / location »"], input, wellness);
    return build("bien", 0, [], input, wellness);
  }

  const [scoredNature, top] = ranked[0];
  const runnerUp = ranked[1]?.[1].score ?? 0;

  // Confiance = force absolue × netteté de l'écart. Un signal isolé mais unique
  // ne vaut pas une convergence, et deux natures au coude à coude doivent faire
  // douter même si les scores sont hauts.
  const strength = Math.min(1, top.score / 8);
  const margin = top.score > 0 ? (top.score - runnerUp) / top.score : 0;
  let confidence = Math.round(Math.min(1, strength * (0.55 + 0.45 * margin)) * 100) / 100;

  let signals = top.signals
    .sort((a, b) => b.w - a.w)
    .map((s) => s.why)
    .filter((why, i, arr) => arr.indexOf(why) === i)
    .slice(0, 6);

  // Écrasement par l'acte de langage.
  //
  // Exception « emploi » : « recherche commercial H/F » est un recruteur qui
  // publie une offre, pas un candidat qui demande. Exception « immobilier »
  // pour la location seulement : « loue T2 » est bien une annonce immobilière,
  // alors que « cherche T2 » est une demande — et une demande ne doit jamais
  // remonter dans les résultats comme si elle était une offre.
  let nature = scoredNature;
  if (demandLead && scoredNature !== "emploi") {
    nature = "demande";
    signals = ["titre ouvert par « recherche / cherche »", ...signals].slice(0, 6);
    confidence = Math.max(confidence, 0.75);
  } else if (rentalLead && scoredNature !== "immobilier" && scoredNature !== "emploi") {
    nature = "location";
    signals = ["titre ouvert par « loue / location »", ...signals].slice(0, 6);
    confidence = Math.max(confidence, 0.75);
  }

  return build(nature, confidence, signals, input, wellness);
}

function build(
  nature: OfferNature,
  confidence: number,
  signals: string[],
  input: OfferIntentInput,
  wellness: ReturnType<typeof classifyWellness>,
): OfferIntent {
  const fieldSet = resolveFieldSet(nature, input, wellness);
  const spec = FIELD_SETS[fieldSet];
  return {
    nature,
    confidence,
    signals,
    fieldSet,
    suppressed: suppressedFields(fieldSet),
    lexicon: spec.lexicon,
    version: OFFER_INTENT_VERSION,
  };
}

/**
 * La nature dit ce qui est vendu, le jeu de champs dit quoi demander. Les deux
 * ne se confondent pas : un bien immobilier à vendre et à louer partagent la
 * nature mais pas les champs, une voiture et un canapé partagent la nature mais
 * pas la fiche technique.
 */
function resolveFieldSet(
  nature: OfferNature,
  input: OfferIntentInput,
  wellness: ReturnType<typeof classifyWellness>,
): FieldSetId {
  const categoryId =
    (input.categoryId ? getCategoryById(input.categoryId)?.id : null) ??
    (input.categoryId ? getCategoryByLabel(input.categoryId)?.id : null) ??
    input.categoryId ??
    null;

  switch (nature) {
    case "immobilier": {
      const rentalSub = input.subcategory === "Locations" || input.subcategory === "Colocations";
      const rentalText = /\ba louer\b|\ben location\b|\bloyer\b|\bcharges comprises\b/.test(
        normalize(`${input.title} ${input.description ?? ""}`),
      );
      return rentalSub || rentalText ? "immobilier-location" : "immobilier-vente";
    }
    case "bien":
      return categoryId === "vehicules" ? "vehicule" : "bien";
    case "prestation":
      // Le bloc bien-être ajoute durée / unité de prix / lieu ; ailleurs on
      // reste sur le tronc commun prestation.
      return categoryId === WELLNESS_CATEGORY_ID || wellness ? "prestation-bien-etre" : "prestation";
    case "location":
      return "location-bien";
    case "emploi":
      return "emploi";
    case "demande":
      return "demande";
    case "don":
      return "don";
    case "evenement":
      return "evenement";
  }
}

/** Raccourci pour les appelants qui ne veulent qu'une chose : demander l'état ou non. */
export function asksForCondition(intent: OfferIntent): boolean {
  return !intent.suppressed.includes("condition");
}

/**
 * Nature d'une annonce stockée : lue dans `metadata.intent` si elle y est,
 * recalculée sinon.
 *
 * Le repli n'est pas une précaution théorique — toutes les annonces publiées
 * avant le moteur ont un `metadata` sans intention, et s'en remettre à la seule
 * valeur stockée reviendrait à ne trier que les nouvelles.
 */
export function listingNature(row: {
  title: string;
  description: string;
  category: string;
  subcategory?: string | null;
  price: number;
  metadata: string;
}): OfferNature {
  try {
    const meta = JSON.parse(row.metadata || "{}") as { intent?: { nature?: OfferNature } };
    if (meta.intent?.nature) return meta.intent.nature;
  } catch {
    /* metadata illisible — on recalcule */
  }
  return inferOfferIntent({
    title: row.title,
    description: row.description,
    categoryId: row.category,
    subcategory: row.subcategory ?? null,
    price: row.price,
  }).nature;
}
