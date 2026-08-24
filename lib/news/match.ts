/**
 * Reconnaissance de la marque et du modèle dans un titre de presse.
 *
 * ── La règle qui gouverne ce fichier : précision avant couverture ─────────
 *
 * Chaque rattachement réussi place un titre de presse sur une page publique de
 * Deal&Co. Un rattachement faux y place un titre hors sujet — une Clio citée
 * sur la page de la Golf. Le visiteur le voit immédiatement, et la page perd
 * précisément la crédibilité que ce bloc devait lui donner.
 *
 * Deux conséquences assumées :
 *
 *   1. **On ne devine pas un modèle.** Le modèle n'est retenu que s'il figure
 *      dans notre propre catalogue, celui construit à partir des annonces
 *      réelles. « Peugeot dévoile son nouveau concept » ne produit donc aucun
 *      modèle — et c'est le bon résultat, il n'existe aucune page à alimenter.
 *   2. **Un article sans marque reconnue reste stocké**, sans rattachement. Il
 *      compte dans la veille éditoriale sans jamais s'afficher nulle part.
 */

import { CAR_BRANDS } from "@/lib/carBrands";
import { normalizeToken } from "@/lib/seo/city";

export type ModelEntry = {
  /** Slug du modèle seul, tel qu'il sort de `normalizeToken("Clio")`. */
  slug: string;
  /** Libellé d'origine, pour l'affichage. */
  label: string;
};

/** Modèles connus, par slug de marque. Construit depuis les annonces réelles. */
export type ModelCatalogue = Map<string, ModelEntry[]>;

/**
 * Variantes de marque que le catalogue de logos ne porte pas.
 *
 * La presse écrit « VW » et « Mercedes » ; nos pages disent « Volkswagen » et
 * « Mercedes-Benz ». Sans ces équivalences, les deux marques les plus citées de
 * France passeraient à travers.
 */
const BRAND_ALIASES: Record<string, string> = {
  vw: "volkswagen",
  // Le catalogue dit « Mercedes-Benz », la presse écrit « Mercedes » — et sans
  // cette ligne, « le patron de Mercedes » ne se rattachait à rien. Un test
  // vérifie que chaque cible ci-dessous existe bien dans le catalogue : c'est
  // exactement l'erreur qui s'était glissée ici.
  mercedes: "mercedes-benz",
  "range-rover": "land-rover",
  alfa: "alfa-romeo",
  "ds-automobiles": "ds",
};

/** Cibles des alias, pour que le test puisse vérifier qu'elles existent. */
export const BRAND_ALIAS_TARGETS = Object.values(BRAND_ALIASES);
export const KNOWN_BRAND_SLUGS = new Set(CAR_BRANDS.map((b) => normalizeToken(b.name)));

/** Marques connues, du slug le plus long au plus court. */
const BRAND_SLUGS: { slug: string; name: string }[] = CAR_BRANDS.map((b) => ({
  slug: normalizeToken(b.name),
  name: b.name,
})).sort((a, b) => b.slug.length - a.slug.length);

/**
 * Marques trop courtes ou trop communes pour être cherchées telles quelles.
 *
 * « DS » apparaît dans « DS 7 » mais aussi au milieu de n'importe quel mot une
 * fois le titre découpé en tirets. Ces marques exigent une correspondance de
 * mot entier, jamais de sous-chaîne.
 */
const SHORT_BRANDS = new Set(["ds", "byd", "mg", "gmc", "kia", "seat", "smart"]);

/**
 * Marques dont le nom est aussi un mot courant du français.
 *
 * « Devenez un héros, achetez cette **mini** tout-terrain » : le titre parle
 * d'un petit 4×4, pas de la marque Mini. Le titre normalisé ne permet pas de
 * les distinguer — la casse d'origine, si. Ces marques exigent donc une
 * majuscule dans le titre tel qu'il a été écrit.
 *
 * « Seat » et « Smart » relèvent du même piège en anglais, « DS » de
 * l'abréviation. La règle leur est appliquée pareil.
 */
const AMBIGUOUS_BRANDS = new Set(["mini", "smart", "seat", "ds", "up"]);

/** Le nom de la marque figure-t-il avec une majuscule dans le titre d'origine ? */
function appearsCapitalized(rawTitle: string, brandName: string): boolean {
  const escaped = brandName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // Bornes de mot posées à la main : `\b` se comporte mal autour des accents.
  return new RegExp(`(^|[^\\p{L}])${escaped}([^\\p{L}]|$)`, "u").test(rawTitle);
}

/**
 * Marque reconnue dans un titre, ou `null`.
 *
 * La recherche porte sur le titre normalisé encadré de tirets — « -peugeot- »
 * plutôt que « peugeot » — pour qu'un nom ne soit jamais reconnu à l'intérieur
 * d'un mot. « Seat » ne doit pas se déclencher sur « seating ».
 */
export function detectBrand(title: string): { slug: string; name: string } | null {
  const hay = `-${normalizeToken(title)}-`;

  for (const [alias, target] of Object.entries(BRAND_ALIASES)) {
    if (hay.includes(`-${alias}-`)) {
      const brand = BRAND_SLUGS.find((b) => b.slug === target);
      if (brand) return brand;
    }
  }

  for (const brand of BRAND_SLUGS) {
    const ambiguous = AMBIGUOUS_BRANDS.has(brand.slug);
    if (hay.includes(`-${brand.slug}-`)) {
      if (ambiguous && !appearsCapitalized(title, brand.name)) continue;
      return brand;
    }
    // Les marques longues tolèrent l'accolement (« -alfaromeo- »), pas les
    // courtes : « -mg- » collé donnerait n'importe quoi.
    if (!SHORT_BRANDS.has(brand.slug) && brand.slug.length >= 6) {
      const glued = brand.slug.replace(/-/g, "");
      if (glued !== brand.slug && hay.includes(`-${glued}-`)) return brand;
    }
  }

  return null;
}

/**
 * Modèle reconnu dans un titre, parmi ceux que nous avons réellement en base.
 *
 * En cas de plusieurs correspondances, la plus longue gagne : « Série 3 » doit
 * l'emporter sur « 3 », et « Model Y » sur « Model ».
 */
export function detectModel(
  title: string,
  brandSlug: string,
  catalogue: ModelCatalogue,
): ModelEntry | null {
  const models = catalogue.get(brandSlug);
  if (!models || models.length === 0) return null;

  const hay = `-${normalizeToken(title)}-`;

  let best: ModelEntry | null = null;
  for (const model of models) {
    if (!model.slug) continue;
    // Un modèle d'un seul caractère (« Q », « i ») ne se cherche pas : le bruit
    // dépasserait de loin le signal.
    if (model.slug.length < 2) continue;
    if (!hay.includes(`-${model.slug}-`)) continue;
    if (!best || model.slug.length > best.slug.length) best = model;
  }

  return best;
}

export function matchTitle(
  title: string,
  catalogue: ModelCatalogue,
): { brandSlug: string | null; modelSlug: string | null } {
  const brand = detectBrand(title);
  if (!brand) return { brandSlug: null, modelSlug: null };
  const model = detectModel(title, brand.slug, catalogue);
  return { brandSlug: brand.slug, modelSlug: model?.slug ?? null };
}
