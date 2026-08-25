/**
 * Lecture du texte d'un article, quand son flux ne le publie pas.
 *
 * ── Pourquoi ce module existe, alors que la règle était de ne jamais ouvrir
 *    la page d'un média ────────────────────────────────────────────────────
 *
 * Parce que la règle produisait une page inutilisable. Mesuré le 24/08/2026 sur
 * seize flux de presse française : un seul — 20 Minutes « à la une » — publie le
 * corps de ses articles dans son RSS. Tous les autres, Motor1 compris,
 * s'arrêtent à un chapô de deux lignes. Sur 190 articles captés, 22 avaient de
 * quoi remplir une une, et 168 affichaient deux lignes sous une photo en 16/9.
 *
 * ── Ce que ce module fait, et ce qu'il ne fait pas ────────────────────────
 *
 * Il ouvre **la page publique** de l'article — celle vers laquelle le flux nous
 * envoie explicitement — et en extrait le texte. Ce texte n'est jamais publié
 * tel quel : il repart aussitôt dans `boundedQuote`, qui applique la même borne
 * proportionnelle que pour un corps livré par le flux (45 %, 1 500 caractères
 * au plus, jamais plus de 60 % d'un texte court). Ce qui s'affiche reste une
 * citation encadrée, attribuée à sa signature, suivie du lien vers l'original.
 *
 * Il en relève aussi l'**adresse du visuel de partage** (`og:image`), et pour
 * la même raison qu'il relève le texte : plusieurs flux — Courrier Cadres, par
 * exemple — ne mettent aucune image dans leur RSS alors que chaque article en
 * porte une. Or le fil n'affiche que les articles illustrés : sans cette
 * lecture, une rubrique entière resterait invisible malgré des articles captés.
 * L'image n'est pas réhébergée : c'est l'adresse du média qui est servie, comme
 * pour une image trouvée dans un `<enclosure>`.
 *
 * Il ne fait pas : d'images réhébergées, de contournement de paywall, de
 * traduction, de réécriture, de republication intégrale. Un article dont
 * l'extraction ne rend rien d'exploitable reste avec son chapô de flux.
 *
 * ── Ce que nous assumons ──────────────────────────────────────────────────
 *
 * Certains médias interdisent cette lecture dans leurs conditions d'utilisation
 * et peuvent bloquer notre serveur. Le module s'annonce donc sous un
 * `User-Agent` nommé, avec l'adresse d'une page qui explique qui nous sommes :
 * un média qui ne veut pas de nous doit pouvoir nous identifier et nous
 * refuser, plutôt que d'avoir à deviner. Une lecture par article et par vie —
 * le texte est stocké, il n'est jamais redemandé.
 */

import { EXCERPT_CHARS, EXCERPT_MAX_RATIO, EXCERPT_MIN, EXCERPT_HARD_RATIO } from "@/lib/news/parse";

const UA =
  "Mozilla/5.0 (compatible; DealAndCoBot/1.0; +https://www.dealandcompany.fr/actualites)";

const TIMEOUT_MS = 12_000;

/** En dessous, ce qui a été extrait n'est pas un article : menu, cookie, 404. */
const MIN_USABLE_CHARS = 400;

/**
 * Applique la borne de citation à un texte déjà réduit en clair.
 *
 * Partagée avec la lecture de flux : qu'un corps vienne d'un `<body>` RSS ou de
 * la page du média ne change rien à ce que nous avons le droit d'en publier.
 */
export function boundedQuote(plain: string): string | null {
  if (plain.length === 0) return null;

  const budget = Math.min(
    EXCERPT_CHARS,
    Math.max(
      Math.floor(plain.length * EXCERPT_MAX_RATIO),
      Math.min(EXCERPT_MIN, Math.floor(plain.length * EXCERPT_HARD_RATIO)),
    ),
  );
  if (plain.length <= budget) return plain;

  const cut = plain.slice(0, budget);
  const stop = Math.max(
    cut.lastIndexOf(". "),
    cut.lastIndexOf(".\n"),
    cut.lastIndexOf("! "),
    cut.lastIndexOf("? "),
  );
  return stop > budget * 0.5 ? `${cut.slice(0, stop + 1).trim()} […]` : `${cut.trimEnd()} […]`;
}

