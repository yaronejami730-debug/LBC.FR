import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { getMobileUser, extractBearer, getMobileUserFromHeaders } from "@/lib/mobile-auth";

export type AuthedUserId = string | null;

// Accepte la session NextAuth (cookie) ou un Bearer JWT mobile.
// Web continue de fonctionner ; mobile signe via /api/mobile/auth/*.
export async function getAuthUserId(req?: NextRequest): Promise<AuthedUserId> {
  if (req && extractBearer(req)) {
    const u = await getMobileUser(req);
    if (u) return u.id;
  }
  const session = await auth();
  return session?.user?.id ?? null;
}

export async function getAuthUser(req?: NextRequest) {
  if (req && extractBearer(req)) {
    const u = await getMobileUser(req);
    if (u) return { id: u.id, email: u.email, role: u.role, isPro: u.isPro };
  }
  // Sans objet `req` — le cas des Server Actions et des fonctions appelées
  // depuis une route sans le passer — l'en-tête reste lisible via `headers()`.
  // C'est ce qui permet à l'application mobile de réutiliser exactement le code
  // d'administration du site, plutôt qu'une copie qui divergerait.
  if (!req) {
    const fromHeader = await getMobileUserFromHeaders();
    if (fromHeader) {
      return {
        id: fromHeader.id,
        email: fromHeader.email,
        role: fromHeader.role,
        isPro: fromHeader.isPro,
      };
    }
  }
  const session = await auth();
  if (!session?.user?.id) return null;
  return {
    id: session.user.id,
    email: session.user.email ?? "",
    role: (session.user as { role?: string }).role,
    isPro: Boolean((session.user as { isPro?: boolean }).isPro),
  };
}
