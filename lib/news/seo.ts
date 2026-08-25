/**
 * Le référencement de Deal&Co Info, en un seul endroit.
 *
 * ── Pourquoi ce module existe ─────────────────────────────────────────────
 *
 * Le référencement de la section était réparti sur cinq fichiers : chaque page
 * écrivait ses propres balises, ses propres données structurées et sa propre
 * règle d'indexation. Trois conséquences, toutes constatées :
 *
 *   · les règles divergeaient — une page d'article demandait l'index au-dessus
 *     de trois annonces liées, une rubrique au-dessus de six articles, un hub
 *     marque au-dessus de quatre. Trois seuils, trois raisonnements, aucun
 *     énoncé nulle part ;
 *   · l'essentiel de la section répondait `noindex`. Sur 190 articles captés,
 *     une poignée passait le seuil des trois annonces. Le reste était en ligne,
 *     lisible, mis à jour au quart d'heure — et invisible ;
 *   · rien ne reliait les pages entre elles aux yeux d'un moteur : ni fil
 *     d'Ariane, ni liste d'éléments, ni éditeur déclaré.
 *
 * ── La règle, maintenant, et elle est unique ──────────────────────────────
 *
 * **Une page de Deal&Co Info qui a du contenu demande l'index.** Sans seuil
 * d'annonces, sans quota d'articles. Le raisonnement qui excluait ces pages
 * — « une page qui reprend le résumé d'un autre est une page mince » — visait
 * juste au moment où la page affichait deux lignes de chapô. Ce n'est plus ce
 * qu'elle affiche : chaque article porte une citation d'une quinzaine de
 * lignes, sa signature, son heure, ses articles voisins et, quand le sujet s'y
 * prête, la cote du modèle et les annonces que nous en avons.
 *
 * Ce qui reste hors index n'y est plus par prudence mais par constat : une page
 * sans article n'a rien à montrer, et `notFound()` s'en charge avant même que
 * la question se pose.
 *
 * ── Ce que nous ne déclarons pas ──────────────────────────────────────────
 *
 * Jamais Deal&Co comme auteur. Le balisage `NewsArticle` d'une page d'article
 * nomme le journaliste et son média en `author` et en `publisher`, et pointe
 * l'original en `isBasedOn`. C'est exact, et c'est ce qui permet à un moteur de
 * comprendre qu'il lit une revue de presse attribuée plutôt qu'une copie.
 */

import type { Metadata } from "next";
import type { Article } from "@/lib/news/articles";

export const BASE = "https://www.dealandcompany.fr";

/** L'éditeur du site, tel qu'il apparaît dans toutes les données structurées. */
const SITE = {
  "@type": "Organization",
  name: "Deal&Co",
  url: BASE,
} as const;

type PageSeo = {
  title: string;
  description: string;
  /** Chemin absolu depuis la racine, sans domaine : `/actualites/societe`. */
  path: string;
  image?: string | null;
  publishedAt?: Date;
  type?: "website" | "article";
};

/**
 * Les balises d'une page de la section.
 *
 * Toutes les pages passent par ici, et aucune n'écrit `robots` : l'absence de
 * directive **est** la directive — elle vaut `index, follow`. Une exception se
 * déclarerait ici, explicitement, avec son motif.
 */
export function newsMetadata({
  title,
  description,
  path,
  image,
  publishedAt,
  type = "website",
}: PageSeo): Metadata {
  const url = `${BASE}${path}`;
  return {
    title,
    description,
    alternates: {
      canonical: url,
      types: { "application/atom+xml": `${BASE}/actualites/feed.xml` },
    },
    openGraph: {
      title,
      description,
      url,
      siteName: "Deal&Co",
      locale: "fr_FR",
      type,
      ...(publishedAt ? { publishedTime: publishedAt.toISOString() } : {}),
      ...(image ? { images: [{ url: image }] } : {}),
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title,
      description,
      ...(image ? { images: [image] } : {}),
    },
  };
}

/** Fil d'Ariane : la position de la page dans la section, dite à un moteur. */
export function breadcrumbJsonLd(trail: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map((step, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: step.name,
      item: `${BASE}${step.path}`,
    })),
  };
}

/**
 * Une page de liste : la une, une rubrique, un hub de marque.
 *
 * Le `ItemList` n'est pas décoratif — c'est lui qui dit à un moteur que la page
 * mène à trente articles datés, et non qu'elle est une page de plus.
 */
export function collectionJsonLd({
  name,
  description,
  path,
  articles,
}: {
  name: string;
  description: string;
  path: string;
  articles: Article[];
}) {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name,
    description,
    url: `${BASE}${path}`,
    isPartOf: { "@type": "WebSite", name: "Deal&Co", url: BASE },
    publisher: SITE,
    ...(articles[0] ? { dateModified: articles[0].publishedAt.toISOString() } : {}),
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: articles.length,
      itemListElement: articles.map((a, i) => ({
        "@type": "ListItem",
        position: i + 1,
        url: `${BASE}/actualites/${a.slug}`,
        name: a.title,
      })),
    },
  };
}

/**
 * Une page d'article.
 *
 * ── Ce que ce balisage affirme, et pourquoi c'est vrai ────────────────────
 *
 * `author` — le journaliste, ou sa rédaction. Jamais nous.
 * `publisher` — le média qui a publié l'article. Jamais nous.
 * `isBasedOn` — l'adresse de l'original chez lui.
 * `mainEntityOfPage` — notre page, parce que c'est bien elle qu'on décrit.
 *
 * Un moteur y lit exactement ce qu'un lecteur voit : une revue de presse qui
 * cite, date et attribue. C'est aussi ce qui protège le site — un balisage qui
 * revendiquerait la paternité serait faux, et un balisage faux se paie sur tout
 * le domaine, pas sur la page.
 */
export function articleJsonLd(article: Article, quotedChars: number) {
  const url = `${BASE}/actualites/${article.slug}`;
  return {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: article.title,
    ...(article.summary ? { description: article.summary } : {}),
    ...(article.imageUrl ? { image: [article.imageUrl] } : {}),
    datePublished: article.publishedAt.toISOString(),
    dateModified: article.publishedAt.toISOString(),
    author: article.authorName
      ? { "@type": "Person", name: article.authorName }
      : { "@type": "Organization", name: article.publisher, url: article.publisherHome },
    publisher: { "@type": "Organization", name: article.publisher, url: article.publisherHome },
    isBasedOn: article.url,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    inLanguage: "fr-FR",
    articleSection: article.section,
    // Longueur de ce que **nous** publions, pas de l'article d'origine : le
    // déclarer plus long qu'il n'est serait une déclaration fausse de plus.
    wordCount: Math.round(quotedChars / 6),
    // Le rapprochement que la page ajoute et que le média n'a pas : c'est lui
    // qui justifie qu'elle demande l'index.
    ...(article.brandSlug
      ? { about: { "@type": "Thing", name: article.brandSlug.replace(/-/g, " ") } }
      : {}),
  };
}
