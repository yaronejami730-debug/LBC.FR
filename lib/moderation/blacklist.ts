/**
 * Chargement de la blacklist depuis la table `Blacklist` vers la mémoire.
 *
 * La table est la source de vérité (alimentée par `scripts/blacklist-import.ts`).
 * Au runtime, on charge les domaines dans un `Set` en mémoire pour garder le
 * scan d'URL synchrone et O(1) — pas de requête DB sur le hot path.
 *
 * Le cache est rafraîchi au plus toutes les `TTL_MS`.
 */

import type { PrismaClient } from "@prisma/client";
import { primeUrlBlacklist } from "@/lib/moderation/url-scanner";

const TTL_MS = 10 * 60_000; // 10 min
let primedAt = 0;
let priming: Promise<void> | null = null;

/**
 * Garantit que la blacklist en mémoire est à jour (rechargée si périmée).
 * Sûr à appeler sur chaque requête : no-op tant que le cache est frais.
 */
export async function ensureBlacklistPrimed(prisma: PrismaClient): Promise<void> {
  if (Date.now() - primedAt < TTL_MS) return;
  if (priming) return priming; // un seul rechargement concurrent

  priming = (async () => {
    try {
      const rows = await prisma.blacklist.findMany({
        where: { kind: "domain" },
        select: { value: true },
      });
      primeUrlBlacklist(rows.map((r) => r.value));
      primedAt = Date.now();
    } catch (err) {
      console.error("[blacklist] échec du chargement:", err);
    } finally {
      priming = null;
    }
  })();
  return priming;
}
