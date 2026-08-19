/**
 * Attribution des contacts à une publicité.
 *
 * L'objectif « recevoir plus de contacts » n'a de sens que si l'on sait dire
 * lesquels viennent d'une publicité. Sans cela, le coût par contact serait un
 * coût par clic renommé — et un annonceur qui paie pour des appels finirait par
 * payer pour des visites en croyant autre chose.
 *
 * Le mécanisme est volontairement minimal : au clic sur une publicité, le jeton
 * de l'affichage est rangé dans le stockage de session ; si un contact est pris
 * dans la demi-heure qui suit, il est rapporté avec ce jeton. Le serveur
 * revérifie la signature, la fenêtre, et n'accepte qu'une conversion par nature
 * et par affichage.
 *
 * Ce que ce mécanisme n'est pas : un traçage. Rien n'est stocké au-delà de
 * l'onglet, rien n'est lié à un compte, et la valeur disparaît à la fermeture.
 */

const KEY = "dco_ad_click";
/** Fenêtre d'attribution : la durée de vie du jeton, pas davantage. */
const WINDOW_MS = 30 * 60_000;

export type ConversionType = "PHONE" | "EMAIL" | "MESSAGE" | "FORM" | "BOOKING";

type StoredClick = { token: string; adId: string; at: number; done: string[] };

function read(): StoredClick | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredClick;
    if (!parsed?.token || Date.now() - parsed.at > WINDOW_MS) {
      sessionStorage.removeItem(KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/** Mémorise le clic publicitaire qui vient d'emmener le visiteur quelque part. */
export function rememberAdClick(token: string, adId: string): void {
  try {
    const payload: StoredClick = { token, adId, at: Date.now(), done: [] };
    sessionStorage.setItem(KEY, JSON.stringify(payload));
  } catch {
    // Stockage refusé : on perd l'attribution, jamais la navigation.
  }
}

/**
 * Rapporte un contact pris après un clic publicitaire.
 *
 * Sans clic mémorisé, la fonction ne fait rien : un contact pris par quelqu'un
 * qui n'a jamais vu de publicité n'appartient à personne, et l'attribuer
 * gonflerait les chiffres de l'annonceur le plus proche.
 *
 * Ne lève jamais et ne bloque rien : appeler un vendeur ne doit pas dépendre
 * d'une mesure publicitaire.
 */
export async function reportAdConversion(type: ConversionType): Promise<void> {
  const stored = read();
  if (!stored) return;
  // Une seule conversion par nature : révéler deux fois un numéro n'est pas
  // deux contacts.
  if (stored.done.includes(type)) return;

  try {
    const { adSessionId, currentPageViewId } = await import("./client-tracking");
    await fetch("/api/ads/conversion", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: stored.token,
        sessionId: adSessionId(),
        pageViewId: currentPageViewId(window.location.pathname),
        conversionType: type,
      }),
      keepalive: true,
    });
    stored.done.push(type);
    sessionStorage.setItem(KEY, JSON.stringify(stored));
  } catch {
    /* une conversion perdue ne doit rien casser */
  }
}
