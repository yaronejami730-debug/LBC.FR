/**
 * Rate limiter en mémoire (in-process).
 * Adapté aux Vercel Serverless Functions : les instances ne sont pas partagées,
 * donc ce rate limiter est "par instance". Il protège contre les abus concentrés
 * sur une même instance mais pas contre les attaques distribuées multi-instances.
 * Pour une protection plus forte en prod, utiliser Upstash Redis ou similaire.
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

/**
 * @param key       Clé unique (ex: "register:1.2.3.4")
 * @param limit     Nombre max de requêtes
 * @param windowMs  Fenêtre de temps en ms
 * @returns true si la requête est autorisée, false si limitée
 */
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || entry.resetAt < now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (entry.count >= limit) {
    return false;
  }

  entry.count++;
  return true;
}

export function getClientIp(req: Request): string {
  const forwarded = (req.headers as any).get?.("x-forwarded-for") ?? "";
  return forwarded.split(",")[0].trim() || "unknown";
}
