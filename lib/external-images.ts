/**
 * Extraction d'URLs d'images depuis le HTML d'une page d'annonce.
 *
 * Heuristiques génériques (og:image, <img src>, background-image CSS inline).
 * Filtre le bruit (logos, avatars, favicons, sprites) par nom de fichier.
 * Résout les chemins relatifs sur l'origin de la page source.
 */

const NOISE_RE = /(logo|avatar|favicon|sprite|icon|placeholder|pixel\.gif)/i;
const IMAGE_EXT_RE = /\.(?:jpe?g|png|webp|avif)(\?[^"'\s)]*)?$/i;

export function extractImages(html: string, baseUrl: string, max = 12): string[] {
  const found = new Set<string>();

  // og:image — la plus fiable pour la 1re image.
  const og = html.match(
    /<meta[^>]*property=["']og:image(?::secure_url)?["'][^>]*content=["']([^"']+)["']/i,
  );
  if (og) found.add(og[1]);

  // <img src> + srcset (premier candidat de srcset)
  const imgs = html.matchAll(/<img[^>]+src=["']([^"']+)["']/gi);
  for (const m of imgs) found.add(m[1]);
  const srcsets = html.matchAll(/<img[^>]+srcset=["']([^"']+)["']/gi);
  for (const m of srcsets) {
    const first = m[1].split(",")[0]?.trim().split(/\s+/)[0];
    if (first) found.add(first);
  }

  // background-image inline.
  const bgs = html.matchAll(/background-image:\s*url\(["']?([^"')]+)["']?\)/gi);
  for (const m of bgs) found.add(m[1]);

  // data-src / lazyload patterns courants.
  const lazies = html.matchAll(/data-(?:src|lazy|original|bg)=["']([^"']+)["']/gi);
  for (const m of lazies) found.add(m[1]);

  let origin: string;
  try {
    origin = new URL(baseUrl).origin;
  } catch {
    return [];
  }

  const resolved: string[] = [];
  for (const u of found) {
    if (NOISE_RE.test(u)) continue;
    if (!IMAGE_EXT_RE.test(u) && !u.includes("/photo") && !u.includes("/image")) continue;
    try {
      const abs = new URL(u, origin).href;
      if (!resolved.includes(abs)) resolved.push(abs);
    } catch {
      /* ignore */
    }
    if (resolved.length >= max) break;
  }
  return resolved;
}
