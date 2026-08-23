/**
 * Titre et description d'une fiche annonce.
 *
 * ── Pourquoi ce fichier existe ────────────────────────────────────────────
 *
 * Le crawl du 23/08/2026 a trouvé 33 fiches `/annonce/{id}/{slug}` affichant le
 * titre et la description du site — « Deal&Co — Petites annonces gratuites
 * entre particuliers en France » — au lieu des leurs. Trente-trois pages qui
 * disent toutes la même chose à Google, et aucune qui dise ce qu'elle vend.
 *
 * La cause n'était pas une donnée manquante. `generateMetadata` construisait
 * bien un titre… mais seulement après avoir passé le juge d'indexabilité. Les
 * branches qui retournaient tôt — annonce non approuvée, annonce sous le seuil
 * de qualité — ne renvoyaient que `robots` et `alternates`. Or un objet
 * `Metadata` sans `title` **hérite** de celui du layout racine : Next ne laisse
 * pas la balise vide, il remonte l'arbre. Le `noindex` était correct, le titre
 * générique était un effet de bord invisible en revue de code.
 *
 * D'où ce module. Le titre et la description se construisent **avant** toute
 * décision d'indexation, à partir des seules données de l'annonce, et les deux
 * routes les partagent. Une page peut désormais être `noindex` et correctement
 * intitulée : ce sont deux questions différentes, et rien ne justifiait que la
 * réponse à la seconde dépende de la première.
 *
 * ── Ce que le repli n'est pas ─────────────────────────────────────────────
 *
 * Un repli générique reproduirait exactement le défaut qu'on corrige. Chaque
 * repli ici reste **propre à l'annonce** : à défaut de description, on décrit
 * l'annonce avec ce qu'on a — son titre, sa catégorie, sa ville, son prix. Deux
 * annonces différentes ne peuvent pas produire la même chaîne.
 */

import { displayCity } from "@/lib/seo/city";

/** Longueur de titre au-delà de laquelle Google tronque dans ses résultats. */
export const TITLE_CAP = 60;

/**
 * Suffixe de marque — ajouté **par le layout racine**, jamais ici.
 *
 * `app/layout.tsx` déclare `title: { template: "%s | Deal&Co" }` : Next colle
 * donc le suffixe à tout titre de page rendu sous ce layout. Le construire ici
 * en plus produisait « … — 130 € | Deal&Co | Deal&Co », visible en production
 * le 23/08/2026 sur toutes les fiches annonces. Le défaut préexistait à la
 * refonte de ce module — l'ancienne version ajoutait déjà le suffixe à la main
 * — mais il s'est étendu à toutes les fiches en même temps que le correctif
 * des titres génériques.
 *
 * La constante reste utilisée à deux endroits : pour réserver la place du
 * suffixe dans la troncature, et pour composer les titres Open Graph et
 * Twitter, auxquels le `template` ne s'applique pas.
 */
export const BRAND_SUFFIX = " | Deal&Co";

/**
 * Longueur cible d'une description.
 *
 * 155 caractères hors mentions ajoutées : c'est la limite d'affichage usuelle,
 * et une description tronquée par Google au milieu d'un mot inspire moins
 * confiance qu'une phrase qui finit.
 */
const DESC_BODY_CAP = 155;
/** En dessous, la description de l'annonce ne décrit rien : on compose. */
const DESC_MIN_USEFUL = 30;

export type ListingMetaInput = {
  title: string;
  description?: string | null;
  /** Localisation brute telle qu'elle est stockée : « 59000 Lille », « Lille ». */
  location?: string | null;
  price?: number | null;
  category?: string | null;
  subcategory?: string | null;
};

/**
 * Met une majuscule à chaque mot d'un nom de ville.
 *
 * `displayCity` retombe sur le texte brut de l'annonce quand la commune n'est
 * pas au référentiel — et ce texte est saisi à la main : « sens », « gournay
 * sur marne ». Un titre de résultat de recherche qui écrit une ville en
 * minuscules passe pour négligé, et c'est le premier signal de qualité que voit
 * quelqu'un qui ne connaît pas le site.
 *
 * Les particules restent en bas de casse : « Saint-Denis », mais « Gournay sur
 * Marne » plutôt que « Gournay Sur Marne ».
 */
const LOWER_PARTICLES = new Set(["de", "du", "des", "le", "la", "les", "sur", "sous", "en", "aux", "d", "l"]);

export function titleCaseCity(value: string): string {
  return value
    .split(" ")
    .map((word, index) =>
      word
        .split("-")
        .map((part) => {
          const lower = part.toLocaleLowerCase("fr-FR");
          if (index > 0 && LOWER_PARTICLES.has(lower)) return lower;
          return lower.charAt(0).toLocaleUpperCase("fr-FR") + lower.slice(1);
        })
        .join("-"),
    )
    .join(" ");
}