function decodeEntities(input: string): string {
  return input
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&(rsquo|#8217);/g, "’")
    .replace(/&(laquo|#171);/g, "«")
    .replace(/&(raquo|#187);/g, "»")
    .replace(/&(hellip|#8230);/g, "…")
    .replace(/&(eacute|#233);/g, "é")
    .replace(/&amp;/g, "&");
}

/** Réduit un fragment HTML en texte, paragraphes conservés. */
function toPlain(fragment: string): string {
  return decodeEntities(
    fragment
      // Tout ce qui n'est pas du corps d'article part en premier : réduit en
      // texte, un script laisserait du code au milieu de la citation, et un
      // `<aside>` y mettrait « À lire aussi ».
      .replace(
        /<(script|style|noscript|iframe|figure|figcaption|aside|nav|header|footer|form|svg|video|audio)[\s\S]*?<\/\1>/gi,
        " ",
      )
      .replace(/<\/(p|h[1-6]|li|div|section)>/gi, "\n\n")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/[^\S\n]+/g, " ")
    .replace(/ ?\n ?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Le texte de l'article dans la page, par ordre de fiabilité décroissante.
 *
 *   1. `articleBody` d'un balisage `schema.org` — c'est le média lui-même qui
 *      désigne son texte, il n'y a pas plus sûr ;
 *   2. les `<p>` d'un conteneur d'article explicite (`<article>`, ou une classe
 *      qui le nomme) ;
 *   3. les `<p>` de la page, à condition qu'ils soient assez nombreux et assez
 *      longs pour ne pas être des mentions de pied de page.
 *
 * Aucune de ces trois voies n'invente de texte : chacune ne fait que délimiter
 * ce que la page publie déjà en clair.
 */
export function extractArticleText(html: string): string | null {
  // 1. Le balisage structuré du média.
  for (const m of html.matchAll(
    /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi,
  )) {
    try {
      const parsed: unknown = JSON.parse(m[1].trim());
      const body = findArticleBody(parsed);
      if (body && body.length >= MIN_USABLE_CHARS) {
        const plain = toPlain(body);
        if (plain.length >= MIN_USABLE_CHARS) return plain;
      }
    } catch {
      /* JSON-LD illisible : on passe à la voie suivante */
    }
  }

  // 2. Un conteneur d'article explicite.
  const container =
    html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i)?.[1] ??
    html.match(
      /<div\b[^>]*class="[^"]*(?:article-body|articleBody|post-content|entry-content|content-article|story-body)[^"]*"[^>]*>([\s\S]*)/i,
    )?.[1] ??
    null;

  if (container) {
    const fromParagraphs = paragraphsOf(container);
    if (fromParagraphs && fromParagraphs.length >= MIN_USABLE_CHARS) return fromParagraphs;
  }

  // 3. Les paragraphes de la page entière, en dernier recours.
  const whole = paragraphsOf(html);
  return whole && whole.length >= MIN_USABLE_CHARS ? whole : null;
}

/**
 * Les `<p>` d'un fragment, filtrés sur leur longueur.
 *
 * Le seuil de 80 caractères est ce qui sépare une phrase d'article d'un « Tous
 * droits réservés », d'un « Publié le 24 août » ou d'un intitulé de bouton.
 */
function paragraphsOf(fragment: string): string | null {
  const out: string[] = [];
  for (const m of fragment.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)) {
    const t = toPlain(m[1]);
    if (t.length >= 80) out.push(t);
  }
  return out.length >= 2 ? out.join("\n\n") : null;
}

/** Cherche `articleBody` dans un JSON-LD, quelle que soit sa profondeur. */
function findArticleBody(node: unknown): string | null {
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findArticleBody(child);
      if (found) return found;
    }
    return null;
  }
  if (node && typeof node === "object") {
    const obj = node as Record<string, unknown>;
    if (typeof obj.articleBody === "string" && obj.articleBody.trim().length > 0) {
      return obj.articleBody;
    }
    for (const value of Object.values(obj)) {
      const found = findArticleBody(value);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Le visuel de partage déclaré par la page.
 *
 * `og:image` d'abord — c'est celui que le média a choisi pour être repris —
 * puis `twitter:image`. Seul `https` est retenu : une image en clair sur une
 * page servie en TLS déclenche un avertissement de contenu mixte.
 */
export function extractImage(html: string): string | null {
  const patterns = [
    /<meta[^>]+property="og:image"[^>]+content="([^"]+)"/i,
    /<meta[^>]+content="([^"]+)"[^>]+property="og:image"/i,
    /<meta[^>]+name="twitter:image"[^>]+content="([^"]+)"/i,
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (!m) continue;
    try {
      const url = new URL(decodeEntities(m[1]));
      if (url.protocol === "https:") return url.toString();
    } catch {
      /* adresse illisible : on continue */
    }
  }
  return null;
}

export type ArticleExtras = { quote: string | null; imageUrl: string | null };

/**
 * Ouvre la page d'un article une seule fois et en rend ce qui manque au flux :
 * la citation longue, le visuel, ou les deux.
 *
 * Une seule requête pour les deux besoins, et c'est délibéré : ouvrir deux fois
 * la même page chez un média qui nous rend service en publiant un flux ouvert
 * est le meilleur moyen de s'en faire refuser l'accès.
 *
 * Ne lève jamais : un média indisponible, lent, ou qui nous refuse l'accès
 * laisse simplement l'article avec ce que son flux publiait. La captation
 * continue.
 */
export async function fetchArticleExtras(url: string): Promise<ArticleExtras> {
  const html = await fetchHtml(url);
  if (!html) return { quote: null, imageUrl: null };
  const plain = extractArticleText(html);
  return {
    quote: plain ? boundedQuote(plain) : null,
    imageUrl: extractImage(html),
  };
}

/** Citation seule — conservée pour les appels qui n'ont pas besoin du visuel. */
export async function fetchQuote(url: string): Promise<string | null> {
  return (await fetchArticleExtras(url)).quote;
}

async function fetchHtml(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent": UA,
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "fr-FR,fr;q=0.9",
      },
    });
    if (!res.ok) return null;
    const type = res.headers.get("content-type") ?? "";
    if (!type.includes("html")) return null;
    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
