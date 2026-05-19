"use client";

/**
 * Bouton de souscription Web Push — apparition discrète dans l'UI
 * connectée. Cache le bouton si l'API push est indisponible ou si
 * l'utilisateur a déjà accordé la permission. Ne demande JAMAIS la
 * permission au montage : geste utilisateur requis (sinon Chrome/Safari
 * gèlent la requête pour 7 jours).
 */

import { useEffect, useState } from "react";

/**
 * Convertit la clé VAPID base64url → ArrayBuffer attendu par PushManager.
 * On retourne le `.buffer` plutôt que la `Uint8Array` directement : sur les
 * lib.dom récentes le type accepté par `applicationServerKey` est
 * `BufferSource` strict (`ArrayBuffer`, pas un `Uint8Array<ArrayBufferLike>`).
 */
function urlBase64ToBuffer(b64: string): ArrayBuffer {
  const padding = "=".repeat((4 - (b64.length % 4)) % 4);
  const base64 = (b64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const buf = new ArrayBuffer(raw.length);
  const view = new Uint8Array(buf);
  for (let i = 0; i < raw.length; i++) view[i] = raw.charCodeAt(i);
  return buf;
}

type State = "idle" | "loading" | "subscribed" | "denied" | "unsupported";

export default function PushOptIn() {
  const [state, setState] = useState<State>("loading");
  const [vapid, setVapid] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const supported =
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window;
    if (!supported) {
      setState("unsupported");
      return;
    }
    if (Notification.permission === "denied") {
      setState("denied");
      return;
    }
    fetch("/api/push/public-key")
      .then((r) => r.json())
      .then((d: { key: string | null }) => setVapid(d.key))
      .catch(() => setVapid(null))
      .finally(() => {
        navigator.serviceWorker
          .getRegistration()
          .then((reg) => reg?.pushManager.getSubscription())
          .then((sub) => setState(sub ? "subscribed" : "idle"))
          .catch(() => setState("idle"));
      });
  }, []);

  async function subscribe() {
    if (!vapid) return;
    setState("loading");
    try {
      const reg =
        (await navigator.serviceWorker.getRegistration()) ||
        (await navigator.serviceWorker.register("/sw.js"));
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToBuffer(vapid),
      });
      const raw = sub.toJSON();
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(raw),
      });
      setState("subscribed");
    } catch (err) {
      console.error("[push] subscribe échec:", err);
      setState(Notification.permission === "denied" ? "denied" : "idle");
    }
  }

  async function unsubscribe() {
    setState("loading");
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setState("idle");
    } catch {
      setState("idle");
    }
  }

  if (state === "unsupported") return null;
  if (!vapid) return null;

  if (state === "denied") {
    return (
      <p className="text-xs text-outline">
        Les notifications sont bloquées dans votre navigateur.
      </p>
    );
  }

  if (state === "subscribed") {
    return (
      <button
        type="button"
        onClick={unsubscribe}
        className="text-xs text-outline underline"
      >
        Désactiver les notifications
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={subscribe}
      disabled={state === "loading"}
      className="text-xs px-3 py-1.5 bg-primary text-white rounded-full font-semibold disabled:opacity-50"
    >
      Activer les notifications
    </button>
  );
}
