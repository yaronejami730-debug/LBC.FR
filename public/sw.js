/**
 * Service Worker — Web Push uniquement.
 *
 * Pas de stratégie de cache offline ici (le site est SSR/PWA-less). Le SW
 * existe pour recevoir les notifications push et router le clic vers la
 * bonne URL. Mise à jour : `skipWaiting` + `clients.claim` pour qu'une
 * nouvelle version remplace immédiatement l'ancienne.
 */

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = {}; }
  const title = data.title || "Deal & Co";
  const options = {
    body: data.body || "",
    icon: data.icon || "/icon.png",
    badge: "/icon.png",
    tag: data.tag || undefined,
    data: { url: data.url || "/" },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      // Re-focus un onglet existant si déjà ouvert sur la même URL.
      for (const c of list) {
        if (c.url.endsWith(url) && "focus" in c) return c.focus();
      }
      return self.clients.openWindow(url);
    }),
  );
});
