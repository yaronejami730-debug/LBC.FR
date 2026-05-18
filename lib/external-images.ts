/**
 * Extraction des URLs d'images depuis le HTML d'une page d'annonce.
 *
 * Objectif : récupérer TOUTES les photos d'une annonce, y compris celles
 * chargées via galeries JavaScript, lazy-load, srcset ou JSON embarqué
 * (`application/ld+json`, `__NEXT_DATA__`, tableaux JSON inline).
 *
 * Stratégie multi-passes :
 *   1. og:image (image de couverture — placée en premier)
 *   2. JSON-LD : champ `image`
 *   3. balises <img> : src, srcset (plus haute résolution), data-* lazy
 *   4. background-image CSS inline
 *   5. balayage large : toute URL d'image dans le HTML brut (capte le JSON)
 */

const NOISE_RE =
  /(logo|avatar|favicon|sprite|icon|placeholder|pixel|spacer|blank|loading|loader|1x1|transparent|watermark)/i;
const IMG_EXT_RE = /\.(?:jpe?g|png|webp|avif)(?:[?#][^"'\s)]*)?$/i;
/** URL d'image absolue, où qu'elle soit dans le HTML (y compris JSON). */
const ANY_IMG_URL_RE =
  /https?:\\?\/\\?\/[^\s"'<>()]+?\.(?:jpe?g|png|webp|avif)(?:[?][^\s"'<>()]*)?/gi;

const MAX_IMAGES = 40;

/** Normalise une URL extraite (déséchappe les slashs JSON `\/`). */
function cleanUrl(raw: string): string {
  return raw.replace(/\\\//g, "/").trim();
}

/** Sélectionne la plus haute résolution d'un attribut srcset. */
function largestFromSrcset(srcset: string): string | null {
  let best: string | null = null;
  let bestW = -1;
  for (const part of srcset.split(",")) {
    const [u, w] = part.trim().split(/\s+/);
    if (!u) continue;
    const width = w ? parseInt(w) || 0 : 0;
    if (width >= bestW) {
      bestW = width;
      best = u;
    }
  }
  return best;
}

export function extractImages(html: string, baseUrl: string, max = MAX_IMAGES): string[] {
  let origin: string;
  try {
    origin = new URL(baseUrl).origin;
  } catch {
    return [];
  }

  const ordered: string[] = [];
  const seen = new Set<string>();
  const push = (raw: string | null | undefined) => {
    if (!raw) return;
    const u = cleanUrl(raw);
    if (!u || NOISE_RE.test(u)) return;
    let abs: string;
    try {
      abs = new URL(u, origin).href;
    } catch {
      return;
    }
    // Garde les URLs d'image (extension) ou chemins de média explicites.
    if (!IMG_EXT_RE.test(abs) && !/\/(photos?|images?|media|uploads?|cdn)\//i.test(abs)) {
      return;
    }
    if (seen.has(abs)) return;
    seen.add(abs);
    ordered.push(abs);
  };

  // 1. og:image — couverture.
  const og = html.match(
    /<meta[^>]*property=["']og:image(?::secure_url)?["'][^>]*content=["']([^"']+)["']/i,
  );
  if (og) push(og[1]);

  // 2. JSON-LD — champ "image" (chaîne ou tableau).
  for (const m of html.matchAll(
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )) {
    for (const im of m[1].matchAll(/"image"\s*:\s*("(?:[^"\\]|\\.)*"|\[[^\]]*\])/gi)) {
      const block = im[1];
      for (const url of block.matchAll(/https?:[^\s"'\\]+(?:\\\/[^\s"'\\]+)*/g)) {
        push(url[0]);
      }
    }
  }

  // 3. <img> — src, srcset (plus haute résolution), data-* lazy.
  for (const m of html.matchAll(/<img\b[^>]*>/gi)) {
    const tag = m[0];
    const srcset = tag.match(/\bsrcset=["']([^"']+)["']/i);
    if (srcset) push(largestFromSrcset(srcset[1]));
    const src = tag.match(/\bsrc=["']([^"']+)["']/i);
    if (src) push(src[1]);
    for (const d of tag.matchAll(/\bdata-(?:src|lazy|original|bg|image)=["']([^"']+)["']/gi)) {
      push(d[1]);
    }
  }

  // 4. background-image CSS inline.
  for (const m of html.matchAll(/background-image:\s*url\(["']?([^"')]+)["']?\)/gi)) {
    push(m[1]);
  }

  // 5. Balayage large — toute URL d'image dans le HTML brut (capte le JSON
  //    des galeries que les passes ciblées ratent).
  for (const m of html.matchAll(ANY_IMG_URL_RE)) {
    push(m[0]);
  }

  return ordered.slice(0, max);
}
