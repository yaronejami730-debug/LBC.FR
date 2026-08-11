/**
 * Adresse du site d'un établissement.
 *
 * Un professionnel tape « monsalon.fr », pas « https://monsalon.fr ». Sans
 * schéma, le navigateur traite la valeur comme un chemin relatif : le lien de
 * la fiche publique renvoyait vers `/pro/monsalon.fr` — une 404 au lieu du
 * site du salon. On normalise donc à l'enregistrement, une fois, plutôt que de
 * rattraper à chaque affichage.
 */

/** Seuls `http` et `https` sont acceptés : `javascript:` est une injection. */
const ALLOWED = new Set(["http:", "https:"]);

/**
 * Renvoie une URL absolue sûre, ou `null` si la saisie n'est pas exploitable.
 * Le schéma manquant est complété en `https://`.
 */
export function normalizeWebsite(raw: unknown): string | null {
  const value = String(raw ?? "").trim();
  if (!value) return null;

  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(value) ? value : `https://${value}`;

  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return null;
  }
  if (!ALLOWED.has(url.protocol)) return null;
  // Un hôte sans point (« monsite ») n'est pas une adresse joignable.
  if (!url.hostname.includes(".")) return null;

  return url.toString().replace(/\/$/, "").slice(0, 200);
}

/**
 * Libellé affiché à la place de l'URL brute : « monsalon.fr » se lit et se
 * mémorise, « https://www.monsalon.fr/accueil?utm=… » non.
 */
export function websiteLabel(raw: string): string {
  try {
    return new URL(raw).hostname.replace(/^www\./, "");
  } catch {
    return raw;
  }
}
