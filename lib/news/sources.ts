/**
 * Flux de presse suivis.
 *
 * ── Pourquoi une liste écrite à la main ───────────────────────────────────
 *
 * Un flux n'est pas une donnée neutre : chaque ligne qu'il apporte finira citée
 * sur une page indexable de Deal&Co, avec un lien sortant. Ce que nous citons
 * engage le site. La liste reste donc courte, explicite, et chaque entrée porte
 * le nom du média tel qu'il sera affiché au visiteur — jamais un domaine deviné
 * à partir de l'URL.
 *
 * `fr.motor1.com/rss/` est une page d'index HTML, pas un flux : elle liste les
 * flux disponibles. L'adresse réellement exploitable est
 * `/rss/articles/all/`, qui rend bien un `application/rss+xml`.
 */

/**
 * Nature de ce qu'un flux publie. La distinction n'est pas cosmétique : elle
 * commande la durée de vie.
 *
 *   `actualite` — périssable. « Le patron de VW alerte le personnel » n'a plus
 *                 d'intérêt trois mois plus tard.
 *   `essai`     — durable. « Renault Clio full hybrid : test de consommation
 *                 réelle », publié en mars, répond encore en août à quelqu'un
 *                 qui achète une Clio. Le dater suffit à rester honnête ;
 *                 l'appeler « actualité » serait faux.
 *
 * Mesuré le 24/08/2026 : les rubriques essais et guides de Motor1 sont des
 * archives (jusqu'à 2018), le flux général est frais. Leur appliquer la même
 * fenêtre revenait à n'afficher jamais rien sur les pages modèle — soit
 * précisément les pages que ce système devait servir.
 */
export type NewsKind = "actualite" | "essai" | "video";

/**
 * Rubriques.
 *
 * Elles ne viennent pas d'une analyse du texte mais du flux d'où l'article
 * sort : c'est le média qui range ses articles, et il le fait mieux qu'un
 * classement deviné après coup.
 *
 * ── Deux univers, deux entrées ────────────────────────────────────────────
 *
 * L'automobile est traitée à part, et ce n'est pas un détail d'organisation.
 * Un essai de Clio et un article sur la rentrée scolaire n'ont ni le même
 * lecteur, ni la même utilité pour le site : le premier se lit à côté d'une
 * cote et d'annonces, le second se lit pour lui-même. Les mélanger dans une
 * seule grille donnait une page qui ne s'adressait à personne.
 *
 * `AUTO_SECTION` alimente donc **Deal&Co Auto** (`/actualites/auto`), et
 * `INFO_SECTIONS` alimente **Deal&Co Info** (`/actualites`).
 */
export const AUTO_SECTION = "auto";

export const INFO_SECTIONS = [
  { slug: "general", label: "À la une" },
  { slug: "societe", label: "Société" },
  { slug: "economie", label: "Économie" },
  { slug: "tech", label: "High-Tech" },
  { slug: "sport", label: "Sport" },
] as const;

/** Toutes rubriques confondues — sert aux vérifications de cohérence. */
export const SECTIONS = [
  { slug: AUTO_SECTION, label: "Auto" },
  ...INFO_SECTIONS,
] as const;

export const INFO_SECTION_SLUGS: string[] = INFO_SECTIONS.map((s) => s.slug);

export type SectionSlug = (typeof SECTIONS)[number]["slug"];

export function sectionLabel(slug: string): string | null {
  return SECTIONS.find((s) => s.slug === slug)?.label ?? null;
}

/** Clés de flux d'une rubrique, ou de plusieurs. */
export function sourceKeysOfSection(slug: string | string[]): string[] {
  const wanted = Array.isArray(slug) ? new Set(slug) : new Set([slug]);
  return NEWS_SOURCES.filter((s) => wanted.has(s.section)).map((s) => s.key);
}

export type NewsSource = {
  /** Clé stable, stockée en base. Ne change jamais. */
  key: string;
  kind: NewsKind;
  section: SectionSlug;
  /** Nom du média, affiché à côté de chaque titre cité. */
  publisher: string;
  url: string;
  /** Page d'accueil du média, pour la mention de source. */
  homepage: string;
};

/**
 * ── Pourquoi plusieurs flux du même média ────────────────────────────────
 *
 * Le flux général de Motor1 est surtout de l'actualité d'industrie : sur vingt
 * articles mesurés le 24/08/2026, douze nommaient une marque et **un seul** un
 * modèle. C'est peu, parce que nos pages sont des pages de modèle.
 *
 * Les rubriques ci-dessous sont retenues pour une raison précise : un essai, un
 * duel ou un guide d'achat **nomme forcément le modèle dont il parle**. C'est
 * la même matière première, mais découpée là où elle rencontre nos pages.
 */
export const NEWS_SOURCES: NewsSource[] = [
  motor1("motor1-fr", "articles/all", "actualite"),
  motor1("motor1-fr-essais", "category/car-reviews", "essai"),
  motor1("motor1-fr-premier-essai", "category/premier-essai", "essai"),
  motor1("motor1-fr-duels", "category/vs", "essai"),
  motor1("motor1-fr-a-vendre", "category/a-vendre", "actualite"),
  motor1("motor1-fr-guide-achat", "category/guide-achat-anciennes", "essai"),
  motor1("motor1-fr-consommation", "category/consommation-reelle", "essai"),
  youtube("motor1-fr-video", "Motor1 France", "UCQnSDNHHPHjwZyY6d2Jstcg"),

  // 20 Minutes — actualité générale. Deal&Co n'est pas un site automobile :
  // on y vend aussi mode, maison, multimédia, loisirs et animaux. Une revue de
  // presse qui ne parlerait que de voitures serait plus étroite que le site.
  vingtMinutes("20minutes-une", "rss-une", "general"),
  vingtMinutes("20minutes-societe", "rss-societe", "societe"),
  vingtMinutes("20minutes-economie", "rss-economie", "economie"),
  vingtMinutes("20minutes-high-tech", "rss-high-tech", "tech"),
  vingtMinutes("20minutes-sport", "rss-sport", "sport"),
];

