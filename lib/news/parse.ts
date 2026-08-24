/**
 * Lecture d'un flux RSS 2.0, sans dépendance.
 *
 * ── Pourquoi pas une bibliothèque ─────────────────────────────────────────
 *
 * Ce que nous lisons d'un article tient en cinq champs : titre, lien, date,
 * résumé, rubriques. Une bibliothèque d'analyse XML complète apporterait ici
 * surtout une surface de dépendance supplémentaire dans un chemin qui s'exécute
 * côté serveur sur des données venues d'un tiers.
 *
 * ── Ce que cette lecture garantit ─────────────────────────────────────────
 *
 * Elle est **tolérante mais jamais optimiste** : un `<item>` sans titre, sans
 * lien ou sans date exploitable est écarté plutôt que complété par une valeur
 * de repli. Une date inventée classerait un vieil article en tête des
 * « actualités récentes » d'une page — le contraire du service rendu.
 */

export type FeedItem = {
  title: string;
  url: string;
  summary: string | null;
  publishedAt: Date;
  categories: string[];
  /**
   * Visuel publié **dans le flux**, via `<enclosure>` ou `<media:content>`.
   *
   * La nuance compte : un média qui met une image dans son flux la met là pour
   * qu'elle soit reprise avec l'article. Aller la chercher dans la page, elle,
   * serait une aspiration — et ce module n'ouvre jamais la page d'un article.
   */
  imageUrl: string | null;
  /**
   * Signature publiée par le flux, quand il en publie une.
   *
   * Motor1 n'en met aucune dans ses flux d'articles ; 20 Minutes met un
   * `<author>` sur chaque item. Là où elle existe, elle vaut mieux que
   * n'importe quel recoupement : c'est le média qui le dit.
   */
  author: string | null;
  /**
   * Extrait du corps de l'article, quand le flux le publie.
   *
   * Certains flux — 20 Minutes, par exemple — livrent l'article entier dans un
   * `<body>`. Le livrer n'est pas le céder : ces mêmes flux portent une mention
   * de copyright explicite. On en garde donc une **citation bornée**, qui sera
   * présentée comme telle et attribuée, avec le renvoi vers l'original.
   */
  excerpt: string | null;
};

/**
 * Longueur de la citation.
 *
 * Assez pour que la page ait de la matière et que le lecteur sache de quoi
 * parle l'article ; assez court pour rester une citation et non une reprise.
 */
export const EXCERPT_CHARS = 700;

/** Entités XML rencontrées dans les flux, plus les entités numériques. */
function decodeEntities(input: string): string {
  return input
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    // `&amp;` en dernier : le faire avant recréerait des entités à partir de
    // séquences déjà décodées (« &amp;lt; » deviendrait « < »).
    .replace(/&amp;/g, "&");
}

function text(block: string, tag: string): string | null {
  const m = block.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "i"));
  if (!m) return null;
  const raw = m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
  // Le résumé d'un flux contient souvent du HTML : on le réduit à du texte,
  // car il ne sera jamais rendu comme du balisage.
  const plain = decodeEntities(raw.replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
  return plain.length > 0 ? plain : null;
}

/**
 * Citation tirée du corps de l'article.
 *
 * La coupe se fait sur une fin de phrase quand il y en a une assez loin :
 * une citation qui s'arrête au milieu d'un mot donne l'impression d'une page
 * cassée plutôt que d'un extrait.
 */
function excerptOf(block: string): string | null {
  const raw =
    block.match(/<body(?:\s[^>]*)?>([\s\S]*?)<\/body>/i)?.[1] ??
    block.match(/<content:encoded(?:\s[^>]*)?>([\s\S]*?)<\/content:encoded>/i)?.[1] ??
    null;
  if (!raw) return null;

  const inner = raw.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
  // Les blocs non textuels partent en premier : un script ou une iframe
  // réduits en texte laisseraient des morceaux de code dans la citation.
  const plain = decodeEntities(
    inner
      .replace(/<(script|style|iframe|figure|blockquote)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/\s+/g, " ")
    .trim();

  if (plain.length === 0) return null;
  if (plain.length <= EXCERPT_CHARS) return plain;

  const cut = plain.slice(0, EXCERPT_CHARS);
  const stop = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "), cut.lastIndexOf("? "));
  return stop > EXCERPT_CHARS * 0.5 ? `${cut.slice(0, stop + 1)} […]` : `${cut.trimEnd()} […]`;
}

function allText(block: string, tag: string): string[] {
  const out: string[] = [];
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "gi");
  for (const m of block.matchAll(re)) {
    const value = decodeEntities(m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")).trim();
    if (value) out.push(value);
  }
  return out;
}

/** Adresse d'image portée par `<enclosure>` ou `<media:content>`. */
function imageOf(block: string): string | null {
  const patterns = [
    /<enclosure\b[^>]*type="image\/[^"]*"[^>]*url="([^"]+)"[^>]*>/i,
    /<enclosure\b[^>]*url="([^"]+)"[^>]*type="image\/[^"]*"[^>]*>/i,
    /<media:content\b[^>]*url="([^"]+)"[^>]*>/i,
    /<media:thumbnail\b[^>]*url="([^"]+)"[^>]*>/i,
  ];
  for (const re of patterns) {
    const m = block.match(re);
    if (!m) continue;
    try {
      const url = new URL(m[1].replace(/&amp;/g, "&"));
      // `https` seulement : une image en clair déclencherait un avertissement
      // de contenu mixte sur une page servie en TLS.
      if (url.protocol === "https:") return url.toString();
    } catch {
      /* adresse illisible : on continue */
    }
  }
  return null;
}

