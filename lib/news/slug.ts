/**
 * Adresse Deal&Co d'un article capté.
 *
 * ── Deux exigences qui se contredisent, et l'arbitrage retenu ─────────────
 *
 * Une URL doit être **lisible** — `/actualites/tesla-cybercab-lancement-confirme`
 * vaut mieux qu'un identifiant — et **stable**, parce qu'une URL qui change est
 * une URL cassée. Or les médias retouchent leurs titres après publication.
 *
 * D'où : le libellé vient du titre, l'unicité vient d'une empreinte de l'URL
 * d'origine, et le tout n'est calculé **qu'à la première captation**. Les mises
 * à jour suivantes rafraîchissent le titre affiché sans jamais toucher
 * l'adresse.
 */

import { createHash } from "crypto";
import { normalizeToken } from "@/lib/seo/city";

/** Longueur du libellé. Au-delà, l'URL devient illisible sans rien apporter. */
const MAX_WORDS = 9;

export function newsSlug(title: string, sourceUrl: string): string {
  const words = normalizeToken(title).split("-").filter(Boolean).slice(0, MAX_WORDS);
  const label = words.join("-").slice(0, 80).replace(/-$/, "");

  // Six caractères d'empreinte : de quoi séparer deux articles au titre
  // identique sans transformer l'adresse en identifiant.
  const fingerprint = createHash("sha1").update(sourceUrl).digest("hex").slice(0, 6);

  return label ? `${label}-${fingerprint}` : fingerprint;
}