export type ListingMeta = {
  /**
   * Titre de la page, **sans** le suffixe de marque : c'est le `template` du
   * layout racine qui l'ajoute. Le poser ici le doublerait.
   */
  title: string;
  /**
   * Le même, suffixe compris, pour Open Graph et Twitter — où le `template` ne
   * s'applique pas et où le nom du site doit figurer.
   */
  titleWithBrand: string;
  description: string;
  /** « 1 500 € » ou « Prix à débattre » — jamais « 0 € ». */
  priceLabel: string;
  /** Ville affichable, sans code postal. Chaîne vide si non résolue. */
  city: string;
};

/**
 * Prix affichable.
 *
 * Un prix nul ou absent n'est pas zéro euro : c'est un prix qui n'a pas été
 * donné. « 0 € » dans un résultat de recherche se lit comme une erreur, et le
 * clic n'a pas lieu.
 */
export function priceLabelOf(price: number | null | undefined): string {
  return price && price > 0 ? `${price.toLocaleString("fr-FR")} €` : "Prix à débattre";
}

/**
 * Tronque un titre sans couper un mot en deux.
 *
 * Le budget est le plafond moins le suffixe de marque : celui-ci doit survivre
 * à la troncature, sinon les résultats perdent le nom du site — la seule partie
 * du titre qui construise quelque chose sur la durée.
 */
function truncateTitle(raw: string): string {
  // Le budget réserve la place du suffixe que le layout ajoutera : c'est le
  // titre complet, une fois le `template` appliqué, qui doit tenir dans la
  // largeur d'affichage.
  const budget = TITLE_CAP - BRAND_SUFFIX.length;
  if (raw.length <= budget) return raw;

  const cut = raw.slice(0, budget - 1);
  const lastSpace = cut.lastIndexOf(" ");
  // Un dernier espace trop tôt signifierait un mot unique très long : mieux
  // vaut alors couper net que de renvoyer trois lettres.
  const body = lastSpace > budget * 0.6 ? cut.slice(0, lastSpace) : cut;
  return body.trimEnd() + "…";
}

/**
 * Construit titre et description d'une annonce.
 *
 * Format retenu, identique à celui des fiches déjà correctes :
 *
 *     Volkswagen GOLF 1.6 TDI à Lille — 1 500 € | Deal&Co
 *
 * La ville disparaît quand elle n'est pas résolue, le prix devient « Prix à
 * débattre » quand il n'est pas donné. Dans tous les cas il reste le titre de
 * l'annonce, qui est ce que la personne a écrit et ce qu'elle cherche à vendre.
 */
export function buildListingMeta(input: ListingMetaInput): ListingMeta {
  const title = (input.title ?? "").trim();
  const priceLabel = priceLabelOf(input.price);
  const rawCity = (input.location ? displayCity(input.location) : "") || "";
  const city = rawCity ? titleCaseCity(rawCity) : "";

  const rawTitle = city ? `${title} à ${city} — ${priceLabel}` : `${title} — ${priceLabel}`;
  const truncated = truncateTitle(rawTitle);

  return {
    title: truncated,
    titleWithBrand: truncated + BRAND_SUFFIX,
    description: buildDescription(input, { city, priceLabel }),
    priceLabel,
    city,
  };
}

/**
 * Description : celle de l'annonce quand elle en a une, sinon une phrase
 * composée à partir de ses attributs.
 *
 * Le repli n'est pas un texte de marque : il contient le titre, la catégorie,
 * la ville et le prix de cette annonce précise. Deux annonces ne peuvent donc
 * pas produire la même — ce qui est tout l'objet de la correction.
 */
function buildDescription(
  input: ListingMetaInput,
  ctx: { city: string; priceLabel: string },
): string {
  const body = (input.description ?? "").replace(/\s+/g, " ").trim();
  const where = ctx.city ? ` à ${ctx.city}` : "";

  if (body.length >= DESC_MIN_USEFUL) {
    const truncated =
      body.length > DESC_BODY_CAP ? `${body.slice(0, DESC_BODY_CAP).trimEnd()}…` : body;
    // La localisation et le prix complètent la description plutôt que de la
    // remplacer : ce sont les deux informations qu'on cherche dans un résultat
    // de petite annonce, et elles manquent presque toujours au texte libre.
    return ctx.city ? `${truncated} · ${ctx.city} · ${ctx.priceLabel}` : `${truncated} · ${ctx.priceLabel}`;
  }

  // Repli : l'annonce n'a pas de description exploitable — un import externe,
  // un dépôt expédié en trois mots. On décrit ce qu'on sait.
  const kind = input.subcategory?.trim() || input.category?.trim() || null;
  const kindPart = kind ? ` ${kind.toLowerCase()}` : "";

  return `${input.title.trim()}${where} — ${ctx.priceLabel}. Annonce${kindPart} déposée sur Deal&Co : contact direct avec le vendeur, sans commission ni intermédiaire.`;
}
