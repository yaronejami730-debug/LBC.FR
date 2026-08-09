/**
 * Précision de l'adresse affichée sur une annonce.
 *
 * La règle tient en une phrase : **une adresse professionnelle est publique,
 * une adresse personnelle ne l'est pas.**
 *
 * Un magasin, un garage, un cabinet ont pignon sur rue. Leur adresse complète
 * figure déjà sur leur devanture, sur leur fiche d'établissement et au registre
 * du commerce : la publier aide l'acheteur à venir, et ne révèle rien.
 *
 * Le domicile d'un particulier, non. Un numéro et un nom de rue associés à un
 * objet de valeur et à une disponibilité, c'est une invitation au cambriolage,
 * pas une information utile à l'acheteur. Pour lui, « Paris 19e » suffit à
 * décider s'il se déplace.
 *
 * D'où la coupe : côté professionnel, l'adresse passe telle quelle ; côté
 * particulier, tout ce qui descend sous la commune est retiré — numéro de voie,
 * type de voie, nom de rue, bâtiment, étage. La commune, l'arrondissement, le
 * département et la région sont conservés.
 */

export type PostedAs = "PARTICULIER" | "PRO";

/** Types de voie français — le mot qui trahit une adresse précise. */
const STREET_WORDS = [
  "rue",
  "avenue",
  "av",
  "boulevard",
  "bd",
  "bvd",
  "impasse",
  "allee",
  "allée",
  "chemin",
  "route",
  "rte",
  "voie",
  "quai",
  "place",
  "pl",
  "square",
  "passage",
  "sentier",
  "cours",
  "faubourg",
  "villa",
  "cite",
  "cité",
  "hameau",
  "lotissement",
  "residence",
  "résidence",
  "batiment",
  "bâtiment",
  "bat",
  "immeuble",
  "etage",
  "étage",
  "appartement",
  "appt",
  "apt",
  "escalier",
  "porte",
  "lieu-dit",
  "zi",
  "za",
  "zac",
];

function deaccent(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** Un fragment décrit-il une voie plutôt qu'une commune ? */
function isStreetFragment(fragment: string): boolean {
  const norm = deaccent(fragment.trim().toLowerCase());
  if (!norm) return false;

  // « 12 bis rue des Lilas », « 3 avenue… » : un numéro en tête ne peut
  // désigner qu'une voie. Un code postal (5 chiffres) n'est pas un numéro de rue.
  if (/^\d{1,4}\s*(bis|ter|quater)?\b/.test(norm) && !/^\d{5}$/.test(norm.trim())) return true;

  const words = norm.split(/[\s'’-]+/).filter(Boolean);
  return words.some((w) => STREET_WORDS.includes(w));
}

/**
 * Réduit une localisation à ce qui est publiable pour la casquette donnée.
 *
 * Ne devine jamais : ce qui n'est pas identifiable comme une voie est conservé.
 * Mieux vaut laisser passer un fragment ambigu que d'effacer le nom d'une
 * commune qui ressemblerait à une rue.
 */
export function sanitizeLocation(raw: string, postedAs: PostedAs): string {
  const value = (raw ?? "").trim();
  if (!value) return "";
  if (postedAs === "PRO") return value.slice(0, 200);

  const kept = value
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part && !isStreetFragment(part));

  // Tout a été coupé : la saisie était une adresse de bout en bout. On garde
  // le dernier fragment (le plus général — souvent la ville) débarrassé de son
  // éventuel numéro, plutôt que de renvoyer une localisation vide.
  if (kept.length === 0) {
    const last = value.split(",").pop()?.trim() ?? "";
    return last.replace(/^\d{1,4}\s*(bis|ter|quater)?\s*/i, "").slice(0, 120);
  }

  return kept.join(", ").slice(0, 120);
}

/**
 * L'adresse précise doit-elle être stockée séparément ?
 *
 * Seulement côté professionnel : côté particulier il n'y a rien à conserver,
 * et garder « au cas où » une adresse qu'on s'interdit d'afficher reviendrait à
 * collecter une donnée sans usage.
 */
export function addressLineFor(raw: string, postedAs: PostedAs): string | null {
  if (postedAs !== "PRO") return null;
  const value = (raw ?? "").trim();
  return value ? value.slice(0, 200) : null;
}

export type PostingCapabilities = {
  /** Le compte peut-il publier en professionnel ? */
  canPostAsPro: boolean;
  /** Le compte peut-il publier en particulier ? */
  canPostAsPrivate: boolean;
  /** Faut-il poser la question à la publication ? */
  mustChoose: boolean;
  /** Valeur retenue quand aucune question n'est posée. */
  defaultMode: PostedAs;
};

/**
 * Détermine ce qu'un compte a le droit de publier.
 *
 * Trois cas, et la distinction vient du type de demande professionnelle :
 *
 * - **Particulier** → publie en particulier, sans question.
 * - **Professionnel dès l'inscription** (`DIRECT_PROFESSIONAL`) → publie en
 *   professionnel, sans question. Le compte a été ouvert pour ça.
 * - **Particulier devenu professionnel** (`CONVERT_FROM_PRIVATE`) → on demande.
 *   La personne existait avant son entreprise et continue de vendre ses
 *   affaires personnelles ; lui imposer la casquette pro afficherait l'adresse
 *   de sa boutique sur la vente de son vélo.
 */
export function postingCapabilities(user: {
  isPro: boolean;
  professionalStatus: string;
  proRequestType?: string | null;
}): PostingCapabilities {
  const proActive = user.professionalStatus === "APPROVED" || user.isPro;

  if (!proActive) {
    return {
      canPostAsPro: false,
      canPostAsPrivate: true,
      mustChoose: false,
      defaultMode: "PARTICULIER",
    };
  }

  const converted = user.proRequestType === "CONVERT_FROM_PRIVATE";
  return {
    canPostAsPro: true,
    canPostAsPrivate: converted,
    mustChoose: converted,
    defaultMode: "PRO",
  };
}

/** Normalise une valeur reçue du client vers un mode autorisé. */
export function resolvePostedAs(
  requested: unknown,
  caps: PostingCapabilities,
): PostedAs {
  const wanted = requested === "PRO" ? "PRO" : requested === "PARTICULIER" ? "PARTICULIER" : null;
  if (wanted === "PRO" && caps.canPostAsPro) return "PRO";
  if (wanted === "PARTICULIER" && caps.canPostAsPrivate) return "PARTICULIER";
  return caps.defaultMode;
}