/**
 * Atom, tel que YouTube le sert.
 *
 * Les flux de chaîne YouTube (`/feeds/videos.xml?channel_id=…`) ne sont pas du
 * RSS : les entrées sont des `<entry>`, l'adresse vit dans un attribut
 * `href` et non dans un élément, et le résumé comme la miniature sont sous
 * `<media:group>`. D'où une seconde lecture, plutôt qu'un assouplissement de la
 * première qui l'aurait rendue tolérante à des choses qu'elle doit refuser.
 */
function parseAtom(xml: string): FeedItem[] {
  const items: FeedItem[] = [];

  for (const m of xml.matchAll(/<entry(?:\s[^>]*)?>([\s\S]*?)<\/entry>/gi)) {
    const block = m[1];

    const title = text(block, "title") ?? text(block, "media:title");
    const href = block.match(/<link\b[^>]*rel="alternate"[^>]*href="([^"]+)"/i)?.[1];
    const dateRaw = text(block, "published") ?? text(block, "updated");
    if (!title || !href || !dateRaw) continue;

    const publishedAt = new Date(dateRaw);
    if (Number.isNaN(publishedAt.getTime())) continue;

    let url: URL;
    try {
      url = new URL(href.replace(/&amp;/g, "&"));
    } catch {
      continue;
    }
    if (url.protocol !== "https:" && url.protocol !== "http:") continue;

    items.push({
      title,
      url: url.toString(),
      summary: text(block, "media:description"),
      publishedAt,
      categories: [],
      // Dans Atom, `<author>` enveloppe un `<name>`.
      imageUrl: imageOf(block),
      author: text(block, "name"),
      // Un flux de chaîne ne publie pas de corps d'article : la description
      // de la vidéo est déjà dans `summary`.
      excerpt: null,
    });
  }

  return items;
}

export function parseFeed(xml: string): FeedItem[] {
  // Un flux Atom n'a pas d'`<item>` : sans cette bascule, la lecture RSS
  // rendrait une liste vide sans rien signaler.
  if (!/<item(\s|>)/i.test(xml) && /<entry(\s|>)/i.test(xml)) return parseAtom(xml);

  const items: FeedItem[] = [];

  for (const m of xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi)) {
    const block = m[1];

    const title = text(block, "title");
    // `link` est parfois vide quand le flux met l'adresse dans `guid`.
    const link = text(block, "link") ?? text(block, "guid");
    const dateRaw = text(block, "pubDate") ?? text(block, "dc:date");
    if (!title || !link || !dateRaw) continue;

    const publishedAt = new Date(dateRaw);
    if (Number.isNaN(publishedAt.getTime())) continue;

    let url: URL;
    try {
      url = new URL(link);
    } catch {
      continue;
    }
    // Seuls `http(s)` : un flux compromis ne doit pas pouvoir poser un
    // `javascript:` dans un lien rendu sur une page publique.
    if (url.protocol !== "https:" && url.protocol !== "http:") continue;

    items.push({
      title,
      url: url.toString(),
      summary: text(block, "description"),
      publishedAt,
      categories: allText(block, "category"),
      imageUrl: imageOf(block),
      author: text(block, "author") ?? text(block, "dc:creator"),
      excerpt: excerptOf(block),
    });
  }

  return items;
}

/**
 * Identifiant de vidéo YouTube contenu dans une adresse, ou `null`.
 *
 * Sert à l'intégration du lecteur. Volontairement strict sur l'hôte : une
 * adresse quelconque ne doit jamais finir dans un `<iframe>` de notre page.
 */
export function youtubeIdOf(rawUrl: string): string | null {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^www\./, "");
  const id =
    host === "youtu.be"
      ? url.pathname.slice(1)
      : host === "youtube.com" || host === "m.youtube.com"
        ? url.searchParams.get("v")
        : null;
  // Onze caractères de l'alphabet YouTube, rien d'autre.
  return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
}
