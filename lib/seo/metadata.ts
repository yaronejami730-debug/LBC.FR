import type { Metadata } from "next";

/**
 * Fabrique unique des metadata de page.
 *
 * Avant : chaque page réécrivait son bloc `openGraph`, son `alternates`, son
 * `locale`, et 27 pages n'en avaient aucun — dont toute la verticale Pet, donc
 * invisible en recherche comme en partage. Le problème n'était pas l'oubli
 * d'une balise ici ou là, c'était qu'il n'existait aucun endroit où la règle
 * pouvait être écrite une seule fois.
 *
 * Règle posée ici : une page indexable a **toujours** un titre, une
 * description, un canonical absolu et un Open Graph cohérent. Une page privée
 * a un titre et un `noindex` — pas de canonical, pas d'OG, il n'y a rien à
 * partager.
 */

export const SITE_URL = "https://www.dealandcompany.fr";
export const SITE_NAME = "Deal&Co";

/** URL absolue à partir d'un chemin, sans double slash ni domaine en double. */
export function absoluteUrl(path: string): string {
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

type PageMetaInput = {
  title: string;
  description: string;
  /** Chemin de la page, ex. `/pet`. Sert de canonical et d'`og:url`. */
  path: string;
  /**
   * Image de partage. Chemin relatif (`/pet/opengraph-image`) ou URL absolue.
   * Omis : on retombe sur l'image du layout racine.
   */
  image?: string | null;
  /** `article` pour un contenu éditorial daté, `website` sinon. */
  type?: "website" | "article";
  /**
   * Page volontairement hors index — tunnel de connexion, espace personnel,
   * page de confirmation. `follow` reste vrai : les liens doivent continuer
   * de transmettre leur valeur.
   */
  noindex?: boolean;
  /** Balises additionnelles d'un article (blog, guide). */
  publishedTime?: string;
  modifiedTime?: string;
};

/**
 * Metadata complètes d'une page.
 *
 * À utiliser dans `export const metadata` pour une page fixe, ou dans
 * `generateMetadata()` quand le titre dépend des données.
 */
export function buildPageMetadata({
  title,
  description,
  path,
  image,
  type = "website",
  noindex = false,
  publishedTime,
  modifiedTime,
}: PageMetaInput): Metadata {
  const url = absoluteUrl(path);

  if (noindex) {
    // Ni canonical ni Open Graph : déclarer une URL canonique sur une page
    // qu'on demande à ne pas indexer envoie deux ordres contradictoires.
    return {
      title,
      description,
      robots: { index: false, follow: true },
    };
  }

  const images = image ? [{ url: absoluteUrl(image), width: 1200, height: 630, alt: title }] : undefined;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      siteName: SITE_NAME,
      type,
      locale: "fr_FR",
      ...(images ? { images } : {}),
      ...(type === "article" && publishedTime ? { publishedTime } : {}),
      ...(type === "article" && modifiedTime ? { modifiedTime } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      ...(images ? { images: images.map((i) => i.url) } : {}),
    },
  };
}

/**
 * Page d'un tunnel authentifié : connexion, inscription, espace personnel.
 *
 * Elle mérite un titre correct — il s'affiche dans l'onglet et dans
 * l'historique — mais n'a rien à faire dans l'index.
 */
export function buildPrivateMetadata(title: string, description: string): Metadata {
  return buildPageMetadata({ title, description, path: "/", noindex: true });
}