/**
 * Un flux Motor1. Le nom affiché reste celui du média, jamais celui de la
 * rubrique : le visiteur doit lire « Motor1 France », pas « motor1-fr-duels ».
 */
function motor1(key: string, path: string, kind: NewsKind): NewsSource {
  return {
    key,
    kind,
    section: "auto",
    publisher: "Motor1 France",
    url: `https://fr.motor1.com/rss/${path}/`,
    homepage: "https://fr.motor1.com/",
  };
}

/**
 * Une chaîne YouTube.
 *
 * YouTube publie un flux Atom par chaîne, et l'intégration de son lecteur est
 * l'usage prévu par la plateforme : la vidéo est lue depuis chez YouTube, avec
 * son décompte de vues et son lien vers la chaîne. Rien n'est réhébergé.
 *
 * Pour en ajouter une : ouvrir la chaîne, relever son `channelId` (visible dans
 * la source de la page), et ajouter une ligne ci-dessus.
 */
function youtube(key: string, publisher: string, channelId: string): NewsSource {
  return {
    key,
    kind: "video",
    section: "auto",
    publisher,
    url: `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`,
    homepage: `https://www.youtube.com/channel/${channelId}`,
  };
}

/**
 * Flux par journaliste de Motor1.
 *
 * Ils servent à deux choses, et la seconde compte autant que la première :
 *
 *   1. rendre à chaque article la signature de la personne qui l'a écrit ;
 *   2. repérer le publi-rédactionnel. Motor1 signe ses contenus sponsorisés
 *      d'un auteur dédié — s'y fier est plus fiable que d'espérer une rubrique.
 */
export const MOTOR1_AUTHORS: { slug: string; name: string }[] = [
  { slug: "emmanuel-rolland", name: "Emmanuel Rolland" },
  { slug: "lucas-huaume", name: "Lucas Huaume" },
  { slug: "flavio-atzori", name: "Flavio Atzori" },
  { slug: "juan-felipe-munoz", name: "Juan Felipe Muñoz" },
  { slug: "sergio-chierici", name: "Sergio Chierici" },
  { slug: "stefan-wagner", name: "Stefan Wagner" },
  { slug: "thomas-tironi", name: "Thomas Tironi" },
  { slug: "redaction", name: "La rédaction" },
];

/** Flux dont tout article est du contenu sponsorisé : capté par personne. */
export const MOTOR1_SPONSORED_AUTHOR = "contenu-sponsorise";

export function authorFeedUrl(slug: string): string {
  return `https://fr.motor1.com/rss/author/${slug}/`;
}

/** Signature affichée quand le recoupement n'a rien donné. */
export const DEFAULT_BYLINE = "La rédaction";

/**
 * Un flux 20 Minutes.
 *
 * Ces flux publient le corps complet de l'article dans une balise `<body>`.
 * Il n'est ni lu ni stocké : le flux porte `<copyright>20minutes.fr</copyright>`,
 * et un texte intégral livré n'est pas un texte intégral cédé. Ce qu'on reprend
 * reste ce que reprend n'importe quel agrégateur — titre, chapô, visuel,
 * signature, date — avec le lien vers l'article.
 */
function vingtMinutes(key: string, path: string, section: SectionSlug): NewsSource {
  return {
    key,
    kind: "actualite",
    section,
    publisher: "20 Minutes",
    url: `https://www.20minutes.fr/feeds/${path}.xml`,
    homepage: "https://www.20minutes.fr/",
  };
}

export function sourceByKey(key: string): NewsSource | null {
  return NEWS_SOURCES.find((s) => s.key === key) ?? null;
}

export function sourceKeysOfKind(kind: NewsKind): string[] {
  return NEWS_SOURCES.filter((s) => s.kind === kind).map((s) => s.key);
}

/**
 * Durée de vie par nature, en jours.
 *
 * Trois ans pour un essai : au-delà, le modèle a changé de génération et
 * l'article ne décrit plus la voiture qu'on achète aujourd'hui.
 */
export const MAX_AGE_DAYS: Record<NewsKind, number> = {
  actualite: 120,
  essai: 1095,
  // Une vidéo d'essai se regarde longtemps après sa mise en ligne, et une
  // chaîne publie moins souvent qu'une rédaction : fenêtre large, sinon la
  // rubrique vidéo serait vide la moitié du temps.
  video: 1095,
};

/**
 * Rubriques écartées à l'entrée.
 *
 * Un contenu sponsorisé reste un contenu sponsorisé même cité en trois mots :
 * lui donner un lien depuis une page indexable reviendrait à relayer une
 * publicité sans le dire. On ne le stocke pas.
 */
const EXCLUDED_CATEGORIES = ["sponsoris", "partenaire", "publi-", "advertorial"];

export function isExcludedCategory(categories: string[]): boolean {
  return categories.some((c) => {
    const low = c.toLowerCase();
    return EXCLUDED_CATEGORIES.some((bad) => low.includes(bad));
  });
}
