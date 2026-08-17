/**
 * Intention d'arrivée — ce que la visite portait avec elle.
 *
 * Une mise au point, parce que la promesse courante du métier est fausse : **on
 * ne peut pas savoir ce que quelqu'un a tapé sur Google avant d'arriver**. Les
 * moteurs retirent la requête du référent depuis 2011, il ne reste que le nom
 * de domaine. Ce qui est réellement lisible, et que ce module capture :
 *
 *   - `utm_term`, présent sur les liens sponsorisés qu'on achète soi-même ;
 *   - une requête portée par l'URL d'arrivée (`?q=`, `?search=`), typique des
 *     liens partagés et de certains comparateurs ;
 *   - la requête du référent quand il en expose une — rare, mais gratuit.
 *
 * Le tout tient dans un cookie de première partie, trente jours, sans
 * identifiant : trois mots-clés, rien qui désigne une personne. Le module ne
 * sert qu'à orienter une publicité vers un sujet plausible, pas à reconstituer
 * un parcours.
 */

export const INTENT_COOKIE = "dco_intent";
export const INTENT_MAX_AGE = 30 * 24 * 3600;

const KEYS = ["utm_term", "q", "query", "keyword", "kw", "search"];

/** Hôtes dont on accepte de lire une requête, quand ils en publient une. */
const SEARCH_HOSTS = /(^|\.)(google|bing|duckduckgo|ecosia|qwant|yahoo|yandex)\./i;

function clean(value: string | null): string | null {
  if (!value) return null;
  const text = value.trim().replace(/\s+/g, " ").slice(0, 80);
  return text.length >= 3 ? text : null;
}

/**
 * Mots-clés lisibles dans une arrivée. Vide quand il n'y a rien d'exploitable —
 * ce qui est le cas le plus fréquent, et ce n'est pas un défaut.
 */
export function readLandingIntent(url: URL, referer: string | null): string[] {
  const found: string[] = [];

  for (const key of KEYS) {
    const value = clean(url.searchParams.get(key));
    if (value && !found.includes(value)) found.push(value);
  }

  if (referer) {
    try {
      const ref = new URL(referer);
      if (SEARCH_HOSTS.test(ref.hostname)) {
        for (const key of ["q", "query", "text"]) {
          const value = clean(ref.searchParams.get(key));
          if (value && !found.includes(value)) found.push(value);
        }
      }
    } catch {
      /* référent illisible : sans intérêt, sans conséquence */
    }
  }

  return found.slice(0, 3);
}

/** Valeur du cookie : mots-clés encodés, séparés par une barre. */
export function encodeIntent(keywords: string[]): string {
  return keywords.map((k) => encodeURIComponent(k)).join("|");
}
