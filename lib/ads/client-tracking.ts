/**
 * Mesure côté navigateur.
 *
 * Le client ne décide de rien : il mesure et il rapporte. La différence est
 * tout le sujet — un encart qui déciderait lui-même « je suis vu » suffirait à
 * facturer un annonceur depuis la console du navigateur.
 *
 * Ce module tient trois choses que plusieurs encarts d'une même page doivent
 * partager :
 *
 *  - **l'identifiant d'affichage de page**, commun à tous les encarts d'un
 *    même chargement. C'est lui qui permet de dire « le même encart, revu deux
 *    fois en scrollant, ne compte qu'une fois », sans empêcher deux encarts
 *    différents de compter pour deux ;
 *  - **l'identifiant de session**, anonyme et éphémère ;
 *  - **l'envoi des événements**, avec `keepalive` pour que la navigation ne
 *    coupe pas la mesure du clic.
 */

const SESSION_KEY = "dco_ad_session";

/** Identifiant d'affichage : anonyme, éphémère, jamais lié à un compte. */
export function adSessionId(): string {
  try {
    const existing = sessionStorage.getItem(SESSION_KEY);
    if (existing) return existing;
    const fresh = Math.random().toString(36).slice(2) + Date.now().toString(36);
    sessionStorage.setItem(SESSION_KEY, fresh);
    return fresh;
  } catch {
    // Navigation privée ou stockage refusé : on reste anonyme, la
    // déduplication se fera sur cette valeur volatile.
    return "anon-" + Math.random().toString(36).slice(2);
  }
}

let pageViewId: string | null = null;
let pageViewPath: string | null = null;

/**
 * Identifiant du chargement de page courant.
 *
 * Renouvelé au changement de chemin : dans une application à navigation
 * client, le module n'est pas réévalué, et sans ce renouvellement un visiteur
 * qui parcourt dix pages n'aurait qu'un seul « affichage de page » — donc une
 * seule impression comptée pour dix pages réellement vues.
 */
export function currentPageViewId(pathname: string | null | undefined): string {
  const path = pathname ?? "/";
  if (!pageViewId || pageViewPath !== path) {
    pageViewId =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2) + Date.now().toString(36);
    pageViewPath = path;
  }
  return pageViewId;
}

export type AdEventPayload = {
  type: "LOAD" | "RENDER" | "VIEWABLE_IMPRESSION" | "CLICK" | "CONVERSION";
  token: string;
  pageViewId: string;
  viewportPct?: number;
  visibleMs?: number;
  conversionType?: string;
};

/**
 * Envoie un événement. Ne lève jamais : une mesure perdue ne doit pas casser
 * une page, et un encart publicitaire n'a aucune raison de faire tomber la
 * place de marché autour de lui.
 */
export async function sendAdEvent(
  payload: AdEventPayload,
): Promise<{ destination?: string | null } | null> {
  try {
    const res = await fetch("/api/ads/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, sessionId: adSessionId() }),
      keepalive: true,
    });
    return (await res.json().catch(() => null)) as { destination?: string | null } | null;
  } catch {
    return null;
  }
}

// ── Observateur de visibilité ───────────────────────────────────────────────

export type ViewabilityWatcher = { disconnect: () => void };

/**
 * Surveille un encart et prévient quand il a été **réellement vu**.
 *
 * La règle : au moins la moitié du bloc dans la fenêtre, pendant une seconde
 * cumulée. Cumulée et non continue, volontairement — quelqu'un qui scrolle
 * lentement voit la publicité en trois fois, et refuser de compter cela
 * favoriserait les pages où l'on passe sans lire.
 *
 * L'onglet caché arrête le compteur : un onglet en arrière-plan reste
 * « intersecté » alors que personne ne regarde. C'est l'un des écarts les plus
 * courants entre une mesure naïve et une mesure honnête.
 */
export function watchViewability(
  node: Element,
  onViewable: (measure: { viewportPct: number; visibleMs: number }) => void,
  options: { minRatio?: number; minMs?: number } = {},
): ViewabilityWatcher {
  const minRatio = options.minRatio ?? 0.5;
  const minMs = options.minMs ?? 1000;

  let accumulated = 0;
  let since: number | null = null;
  let bestRatio = 0;
  let done = false;
  let timer: number | null = null;

  const stop = () => {
    if (since !== null) {
      accumulated += performance.now() - since;
      since = null;
    }
    if (timer !== null) {
      window.clearTimeout(timer);
      timer = null;
    }
  };

  const fire = () => {
    if (done) return;
    done = true;
    stop();
    observer.disconnect();
    document.removeEventListener("visibilitychange", onVisibilityChange);
    onViewable({ viewportPct: Math.min(1, bestRatio), visibleMs: Math.round(accumulated) });
  };

  const start = (ratio: number) => {
    bestRatio = Math.max(bestRatio, ratio);
    if (since !== null || done) return;
    since = performance.now();
    // Un minuteur plutôt qu'une boucle : le seuil se déclenche seul si rien ne
    // bouge à l'écran — et c'est précisément le cas d'une publicité qu'on
    // regarde.
    timer = window.setTimeout(fire, Math.max(0, minMs - accumulated));
  };

  const onVisibilityChange = () => {
    if (document.hidden) stop();
  };

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const ratio = entry.intersectionRatio;
        if (entry.isIntersecting && ratio >= minRatio && !document.hidden) start(ratio);
        else stop();
      }
    },
    // Plusieurs seuils : avec un seul, une publicité qui passe de 40 % à 90 %
    // sans franchir exactement le seuil déclaré ne produirait aucun événement.
    { threshold: [0, 0.25, 0.5, 0.75, 1] },
  );

  observer.observe(node);
  document.addEventListener("visibilitychange", onVisibilityChange);

  return {
    disconnect: () => {
      stop();
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    },
  };
}
