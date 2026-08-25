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
 * Longueur de la citation — **proportionnelle**, pas fixe.
 *
 * ── Pourquoi la borne fixe précédente était mauvaise ──────────────────────
 *
 * 700 caractères, c'était sept lignes sur un long reportage — trop peu pour
 * que la page dise quelque chose — et l'article entier sur une brève de dix
 * lignes — beaucoup trop. La même valeur produisait les deux erreurs opposées.
 *
 * ── Ce que vise le réglage actuel ─────────────────────────────────────────
 *
 * Une **quinzaine de lignes** sur un article de longueur ordinaire. Mesuré sur
 * le flux « une » de 20 Minutes le 24/08/2026 : corps médian de 2 450
 * caractères, le plus long à 5 200. À 30 %, le médian rendait 735 caractères —
 * sept lignes, soit le reproche exact fait à la page. À 45 %, il en rend 1 100,
 * et un long reportage atteint le plafond de 1 500, soit une quinzaine de
 * lignes réelles.
 *
 * Deux garde-fous, et ils comptent autant que le chiffre :
 *
 *   · `EXCERPT_MIN` relève les articles courts jusqu'à 1 000 caractères, pour
 *     qu'une actualité de 1 500 signes donne autre chose que trois phrases ;
 *   · `EXCERPT_HARD_RATIO` interdit de dépasser 60 % du corps **quoi qu'il
 *     arrive**. C'est lui qui empêche le plancher de recopier une brève : sur
 *     un texte de 800 caractères, la citation s'arrête à 480. Il n'existe aucun
 *     moyen honnête de tirer quinze lignes d'une dépêche qui en fait huit.
 *
 * `EXCERPT_CHARS` reste exporté comme plafond absolu, utilisé par les tests.
 */
export const EXCERPT_CHARS = 1500;
export const EXCERPT_MAX_RATIO = 0.45;
export const EXCERPT_MIN = 1000;
export const EXCERPT_HARD_RATIO = 0.6;

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
 * Citation tirée du corps de l'article, paragraphes compris.
 *
 * ── Pourquoi conserver les paragraphes ────────────────────────────────────
 *
 * Une citation de quinze lignes rendue en un seul bloc ne se lit pas : c'est
 * un mur. Les fins de paragraphe du média sont donc converties en sauts de
 * ligne avant que le balisage ne soit retiré, et la page les rend en autant de
 * `<p>`. Le découpage reste celui du journaliste — nous n'en inventons aucun.
 *
 * La coupe finale se fait sur une fin de phrase quand il y en a une assez
 * loin : une citation qui s'arrête au milieu d'un mot donne l'impression d'une
 * page cassée plutôt que d'un extrait.
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
      // Fins de bloc → saut de ligne, avant le retrait du balisage : c'est la
      // seule occasion de savoir où le média a terminé un paragraphe.
      .replace(/<\/(p|h[1-6]|li|div)>/gi, "\n\n")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  )
    // Espaces réduits **à l'intérieur** d'une ligne seulement : un `\s+`
    // global écraserait les sauts qu'on vient de poser.
    .replace(/[^\S\n]+/g, " ")
    .replace(/ ?\n ?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  // Un corps de flux qui tient en deux lignes n'est pas un corps d'article :
  // 20 Minutes en publie occasionnellement de six caractères. Le rendre `null`
  // n'est pas une perte — c'est ce qui déclenche la lecture de la page à la
  // captation, laquelle rend un vrai texte.
  if (plain.length < 200) return null;

  // Le budget vise une quinzaine de lignes sur un article de longueur
  // ordinaire, sans jamais dépasser 60 % du corps — voir le commentaire des
  // constantes. Les deux bornes se croisent : sur une brève, c'est la seconde
  // qui gagne, et la citation reste courte.
  const budget = Math.min(
    EXCERPT_CHARS,
    Math.max(
      Math.floor(plain.length * EXCERPT_MAX_RATIO),
      Math.min(EXCERPT_MIN, Math.floor(plain.length * EXCERPT_HARD_RATIO)),
    ),
  );
  if (plain.length <= budget) return plain;

  const cut = plain.slice(0, budget);
  const stop = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf(".\n"), cut.lastIndexOf("! "), cut.lastIndexOf("? "));
  return stop > budget * 0.5 ? `${cut.slice(0, stop + 1).trim()} […]` : `${cut.trimEnd()} […]`;
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
