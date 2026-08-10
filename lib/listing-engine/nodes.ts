/**
 * Registre des nœuds de taxonomie du moteur d'annonces.
 *
 * Le classifieur ne score **jamais des annonces** — il score des nœuds de
 * taxonomie. C'est la première des quatre causes racines listées dans
 * `docs/02-classification.md` §2 : un moteur qui fait du full-text sur le
 * corpus publié fait remonter « Fourgon utilitaire — livraison Cannes » sur la
 * requête « Appartement Cannes », puis propage le score à sa catégorie.
 *
 * Deux sources, fusionnées :
 *   1. `data/listing-engine/taxonomy.roots.json` — 11 racines, 228 types. Donne
 *      la couverture, mais aucun lexique.
 *   2. `data/listing-engine/types/*.json` — 8 configurations complètes dont le
 *      bloc `classifier` porte noms-têtes, modificateurs, négatifs et indices de
 *      transaction. Elles enrichissent les nœuds correspondants.
 *
 * Les nœuds sans configuration reçoivent un nom-tête dérivé de leur slug. C'est
 * volontairement pauvre — assez pour rendre un nœud *éligible*, jamais assez
 * pour le faire gagner seul.
 */

import taxonomyRoots from "@/data/listing-engine/taxonomy.roots.json";

import immoLLD from "@/data/listing-engine/types/immobilier.location-longue-duree.appartement.json";
import immoVac from "@/data/listing-engine/types/immobilier.location-vacances.appartement.json";
import immoVente from "@/data/listing-engine/types/immobilier.vente.appartement.json";
import materielSono from "@/data/listing-engine/types/materiel.location.sonorisation.json";
import servicesPhoto from "@/data/listing-engine/types/services.evenementiel.photographe.json";
import vehLoa from "@/data/listing-engine/types/vehicules.voitures.loa-lld.json";
import vehLoc from "@/data/listing-engine/types/vehicules.voitures.location.json";
import vehVente from "@/data/listing-engine/types/vehicules.voitures.vente.json";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export type TransactionKind =
  | "vente"
  | "location"
  | "location_longue_duree"
  | "location_saisonniere"
  | "loa"
  | "lld"
  | "leasing"
  | "echange"
  | "prestation"
  | "recherche"
  | "don"
  | "emploi";

export type ListingNode = {
  /** `immobilier.location-vacances.appartement` */
  key: string;
  rootSlug: string;
  subSlug: string;
  typeSlug: string;
  label: string;
  /** Transactions que ce nœud accepte. Une seule ⇒ pas de question à poser. */
  transactions: TransactionKind[];
  /** Termes qui rendent le nœud éligible. Sans eux, il n'est pas candidat. */
  headNouns: string[];
  /** Termes qui le renforcent une fois éligible. */
  modifiers: string[];
  /** Termes qui l'excluent presque sûrement. */
  negatives: string[];
  /** Indices de transaction propres au nœud, par type de transaction. */
  transactionCues: Record<string, string[]>;
  /** Vient d'une configuration complète (lexique riche) ou dérivé du slug. */
  hasConfig: boolean;
};

// ─────────────────────────────────────────────────────────────
// Lecture des configurations complètes
// ─────────────────────────────────────────────────────────────

type RawConfig = {
  key?: string;
  label?: string;
  classifier?: {
    head_nouns?: string[];
    modifiers?: string[];
    negative?: string[];
    transaction_cues?: Record<string, string[]>;
  };
};

const CONFIGS: RawConfig[] = [
  immoLLD, immoVac, immoVente, materielSono, servicesPhoto, vehLoa, vehLoc, vehVente,
] as RawConfig[];

/**
 * Les fichiers sont nommés d'après leur clé ; s'appuyer sur le nom de fichier
 * plutôt que sur un champ interne évite qu'un `key` oublié dans un JSON casse
 * silencieusement l'association.
 */
const CONFIG_KEYS = [
  "immobilier.location-longue-duree.appartement",
  "immobilier.location-vacances.appartement",
  "immobilier.vente.appartement",
  "materiel.location.sonorisation",
  "services.evenementiel.photographe",
  "vehicules.voitures.loa-lld",
  "vehicules.voitures.location",
  "vehicules.voitures.vente",
];

const CONFIG_BY_KEY = new Map<string, RawConfig>(
  CONFIG_KEYS.map((key, i) => [CONFIGS[i]?.key ?? key, CONFIGS[i]]),
);

// ─────────────────────────────────────────────────────────────
// Dérivation des noms-têtes depuis la taxonomie
// ─────────────────────────────────────────────────────────────

/**
 * Slugs qui désignent une transaction et non une chose. Ils ne peuvent jamais
 * servir de nom-tête : « vente » n'est pas un objet, et laisser « location »
 * rendre un nœud éligible ferait basculer n'importe quelle annonce de location
 * vers n'importe quel nœud.
 */
const TRANSACTION_SLUGS = new Set([
  "vente", "location", "location-longue-duree", "location-vacances",
  "loa-lld", "leasing", "echange", "viager", "colocation",
]);

