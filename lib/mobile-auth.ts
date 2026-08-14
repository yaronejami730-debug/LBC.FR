import { SignJWT, jwtVerify } from "jose";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

const ISSUER = "dealandco-mobile";
const AUDIENCE = "dealandco-mobile-app";
const ALG = "HS256";
const TTL_SECONDS = 60 * 60 * 24 * 30; // 30 jours

function secret(): Uint8Array {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET manquant");
  return new TextEncoder().encode(s);
}

export async function signMobileToken(payload: { sub: string; email: string; role?: string; isPro?: boolean }) {
  const jwt = await new SignJWT({ email: payload.email, role: payload.role ?? "USER", isPro: payload.isPro ?? false })
    .setProtectedHeader({ alg: ALG })
    .setSubject(payload.sub)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${TTL_SECONDS}s`)
    .sign(secret());
  return { token: jwt, expiresIn: TTL_SECONDS };
}

export async function verifyMobileToken(token: string) {
  const { payload } = await jwtVerify(token, secret(), { issuer: ISSUER, audience: AUDIENCE });
  return payload as { sub: string; email: string; role?: string; isPro?: boolean };
}

export function extractBearer(req: NextRequest): string | null {
  const h = req.headers.get("authorization") || req.headers.get("Authorization");
  if (!h) return null;
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}

export async function getMobileUser(req: NextRequest) {
  const token = extractBearer(req);
  if (!token) return null;
  try {
    const payload = await verifyMobileToken(token);
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true, email: true, name: true, role: true, isPro: true, emailVerified: true,
        bannedAt: true, companyName: true, verified: true, avatar: true, phoneNumber: true,
        marketingConsent: true,
      },
    });
    if (!user || user.bannedAt) return null;
    return user;
  } catch (err) {
    // Diagnostic clé : visible dans logs Vercel quand getMobileUser fail
    console.error("[getMobileUser] verify/find failed", err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Même chose, à partir des en-têtes de la requête courante.
 *
 * Les Server Actions n'ont pas d'objet `NextRequest` : elles ne reçoivent que
 * leurs arguments. `headers()` donne pourtant accès à l'en-tête `Authorization`
 * de l'appel en cours, ce qui permet à l'application mobile d'appeler
 * exactement le même code d'administration que le site — sans dupliquer une
 * logique qui divergerait au premier correctif.
 */
export async function getMobileUserFromHeaders() {
  try {
    const { headers } = await import("next/headers");
    const store = await headers();
    const raw = store.get("authorization") ?? store.get("Authorization");
    const token = raw?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
    if (!token) return null;

    const payload = await verifyMobileToken(token);
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true, email: true, name: true, role: true, isPro: true, emailVerified: true,
        bannedAt: true, companyName: true, verified: true, avatar: true, phoneNumber: true,
        marketingConsent: true,
      },
    });
    if (!user || user.bannedAt) return null;
    return user;
  } catch {
    // Hors contexte de requête (script, build) : pas de jeton, pas d'erreur.
    return null;
  }
}
