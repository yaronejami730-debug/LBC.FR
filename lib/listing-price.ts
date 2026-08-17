/**
 * Comment s'écrit un prix, selon ce qui est vendu.
 *
 * « 1 200 € » sur une location est faux : ce n'est pas le prix du logement,
 * c'est le loyer d'un mois. La même somme sur un gîte veut dire la nuit, sur
 * une offre d'emploi le salaire mensuel, sur un canapé la somme entière. Le
 * formulaire connaissait déjà cette distinction — il demande « Loyer (€ / mois) »
 * et fait choisir « à la nuit / à la semaine » pour une location — mais elle
 * s'arrêtait au formulaire : les vignettes, la recherche et la fiche
 * affichaient un montant nu.
 *
 * Une seule fonction, utilisée partout, plutôt qu'un `if` par écran : le jour
 * où une nature d'offre change d'unité, elle change à un seul endroit.
 */
import { listingNature } from "@/lib/offer-intent";

/** Suffixes affichés, dans le vocabulaire courant. */
const UNIT_SUFFIX: Record<string, string> = {
  heure: "/heure",
  jour: "/jour",
  nuit: "/nuit",
  week_end: "/week-end",
  semaine: "/semaine",
  mois: "/mois",
  an: "/an",
};

type PriceInput = {
  title: string;
  description: string;
  category: string;
  subcategory?: string | null;
  price: number;
  metadata: string | null;
};

function readMeta(raw: string | null): Record<string, unknown> {
  try {
    return JSON.parse(raw || "{}") as Record<string, unknown>;
  } catch {
    return {};
  }
}

/**
 * Suffixe d'unité, ou chaîne vide pour un prix ferme.
 *
 * L'unité choisie par le vendeur prime toujours : s'il a coché « à la semaine »,
 * on ne lui impose pas le mois parce que la catégorie s'y prêterait. La
 * déduction par nature n'intervient que faute de choix explicite.
 */
export function priceUnitSuffix(listing: PriceInput): string {
  const meta = readMeta(listing.metadata);

  const explicit = typeof meta.rentalUnit === "string" ? meta.rentalUnit : null;
  if (explicit && UNIT_SUFFIX[explicit]) return UNIT_SUFFIX[explicit];

  const nature = listingNature({
    title: listing.title,
    description: listing.description,
    category: listing.category,
    subcategory: listing.subcategory ?? null,
    price: listing.price,
    metadata: listing.metadata ?? "{}",
  });

  // Un logement loué se compte au mois, y compris quand le vendeur n'a rien
  // précisé : c'est la convention du marché, et l'afficher évite de laisser
  // croire à un prix de vente.
  if (nature === "immobilier") {
    const transaction = typeof meta.transactionType === "string" ? meta.transactionType : "";
    if (/loc/i.test(transaction)) return UNIT_SUFFIX.mois;
    return "";
  }

  // Emploi : le champ du formulaire annonce « salaire indicatif (€ / mois) ».
  if (nature === "emploi") return UNIT_SUFFIX.mois;

  // Location d'un bien sans unité choisie : la journée est le repère par
  // défaut du formulaire.
  if (nature === "location") return UNIT_SUFFIX.jour;

  return "";
}

/** Prix complet, unité comprise : « 1 200 €/mois ». */
export function formatListingPrice(listing: PriceInput): string {
  const amount = `${listing.price.toLocaleString("fr-FR")} €`;
  return `${amount}${priceUnitSuffix(listing)}`;
}
