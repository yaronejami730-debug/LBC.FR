import { AppState } from "react-native";
import { apiFetch } from "./api";

/**
 * Tracker d'événements — mobile. File d'attente + envoi groupé vers
 * `POST /api/events` (auth Bearer → l'event est rattaché au userId).
 * Sert à alimenter la home perso : `listing_view` (récemment vu + intérêts)
 * et `search` (reprendre vos recherches). Ne lève jamais.
 */

type Evt = { kind: string; meta?: Record<string, unknown>; path?: string; ts: number };

const QUEUE: Evt[] = [];
const FLUSH_MS = 4_000;
const MAX_BATCH = 50;

let timer: ReturnType<typeof setTimeout> | null = null;
let appStateHooked = false;

function flush(): void {
  if (QUEUE.length === 0) return;
  const batch = QUEUE.splice(0, MAX_BATCH);
  apiFetch("/api/events", {
    method: "POST",
    body: JSON.stringify({ events: batch }),
  }).catch(() => { /* tracking silencieux */ });
}

function hookAppState(): void {
  if (appStateHooked) return;
  appStateHooked = true;
  AppState.addEventListener("change", (s) => {
    if (s === "background" || s === "inactive") flush();
  });
}

/** Enfile un événement. `meta` JSON-sérialisable. */
export function track(kind: string, meta?: Record<string, unknown>): void {
  hookAppState();
  QUEUE.push({ kind, meta, ts: Date.now() });
  if (timer) clearTimeout(timer);
  timer = setTimeout(flush, FLUSH_MS);
  if (QUEUE.length >= MAX_BATCH) flush();
}
