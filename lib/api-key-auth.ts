/**
 * Authentification par clé API.
 *
 * Format de clé : `dco_<prefix8>_<random48hex>` → 56 caractères, opaque pour
 * l'extérieur. Le hash SHA-256 de la clé entière est stocké dans `ApiKey.keyHash`,
 * la clé en clair n'est jamais persistée — elle n'est affichée qu'une fois à
 * sa création.
 *
 * Usage :
 *   const auth = await verifyApiKey(req);
 *   if (!auth) return NextResponse.json({ error: "..." }, { status: 401 });
 *   // auth.userId = propriétaire de la clé
 */

import { createHash, randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";

export type ApiKeyAuth = { userId: string; keyId: string };

const KEY_PREFIX = "dco_";

/** Génère une nouvelle clé en clair et son hash de stockage. */
export function generateApiKey(): { raw: string; prefix: string; hash: string } {
  const prefix = randomBytes(4).toString("hex"); // 8 caractères
  const secret = randomBytes(24).toString("hex"); // 48 caractères
  const raw = `${KEY_PREFIX}${prefix}_${secret}`;
  const hash = createHash("sha256").update(raw).digest("hex");
  return { raw, prefix, hash };
}

/**
 * Vérifie l'en-tête `Authorization: Bearer <key>` d'une requête.
 * Renvoie `null` si invalide, révoquée, ou absente.
 */
export async function verifyApiKey(req: Request): Promise<ApiKeyAuth | null> {
  const header = req.headers.get("authorization") ?? "";
  const m = /^Bearer\s+(\S+)$/i.exec(header);
  if (!m) return null;

  const raw = m[1];
  if (!raw.startsWith(KEY_PREFIX)) return null;

  const hash = createHash("sha256").update(raw).digest("hex");
  const record = await prisma.apiKey.findUnique({
    where: { keyHash: hash },
    select: { id: true, userId: true, revokedAt: true },
  });
  if (!record || record.revokedAt) return null;

  // Mise à jour `lastUsedAt` — fire and forget, ne bloque pas la requête.
  prisma.apiKey
    .update({ where: { id: record.id }, data: { lastUsedAt: new Date() } })
    .catch(() => {});

  return { userId: record.userId, keyId: record.id };
}
