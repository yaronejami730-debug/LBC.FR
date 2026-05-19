/**
 * Tracker d'événements utilisateur — client.
 *
 * Mise en file + envoi groupé (`POST /api/events`) toutes les 5 s ou quand
 * l'onglet passe en arrière-plan / se ferme (`sendBeacon` pour fiabilité).
 *
 * Identité de session : ré-utilise `dealco_uid` (sessionStorage) déjà posé
 * par `usePresence` — un seul ID partagé évite la prolifération de tokens.
 */

"use client";

type Evt = {
  kind: string;
  path?: string;
  meta?: Record<string, unknown>;
  ts: number;
};

const QUEUE: Evt[] = [];
const FLUSH_MS = 5_000;
const MAX_BATCH = 50;
const ENDPOINT = "/api/events";

let timer: ReturnType<typeof setTimeout> | null = null;
let flushersInstalled = false;

function sessionId(): string | null {
  try {
    return sessionStorage.getItem("dealco_uid");
  } catch {
    return null;
  }
}

function flush(useBeacon = false): void {
  if (QUEUE.length === 0) return;
  const batch = QUEUE.splice(0, MAX_BATCH);
  const sid = sessionId();
  const body = JSON.stringify({
    events: batch.map((e) => ({ ...e, sessionId: sid })),
  });
  try {
    if (useBeacon && typeof navigator !== "undefined" && navigator.sendBeacon) {
      navigator.sendBeacon(ENDPOINT, new Blob([body], { type: "application/json" }));
      return;
    }
    fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* silencieux : le tracking ne doit jamais casser l'app */
  }
}

function installFlushers(): void {
  if (flushersInstalled || typeof window === "undefined") return;
  flushersInstalled = true;
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flush(true);
  });
  window.addEventListener("pagehide", () => flush(true));
}

/**
 * Enfile un événement. No-op côté serveur. Garantie de ne jamais lever.
 *
 * @param kind  identifiant court de l'événement (≤64 c. — ex. "page_view")
 * @param meta  objet JSON-sérialisable optionnel
 * @param path  chemin associé — défaut : `location.pathname`
 */
export function track(
  kind: string,
  meta?: Record<string, unknown>,
  path?: string,
): void {
  if (typeof window === "undefined") return;
  installFlushers();
  QUEUE.push({
    kind,
    path: path ?? window.location.pathname,
    meta,
    ts: Date.now(),
  });
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => flush(false), FLUSH_MS);
  if (QUEUE.length >= MAX_BATCH) flush(false);
}