/** Synonymes de nom-tête pour les slugs dont la forme canonique ne suffit pas. */
const SLUG_HEAD_NOUNS: Record<string, string[]> = {
  appartement: ["appartement", "appart", "studio", "t1", "t2", "t3", "t4", "t5", "f2", "f3", "f4", "loft", "duplex"],
  // « villa » n'est PAS listé ici : la taxonomie a un type `villa` distinct, et
  // le faire passer aussi pour une maison crée une égalité que rien ne départage.
  maison: ["maison", "pavillon", "longere"],
  villa: ["villa", "mas", "bastide"],
  chambre: ["chambre", "chambre chez l habitant", "colocation"],
  chalet: ["chalet"],
  terrain: ["terrain", "parcelle"],
  parking: ["parking", "garage", "box"],
  "local-commercial": ["local commercial", "commerce", "boutique"],
  bureau: ["bureau", "bureaux"],
  immeuble: ["immeuble"],
  ferme: ["ferme", "corps de ferme"],
  chateau: ["chateau"],
  "mobil-home": ["mobil home", "mobilhome"],
  peniche: ["peniche"],
  insolite: ["cabane", "yourte", "tiny house"],
  "box-stockage": ["box de stockage", "garde meuble"],
  "appartement-entier": ["appartement entier", "logement entier"],
  voitures: ["voiture", "auto", "berline", "citadine", "suv", "break", "cabriolet", "coupe", "monospace", "4x4"],
  motos: ["moto", "scooter", "125", "roadster"],
  utilitaires: ["utilitaire", "fourgon", "camionnette", "camion", "fourgonnette"],
  "camping-cars": ["camping car", "van amenage", "fourgon amenage"],
  nautisme: ["bateau", "voilier", "semi rigide", "jet ski"],
  velos: ["velo", "vtt", "velo electrique"],
  caravanes: ["caravane"],
  pieces: ["piece detachee", "pneu", "jante"],
  sonorisation: ["sono", "sonorisation", "enceinte", "table de mixage"],
  photographe: ["photographe", "photographie", "shooting", "videaste"],
};

/**
 * Termes qui *nomment* la famille du nœud, par opposition à ceux simplement
 * tolérés dans son lexique. Sert à départager : « fourgon » nomme la famille
 * des utilitaires, il n'est qu'emprunté par le lexique des voitures.
 */
export function canonicalHeadNouns(node: { rootSlug: string; subSlug: string; typeSlug: string }): string[] {
  const headSlug = TRANSACTION_SLUGS.has(node.typeSlug) ? node.subSlug : node.typeSlug;
  return headNounsForSlug(headSlug);
}

function headNounsForSlug(slug: string): string[] {
  if (SLUG_HEAD_NOUNS[slug]) return SLUG_HEAD_NOUNS[slug];
  // Repli : le slug lui-même, tirets en espaces. Pauvre mais jamais faux.
  return [slug.replace(/-/g, " ")];
}

// ─────────────────────────────────────────────────────────────
// Construction du registre
// ─────────────────────────────────────────────────────────────

type RawTaxonomy = {
  categories: {
    slug: string;
    label: string;
    subcategories: {
      slug: string;
      label: string;
      transaction_types?: string[];
      types: string[];
    }[];
  }[];
};

/**
 * Deux formes de clé cohabitent dans la taxonomie fournie, et il faut les
 * distinguer pour savoir où se trouve le nom-tête :
 *
 *   immobilier.vente.appartement      → transaction au niveau 2, chose au niveau 3
 *   vehicules.voitures.vente          → chose au niveau 2, transaction au niveau 3
 *
 * Le test est fait sur le slug de niveau 3 : s'il désigne une transaction, le
 * nom-tête vient du niveau 2.
 */
function buildNodes(): ListingNode[] {
  const taxonomy = taxonomyRoots as RawTaxonomy;
  const nodes: ListingNode[] = [];

  for (const root of taxonomy.categories) {
    for (const sub of root.subcategories) {
      for (const typeSlug of sub.types) {
        const key = `${root.slug}.${sub.slug}.${typeSlug}`;
        const typeIsTransaction = TRANSACTION_SLUGS.has(typeSlug);
        const headSlug = typeIsTransaction ? sub.slug : typeSlug;

        const transactions = (typeIsTransaction
          ? [typeSlug.replace(/-/g, "_")]
          : (sub.transaction_types ?? [])) as TransactionKind[];

        const config = CONFIG_BY_KEY.get(key);
        const cls = config?.classifier;

        nodes.push({
          key,
          rootSlug: root.slug,
          subSlug: sub.slug,
          typeSlug,
          label: `${root.label} · ${sub.label} · ${typeSlug.replace(/-/g, " ")}`,
          transactions: transactions.length > 0 ? transactions : ["vente"],
          headNouns: cls?.head_nouns ?? headNounsForSlug(headSlug),
          modifiers: cls?.modifiers ?? [],
          negatives: cls?.negative ?? [],
          transactionCues: cls?.transaction_cues ?? {},
          hasConfig: Boolean(cls),
        });
      }
    }
  }

  return nodes;
}

export const LISTING_NODES: ListingNode[] = buildNodes();

export const NODES_BY_KEY = new Map(LISTING_NODES.map((n) => [n.key, n]));

/** Nœuds d'une racine — sert aux garde-fous inter-catégories. */
export function nodesOfRoot(rootSlug: string): ListingNode[] {
  return LISTING_NODES.filter((n) => n.rootSlug === rootSlug);
}
