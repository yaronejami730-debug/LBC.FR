/**
 * Web Push — envoi de notifications natives (RFC 8030 + VAPID).
 *
 * Pourquoi ici : le moteur comportemental veut un canal alternatif à l'email
 * (souvent ignoré). Push = livraison immédiate au système d'exploitation,
 * indépendant des clients mail bloqueurs de pixel.
 *
 * Clés VAPID requises en env :
 *   VAPID_PUBLIC_KEY  — exposée côté navigateur (`/api/push/public-key`)
 *   VAPID_PRIVATE_KEY — secrète, signature du JWT VAPID
 *   VAPID_SUBJECT     — `mailto:` du contact (RFC 8292)
 *
 * Génération une fois : `npx web-push generate-vapid-keys`.
 */

import type { PrismaClient } from "@prisma/client";
import webpush from "web-push";

let configured = false;

function ensureConfigured(): boolean {
  if (configured) return true;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subj = process.env.VAPID_SUBJECT ?? "mailto:notif@dealandcompany.fr";
  if (!pub || !priv) return false;
  webpush.setVapidDetails(subj, pub, priv);
  configured = true;
  return true;
}

export function getVapidPublicKey(): string | null {
  return process.env.VAPID_PUBLIC_KEY ?? null;
}

export type PushPayload = {
  title: string;
  body?: string;
  url?: string;       // ouvert au clic
  tag?: string;       // remplace une notif précédente du même tag
  icon?: string;
};

export type PushSendResult = {
  ok: number;
  removed: number;    // souscriptions invalides désactivées
  failed: number;
};

/**
 * Envoie une notification à toutes les souscriptions actives d'un utilisateur.
 * Désactive automatiquement les souscriptions retournant 404/410 (l'appareil
 * a révoqué la permission ou désinstallé l'application).
 */
export async function pushToUser(
  prisma: PrismaClient,
  userId: string,
  payload: PushPayload,
): Promise<PushSendResult> {
  if (!ensureConfigured()) return { ok: 0, removed: 0, failed: 0 };

  const subs = await prisma.pushSubscription.findMany({
    where: { userId, disabledAt: null },
  });
  if (subs.length === 0) return { ok: 0, removed: 0, failed: 0 };

  const body = JSON.stringify(payload);
  let ok = 0;
  let removed = 0;
  let failed = 0;
  const now = new Date();

  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: s.endpoint,
            keys: { p256dh: s.p256dh, auth: s.auth },
          },
          body,
          { TTL: 86_400 },
        );
        ok++;
        prisma.pushSubscription
          .update({ where: { id: s.id }, data: { lastUsedAt: now } })
          .catch(() => {});
      } catch (err: unknown) {
        const status = (err as { statusCode?: number })?.statusCode;
        if (status === 404 || status === 410) {
          removed++;
          prisma.pushSubscription
            .update({ where: { id: s.id }, data: { disabledAt: now } })
            .catch(() => {});
        } else {
          failed++;
          console.error("[push] envoi échec:", status, err);
        }
      }
    }),
  );

  return { ok, removed, failed };
}

/** Renvoie `true` si l'utilisateur a au moins une souscription active. */
export async function hasActivePush(
  prisma: PrismaClient,
  userId: string,
): Promise<boolean> {
  const c = await prisma.pushSubscription.count({
    where: { userId, disabledAt: null },
  });
  return c > 0;
}
